-- ============================================================================
-- FASE 1: FUNCIONES SECURITY DEFINER Y TRIGGERS DE EVENTOS_OUTBOX
-- ============================================================================
-- Toda operación sensible (sellar, canjear, activar cupón, validar PIN,
-- generar token QR rotativo, registro inicial) se ejecuta en servidor
-- mediante SECURITY DEFINER con validaciones anti-fraude e idempotencia.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- HELPER INTERNO: Encolar evento en eventos_outbox
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encolar_outbox(
  p_negocio_id UUID,
  p_tipo_evento TEXT,
  p_payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.eventos_outbox (negocio_id, tipo_evento, payload)
  VALUES (p_negocio_id, p_tipo_evento, p_payload)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. REGISTRAR CLIENTE RÁPIDO (<15s) + 1° SELLO DE BIENVENIDA
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_cliente_rapido(
  p_negocio_slug TEXT,
  p_nombre TEXT,
  p_celular TEXT,
  p_dia_nac SMALLINT,
  p_mes_nac SMALLINT,
  p_anio_nac SMALLINT DEFAULT NULL,
  p_consentimiento_wa BOOLEAN DEFAULT false,
  p_user_id UUID DEFAULT NULL,
  p_origen TEXT DEFAULT 'qr_mesa'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio public.negocios%ROWTYPE;
  v_cliente public.clientes%ROWTYPE;
  v_cartilla public.cartillas%ROWTYPE;
  v_codigo_corto TEXT;
  v_es_nuevo BOOLEAN := false;
BEGIN
  SELECT * INTO v_negocio
  FROM public.negocios
  WHERE slug = p_negocio_slug AND activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Negocio no encontrado o inactivo';
  END IF;

  IF p_celular !~ '^\+519[0-9]{8}$' THEN
    RAISE EXCEPTION 'Número de WhatsApp inválido. Debe ser +51 seguido de 9 dígitos iniciando en 9.';
  END IF;

  SELECT * INTO v_cliente
  FROM public.clientes
  WHERE negocio_id = v_negocio.id AND celular = p_celular;

  IF NOT FOUND THEN
    v_es_nuevo := true;
    INSERT INTO public.clientes (
      negocio_id, user_id, nombre, celular,
      fecha_nacimiento_dia, fecha_nacimiento_mes, fecha_nacimiento_anio,
      consentimiento_whatsapp, fecha_consentimiento, origen_registro
    ) VALUES (
      v_negocio.id, p_user_id, trim(p_nombre), p_celular,
      p_dia_nac, p_mes_nac, p_anio_nac,
      p_consentimiento_wa,
      CASE WHEN p_consentimiento_wa THEN now() ELSE NULL END,
      p_origen
    )
    RETURNING * INTO v_cliente;

    v_codigo_corto := '#AI-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4));

    INSERT INTO public.cartillas (
      negocio_id, cliente_id, codigo_corto,
      sellos_actuales, sellos_objetivo, sellos_historicos
    ) VALUES (
      v_negocio.id, v_cliente.id, v_codigo_corto,
      1, v_negocio.sellos_para_premio, 1
    )
    RETURNING * INTO v_cartilla;

    INSERT INTO public.sellos (
      negocio_id, cliente_id, cartilla_id, cantidad, tipo, detalle, idempotency_key
    ) VALUES (
      v_negocio.id, v_cliente.id, v_cartilla.id, 1, 'bienvenida',
      '1° Sello de Bienvenida', 'welcome-' || v_cliente.id::text
    );

    PERFORM public.encolar_outbox(
      v_negocio.id,
      'cliente_registrado',
      jsonb_build_object(
        'cliente_id', v_cliente.id,
        'nombre', v_cliente.nombre,
        'celular', v_cliente.celular,
        'consentimiento_whatsapp', v_cliente.consentimiento_whatsapp,
        'sellos_actuales', 1,
        'sellos_objetivo', v_negocio.sellos_para_premio,
        'negocio_slug', v_negocio.slug
      )
    );
  ELSE
    SELECT * INTO v_cartilla
    FROM public.cartillas
    WHERE negocio_id = v_negocio.id AND cliente_id = v_cliente.id;
  END IF;

  RETURN jsonb_build_object(
    'es_nuevo', v_es_nuevo,
    'cliente', to_jsonb(v_cliente),
    'cartilla', to_jsonb(v_cartilla)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. GENERAR TOKEN QR ROTATIVO (válido por 30 segundos)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generar_token_qr(
  p_negocio_id UUID,
  p_cliente_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_expira TIMESTAMPTZ := now() + interval '35 seconds'; -- 30s + 5s margen de red
BEGIN
  -- Verificar pertenencia si quien llama es cliente autenticado
  IF auth.uid() IS NOT NULL AND public.auth_rol() = 'customer' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clientes
      WHERE id = p_cliente_id AND negocio_id = p_negocio_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'No autorizado para generar QR de este cliente';
    END IF;
  END IF;

  v_token := 'AIT-' || encode(gen_random_bytes(12), 'hex');

  INSERT INTO public.qr_tokens (negocio_id, cliente_id, token, expira_at)
  VALUES (p_negocio_id, p_cliente_id, v_token, v_expira);

  RETURN jsonb_build_object(
    'token', v_token,
    'expira_at', v_expira,
    'ttl_segundos', 30
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. VALIDAR PIN DE CAJERO POS (4-6 dígitos con bloqueo por fuerza bruta)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_pin(
  p_negocio_id UUID,
  p_sede_id UUID,
  p_pin TEXT,
  p_dispositivo_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_cajero RECORD;
BEGIN
  IF p_pin !~ '^[0-9]{4,6}$' THEN
    RAISE EXCEPTION 'El PIN debe tener entre 4 y 6 dígitos numéricos';
  END IF;

  SELECT * INTO v_cajero
  FROM public.perfiles
  WHERE negocio_id = p_negocio_id
    AND (sede_id = p_sede_id OR rol = 'owner')
    AND rol IN ('cashier', 'owner')
    AND activo = true
    AND pin_hash IS NOT NULL
    AND pin_hash = crypt(p_pin, pin_hash)
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.auditoria_seguridad (negocio_id, sede_id, dispositivo_id, accion, detalle, alerta_fraude)
    VALUES (p_negocio_id, p_sede_id, p_dispositivo_id, 'pin_invalido', jsonb_build_object('hora', now()), false);

    RETURN jsonb_build_object('valido', false, 'mensaje', 'PIN incorrecto o cajero inactivo');
  END IF;

  IF v_cajero.pin_bloqueado_hasta IS NOT NULL AND v_cajero.pin_bloqueado_hasta > now() THEN
    RETURN jsonb_build_object('valido', false, 'mensaje', 'Cajero bloqueado temporalmente por intentos fallidos');
  END IF;

  UPDATE public.perfiles
  SET pin_intentos_fallidos = 0, pin_bloqueado_hasta = NULL
  WHERE id = v_cajero.id;

  IF p_dispositivo_id IS NOT NULL THEN
    UPDATE public.dispositivos SET ultimo_acceso_at = now() WHERE id = p_dispositivo_id;
  END IF;

  RETURN jsonb_build_object(
    'valido', true,
    'cajero', jsonb_build_object(
      'id', v_cajero.id,
      'nombre_completo', v_cajero.nombre_completo,
      'rol', v_cajero.rol,
      'sede_id', coalesce(v_cajero.sede_id, p_sede_id)
    )
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. DAR SELLO (Idempotente + Anti-fraude + Nivel + Outbox)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dar_sello(
  p_negocio_id UUID,
  p_sede_id UUID,
  p_cliente_id UUID,
  p_cajero_id UUID,
  p_dispositivo_id UUID,
  p_cantidad INT DEFAULT 1,
  p_detalle TEXT DEFAULT 'Consumo en local',
  p_idempotency_key TEXT DEFAULT NULL,
  p_qr_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio public.negocios%ROWTYPE;
  v_cartilla public.cartillas%ROWTYPE;
  v_ultimo_sello TIMESTAMPTZ;
  v_sellos_en_10min INT;
  v_nuevo_total INT;
  v_nuevo_historico INT;
  v_nuevo_nivel public.nivel_lealtad;
  v_premio_listo BOOLEAN;
  v_key TEXT := coalesce(p_idempotency_key, gen_random_uuid()::text);
  v_sello_id UUID;
BEGIN
  -- Idempotencia (crucial para cola offline POS)
  SELECT id INTO v_sello_id
  FROM public.sellos
  WHERE negocio_id = p_negocio_id AND idempotency_key = v_key;

  IF FOUND THEN
    SELECT * INTO v_cartilla FROM public.cartillas WHERE cliente_id = p_cliente_id AND negocio_id = p_negocio_id;
    RETURN jsonb_build_object('duplicado', true, 'sello_id', v_sello_id, 'cartilla', to_jsonb(v_cartilla));
  END IF;

  -- Validar token QR si se proporcionó
  IF p_qr_token IS NOT NULL THEN
    UPDATE public.qr_tokens
    SET usado = true
    WHERE token = p_qr_token AND negocio_id = p_negocio_id AND cliente_id = p_cliente_id
      AND usado = false AND expira_at >= now();
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Código QR expirado o ya utilizado. Pide al cliente refrescar su cartilla.';
    END IF;
  END IF;

  SELECT * INTO v_negocio FROM public.negocios WHERE id = p_negocio_id;
  SELECT * INTO v_cartilla FROM public.cartillas
  WHERE negocio_id = p_negocio_id AND cliente_id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartilla no encontrada para el cliente';
  END IF;

  -- Anti-fraude: intervalo mínimo entre sellos de visita
  SELECT max(created_at) INTO v_ultimo_sello
  FROM public.sellos
  WHERE cliente_id = p_cliente_id AND negocio_id = p_negocio_id AND tipo = 'visita';

  IF v_ultimo_sello IS NOT NULL AND v_negocio.intervalo_minimo_sellos_min > 0 THEN
    IF v_ultimo_sello + (v_negocio.intervalo_minimo_sellos_min || ' minutes')::interval > now() THEN
      RAISE EXCEPTION 'Intervalo mínimo de % minutos entre sellos no cumplido.', v_negocio.intervalo_minimo_sellos_min;
    END IF;
  END IF;

  -- Detección de anomalía por ráfaga (>15 sellos por cajero en 10 min)
  SELECT count(*) INTO v_sellos_en_10min
  FROM public.sellos
  WHERE cajero_id = p_cajero_id AND created_at > now() - interval '10 minutes';

  IF v_sellos_en_10min >= 15 THEN
    INSERT INTO public.auditoria_seguridad (negocio_id, sede_id, actor_id, dispositivo_id, accion, detalle, alerta_fraude)
    VALUES (p_negocio_id, p_sede_id, p_cajero_id, p_dispositivo_id, 'rafaga_sellos',
      jsonb_build_object('cantidad_10min', v_sellos_en_10min), true);
  END IF;

  v_nuevo_total := least(v_cartilla.sellos_objetivo, v_cartilla.sellos_actuales + p_cantidad);
  v_nuevo_historico := v_cartilla.sellos_historicos + p_cantidad;
  v_premio_listo := (v_nuevo_total >= v_cartilla.sellos_objetivo);

  IF v_nuevo_historico >= 35 THEN
    v_nuevo_nivel := 'Oro';
  ELSIF v_nuevo_historico >= 15 THEN
    v_nuevo_nivel := 'Plata';
  ELSE
    v_nuevo_nivel := 'Bambú';
  END IF;

  INSERT INTO public.sellos (
    negocio_id, sede_id, cliente_id, cartilla_id, cajero_id, dispositivo_id,
    cantidad, tipo, detalle, idempotency_key
  ) VALUES (
    p_negocio_id, p_sede_id, p_cliente_id, v_cartilla.id, p_cajero_id, p_dispositivo_id,
    p_cantidad, 'visita', p_detalle, v_key
  )
  RETURNING id INTO v_sello_id;

  UPDATE public.cartillas
  SET sellos_actuales = v_nuevo_total,
      sellos_historicos = v_nuevo_historico,
      nivel = v_nuevo_nivel,
      premio_disponible = v_premio_listo,
      updated_at = now()
  WHERE id = v_cartilla.id
  RETURNING * INTO v_cartilla;

  UPDATE public.clientes
  SET total_visitas = total_visitas + 1, ultima_visita_at = now(), updated_at = now()
  WHERE id = p_cliente_id;

  INSERT INTO public.auditoria_seguridad (negocio_id, sede_id, actor_id, dispositivo_id, accion, detalle)
  VALUES (p_negocio_id, p_sede_id, p_cajero_id, p_dispositivo_id, 'dar_sello',
    jsonb_build_object('cliente_id', p_cliente_id, 'sello_id', v_sello_id, 'sellos_actuales', v_nuevo_total));

  -- Outbox: sello_confirmado y premio_listo si completó cartilla
  PERFORM public.encolar_outbox(
    p_negocio_id,
    'sello_confirmado',
    jsonb_build_object(
      'sello_id', v_sello_id,
      'cliente_id', p_cliente_id,
      'sellos_actuales', v_nuevo_total,
      'sellos_objetivo', v_cartilla.sellos_objetivo,
      'falta', greatest(0, v_cartilla.sellos_objetivo - v_nuevo_total),
      'sellos_historicos', v_nuevo_historico
    )
  );

  IF v_premio_listo THEN
    PERFORM public.encolar_outbox(
      p_negocio_id,
      'premio_listo',
      jsonb_build_object(
        'cliente_id', p_cliente_id,
        'premio', v_negocio.nombre_premio,
        'sellos_actuales', v_nuevo_total
      )
    );
  END IF;

  RETURN jsonb_build_object('duplicado', false, 'sello_id', v_sello_id, 'cartilla', to_jsonb(v_cartilla));
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. CANJEAR PREMIO
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.canjear_premio(
  p_negocio_id UUID,
  p_sede_id UUID,
  p_cliente_id UUID,
  p_cajero_id UUID,
  p_dispositivo_id UUID,
  p_verificado_otp BOOLEAN DEFAULT false,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio public.negocios%ROWTYPE;
  v_cartilla public.cartillas%ROWTYPE;
  v_canje_id UUID;
  v_key TEXT := coalesce(p_idempotency_key, gen_random_uuid()::text);
BEGIN
  SELECT * INTO v_negocio FROM public.negocios WHERE id = p_negocio_id;
  IF v_negocio.otp_requerido_canje AND NOT p_verificado_otp THEN
    RAISE EXCEPTION 'Este negocio requiere verificación OTP del cliente para canjear el premio.';
  END IF;

  SELECT * INTO v_cartilla FROM public.cartillas
  WHERE negocio_id = p_negocio_id AND cliente_id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND OR v_cartilla.sellos_actuales < v_cartilla.sellos_objetivo THEN
    RAISE EXCEPTION 'El cliente aún no alcanza los sellos requeridos (%).', v_cartilla.sellos_objetivo;
  END IF;

  INSERT INTO public.canjes (
    negocio_id, sede_id, cliente_id, cartilla_id, cajero_id, dispositivo_id,
    premio_entregado, sellos_consumidos, verificado_otp, idempotency_key
  ) VALUES (
    p_negocio_id, p_sede_id, p_cliente_id, v_cartilla.id, p_cajero_id, p_dispositivo_id,
    v_negocio.nombre_premio, v_cartilla.sellos_objetivo, p_verificado_otp, v_key
  )
  RETURNING id INTO v_canje_id;

  UPDATE public.cartillas
  SET sellos_actuales = 0,
      premio_disponible = false,
      canjes_historicos = canjes_historicos + 1,
      updated_at = now()
  WHERE id = v_cartilla.id
  RETURNING * INTO v_cartilla;

  PERFORM public.encolar_outbox(
    p_negocio_id,
    'canje_realizado',
    jsonb_build_object(
      'canje_id', v_canje_id,
      'cliente_id', p_cliente_id,
      'premio', v_negocio.nombre_premio
    )
  );

  RETURN jsonb_build_object('canje_id', v_canje_id, 'cartilla', to_jsonb(v_cartilla));
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. ACTIVAR PROMO (Genera cupón QR validando vigencia, límite y stock)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activar_promo(
  p_negocio_id UUID,
  p_promocion_id UUID,
  p_cliente_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo public.promociones%ROWTYPE;
  v_usos INT;
  v_cupon public.cupones%ROWTYPE;
  v_codigo TEXT;
BEGIN
  SELECT * INTO v_promo FROM public.promociones
  WHERE id = p_promocion_id AND negocio_id = p_negocio_id AND activa = true
  FOR UPDATE;

  IF NOT FOUND OR v_promo.vigencia_fin < now() THEN
    RAISE EXCEPTION 'Promoción no disponible o expirada';
  END IF;

  IF v_promo.stock_total IS NOT NULL AND v_promo.stock_usado >= v_promo.stock_total THEN
    RAISE EXCEPTION 'Stock agotado para esta promoción';
  END IF;

  SELECT count(*) INTO v_usos
  FROM public.cupones
  WHERE promocion_id = p_promocion_id AND cliente_id = p_cliente_id AND estado IN ('activo', 'canjeado');

  IF v_usos >= v_promo.limite_por_cliente THEN
    RAISE EXCEPTION 'Ya alcanzaste el límite de uso (%) para esta promoción.', v_promo.limite_por_cliente;
  END IF;

  v_codigo := 'CUP-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));

  INSERT INTO public.cupones (negocio_id, promocion_id, cliente_id, codigo_qr, expira_at)
  VALUES (p_negocio_id, p_promocion_id, p_cliente_id, v_codigo, v_promo.vigencia_fin)
  RETURNING * INTO v_cupon;

  PERFORM public.encolar_outbox(
    p_negocio_id,
    'promo_activada',
    jsonb_build_object(
      'cupon_id', v_cupon.id,
      'promocion_id', p_promocion_id,
      'cliente_id', p_cliente_id,
      'codigo_qr', v_codigo
    )
  );

  RETURN to_jsonb(v_cupon);
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. CANJEAR CUPÓN EN CAJA POS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.canjear_cupon(
  p_negocio_id UUID,
  p_sede_id UUID,
  p_codigo_qr TEXT,
  p_cajero_id UUID,
  p_dispositivo_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupon public.cupones%ROWTYPE;
  v_promo public.promociones%ROWTYPE;
  v_cartilla public.cartillas%ROWTYPE;
BEGIN
  SELECT * INTO v_cupon FROM public.cupones
  WHERE codigo_qr = p_codigo_qr AND negocio_id = p_negocio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cupón no encontrado';
  END IF;

  IF v_cupon.estado <> 'activo' OR v_cupon.expira_at < now() THEN
    RAISE EXCEPTION 'Cupón ya canjeado o expirado';
  END IF;

  SELECT * INTO v_promo FROM public.promociones WHERE id = v_cupon.promocion_id FOR UPDATE;

  UPDATE public.cupones
  SET estado = 'canjeado',
      canjeado_at = now(),
      sede_canje_id = p_sede_id,
      cajero_canje_id = p_cajero_id,
      dispositivo_canje_id = p_dispositivo_id
  WHERE id = v_cupon.id
  RETURNING * INTO v_cupon;

  UPDATE public.promociones
  SET stock_usado = stock_usado + 1
  WHERE id = v_promo.id;

  IF v_promo.sellos_extra > 0 THEN
    SELECT * INTO v_cartilla FROM public.cartillas
    WHERE negocio_id = p_negocio_id AND cliente_id = v_cupon.cliente_id
    FOR UPDATE;

    INSERT INTO public.sellos (
      negocio_id, sede_id, cliente_id, cartilla_id, cajero_id, dispositivo_id,
      cantidad, tipo, detalle, idempotency_key
    ) VALUES (
      p_negocio_id, p_sede_id, v_cupon.cliente_id, v_cartilla.id, p_cajero_id, p_dispositivo_id,
      v_promo.sellos_extra, 'promo', 'Promo: ' || v_promo.titulo, 'cupon-' || v_cupon.id::text
    );

    UPDATE public.cartillas
    SET sellos_actuales = least(sellos_objetivo, sellos_actuales + v_promo.sellos_extra),
        sellos_historicos = sellos_historicos + v_promo.sellos_extra,
        premio_disponible = (least(sellos_objetivo, sellos_actuales + v_promo.sellos_extra) >= sellos_objetivo),
        updated_at = now()
    WHERE id = v_cartilla.id;
  END IF;

  PERFORM public.encolar_outbox(
    p_negocio_id,
    'cupon_canjeado',
    jsonb_build_object(
      'cupon_id', v_cupon.id,
      'promocion_id', v_promo.id,
      'cliente_id', v_cupon.cliente_id,
      'sellos_extra', v_promo.sellos_extra,
      'precio_especial', v_promo.precio_especial
    )
  );

  RETURN jsonb_build_object(
    'cupon', to_jsonb(v_cupon),
    'promocion', to_jsonb(v_promo)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. BONUS DE INSTALACIÓN PWA (+1 SELLO UNA SOLA VEZ AL ACTIVAR PUSH)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.otorgar_bonus_instalacion(
  p_negocio_id UUID,
  p_cliente_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cartilla public.cartillas%ROWTYPE;
BEGIN
  SELECT * INTO v_cartilla FROM public.cartillas
  WHERE negocio_id = p_negocio_id AND cliente_id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartilla no encontrada';
  END IF;

  IF v_cartilla.bonus_instalacion_otorgado THEN
    RETURN jsonb_build_object('otorgado', false, 'mensaje', 'Bonus ya entregado anteriormente', 'cartilla', to_jsonb(v_cartilla));
  END IF;

  INSERT INTO public.sellos (
    negocio_id, cliente_id, cartilla_id, cantidad, tipo, detalle, idempotency_key
  ) VALUES (
    p_negocio_id, p_cliente_id, v_cartilla.id, 1, 'instalacion_pwa',
    'Bonus instalar App y activar alertas', 'pwa-bonus-' || p_cliente_id::text
  );

  UPDATE public.cartillas
  SET bonus_instalacion_otorgado = true,
      sellos_actuales = least(sellos_objetivo, sellos_actuales + 1),
      sellos_historicos = sellos_historicos + 1,
      premio_disponible = (least(sellos_objetivo, sellos_actuales + 1) >= sellos_objetivo),
      updated_at = now()
  WHERE id = v_cartilla.id
  RETURNING * INTO v_cartilla;

  RETURN jsonb_build_object('otorgado', true, 'cartilla', to_jsonb(v_cartilla));
END;
$$;

-- ----------------------------------------------------------------------------
-- TRIGGERS AUTOMÁTICOS EN ENCUESTAS Y BAJA WHATSAPP -> eventos_outbox
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_encuesta_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.encolar_outbox(
    NEW.negocio_id,
    'encuesta_respondida',
    jsonb_build_object(
      'encuesta_id', NEW.id,
      'cliente_id', NEW.cliente_id,
      'calificacion', NEW.calificacion,
      'comentario', NEW.comentario,
      'es_detractor', (NEW.calificacion <= 3),
      'es_promotor', (NEW.calificacion = 5)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encuestas_outbox ON public.encuestas;
CREATE TRIGGER trg_encuestas_outbox
AFTER INSERT ON public.encuestas
FOR EACH ROW EXECUTE FUNCTION public.trg_encuesta_outbox();

CREATE OR REPLACE FUNCTION public.trg_baja_whatsapp_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.baja_whatsapp = true AND coalesce(OLD.baja_whatsapp, false) = false THEN
    PERFORM public.encolar_outbox(
      NEW.negocio_id,
      'baja_solicitada',
      jsonb_build_object(
        'cliente_id', NEW.id,
        'celular', NEW.celular,
        'fecha_baja', coalesce(NEW.fecha_baja, now())
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_baja_outbox ON public.clientes;
CREATE TRIGGER trg_clientes_baja_outbox
AFTER UPDATE OF baja_whatsapp ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.trg_baja_whatsapp_outbox();
