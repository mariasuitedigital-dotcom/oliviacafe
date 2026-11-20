-- ============================================================================
-- FASE 11: REFERIDOS DOBLES, DOBLE SELLO HAPPY HOUR, PANEL ROI Y CARTA DIGITAL
-- ============================================================================

-- 1. Nuevas columnas en negocios (Referidos, Happy Hour y parámetros ROI)
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS referidos_activo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS referidos_sellos_invitador INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS referidos_sellos_invitado INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS happy_hour_config JSONB NOT NULL DEFAULT '{
    "activo": false,
    "dias": [2, 3, 4],
    "hora_inicio": "15:00",
    "hora_fin": "18:00",
    "multiplicador": 2,
    "etiqueta": "Hora Feliz 2x Sellos"
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS ticket_promedio_pen NUMERIC(10, 2) NOT NULL DEFAULT 22.00,
  ADD COLUMN IF NOT EXISTS costo_premio_pen NUMERIC(10, 2) NOT NULL DEFAULT 9.50;

-- 2. Seguimiento de referidos en clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS referido_por_cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referido_recompensado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_referidos_exitosos INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_clientes_referido_por
  ON public.clientes(referido_por_cliente_id)
  WHERE referido_por_cliente_id IS NOT NULL;

-- 3. Tabla de Carta Digital (productos y sugerencias de maridaje)
CREATE TABLE IF NOT EXISTS public.carta_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'Café de Especialidad',
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  precio NUMERIC(10, 2) NOT NULL DEFAULT 0,
  imagen_url TEXT,
  recomendado BOOLEAN NOT NULL DEFAULT false,
  maridaje TEXT,
  disponible BOOLEAN NOT NULL DEFAULT true,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carta_items_negocio
  ON public.carta_items(negocio_id, disponible, orden);

ALTER TABLE public.carta_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de carta disponible" ON public.carta_items;
CREATE POLICY "Lectura pública de carta disponible"
  ON public.carta_items
  FOR SELECT
  USING (disponible = true OR public.auth_negocio_id() = negocio_id OR public.auth_rol() = 'superadmin');

DROP POLICY IF EXISTS "Gestión de carta por staff del negocio" ON public.carta_items;
CREATE POLICY "Gestión de carta por staff del negocio"
  ON public.carta_items
  FOR ALL
  USING (
    public.auth_rol() = 'superadmin'
    OR (public.auth_negocio_id() = negocio_id AND public.auth_rol() IN ('owner', 'cashier'))
  )
  WITH CHECK (
    public.auth_rol() = 'superadmin'
    OR (public.auth_negocio_id() = negocio_id AND public.auth_rol() IN ('owner', 'cashier'))
  );

-- Semilla inicial de Carta Digital para Olivia Café
INSERT INTO public.carta_items (negocio_id, categoria, nombre, descripcion, precio, imagen_url, recomendado, maridaje, disponible, orden)
SELECT
  n.id,
  v.categoria,
  v.nombre,
  v.descripcion,
  v.precio,
  v.imagen_url,
  v.recomendado,
  v.maridaje,
  true,
  v.orden
FROM public.negocios n
CROSS JOIN (
  VALUES
    ('Café de Especialidad', 'Flat White Doble Origen', 'Doble ristretto 100% arábica de Villa Rica con leche texturizada sedosa.', 13.50, '/src/assets/images/aitama_reward_cup_1794847436322.jpg', true, 'Ideal con Croissant de Mantequilla', 1),
    ('Café de Especialidad', 'V60 Filtrado de Altura', 'Extracción manual con notas cítricas y cacao fino de Cusco.', 15.00, '/src/assets/images/aitama_cafe_hero_1794847435488.jpg', false, 'Ideal con Galleta Chocochip', 2),
    ('Cold Brew & Fríos', 'Cold Brew Citron', 'Maceración en frío 18h con rodaja de naranja orgánica de Chanchamayo.', 14.50, '/src/assets/images/aitama_cafe_hero_1794847435488.jpg', true, 'Ideal con Tartaleta de Limón', 3),
    ('Cold Brew & Fríos', 'Iced Latte de Avena', 'Espresso doble sobre hielo con bebida vegetal de avena cremosa.', 15.50, '/src/assets/images/aitama_reward_cup_1794847436322.jpg', false, 'Ideal con Muffin de Arándanos', 4),
    ('Pastelería Artesanal', 'Croissant de Mantequilla', 'Hojaldre francés horneado cada mañana, crujiente por fuera y aireado por dentro.', 9.50, '/src/assets/images/aitama_reward_cup_1794847436322.jpg', true, 'Acompaña con Flat White o Cappuccino', 5),
    ('Combos & Brunch', 'Combo Mañana Olivia', 'Flat White o Americano + Croissant de Mantequilla artesanal.', 19.90, '/src/assets/images/aitama_reward_cup_1794847436322.jpg', true, 'Suma sello en tu cartilla al instante', 6)
) AS v(categoria, nombre, descripcion, precio, imagen_url, recomendado, maridaje, orden)
WHERE n.slug = 'olivia'
  AND NOT EXISTS (
    SELECT 1 FROM public.carta_items ci WHERE ci.negocio_id = n.id
  );

-- 4. Actualizar registrar_cliente_rapido para capturar código de referido (?ref=)
CREATE OR REPLACE FUNCTION public.registrar_cliente_rapido(
  p_negocio_slug TEXT,
  p_nombre TEXT,
  p_celular TEXT,
  p_dia_nac SMALLINT,
  p_mes_nac SMALLINT,
  p_anio_nac SMALLINT DEFAULT NULL,
  p_consentimiento_wa BOOLEAN DEFAULT false,
  p_user_id UUID DEFAULT NULL,
  p_origen TEXT DEFAULT 'qr_mesa',
  p_codigo_referido TEXT DEFAULT NULL
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
  v_referidor_id UUID := NULL;
  v_ref_clean TEXT;
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

    IF v_negocio.referidos_activo AND p_codigo_referido IS NOT NULL AND trim(p_codigo_referido) <> '' THEN
      v_ref_clean := upper(replace(trim(p_codigo_referido), '#', ''));
      SELECT car.cliente_id INTO v_referidor_id
      FROM public.cartillas car
      WHERE car.negocio_id = v_negocio.id
        AND upper(replace(car.codigo_corto, '#', '')) = v_ref_clean
      LIMIT 1;
    END IF;

    INSERT INTO public.clientes (
      negocio_id, user_id, nombre, celular,
      fecha_nacimiento_dia, fecha_nacimiento_mes, fecha_nacimiento_anio,
      consentimiento_whatsapp, fecha_consentimiento, origen_registro,
      referido_por_cliente_id
    ) VALUES (
      v_negocio.id, p_user_id, trim(p_nombre), p_celular,
      p_dia_nac, p_mes_nac, p_anio_nac,
      p_consentimiento_wa,
      CASE WHEN p_consentimiento_wa THEN now() ELSE NULL END,
      p_origen,
      v_referidor_id
    )
    RETURNING * INTO v_cliente;

    v_codigo_corto := '#OL-' || upper(substr(encode(gen_random_bytes(3), 'hex'), 1, 4));

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
        'referido_por_cliente_id', v_referidor_id,
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

-- 5. Actualizar dar_sello para aplicar Happy Hour 2x automático y recompensar referidos tras 1.ª visita en caja
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
  v_cliente public.clientes%ROWTYPE;
  v_cartilla public.cartillas%ROWTYPE;
  v_ref_cartilla public.cartillas%ROWTYPE;
  v_ultimo_sello TIMESTAMPTZ;
  v_sellos_en_10min INT;
  v_nuevo_total INT;
  v_nuevo_historico INT;
  v_nuevo_nivel public.nivel_lealtad;
  v_premio_listo BOOLEAN;
  v_key TEXT := coalesce(p_idempotency_key, gen_random_uuid()::text);
  v_sello_id UUID;
  v_cantidad_efectiva INT := greatest(1, p_cantidad);
  v_local_ts TIMESTAMP;
  v_dow INT;
  v_hhmm TEXT;
  v_hh_activo BOOLEAN := false;
  v_hh_mult INT := 1;
  v_ref_invitador_sellos INT := 0;
  v_ref_invitado_sellos INT := 0;
  v_referidor_recompensado_id UUID := NULL;
BEGIN
  SELECT id INTO v_sello_id
  FROM public.sellos
  WHERE negocio_id = p_negocio_id AND idempotency_key = v_key;

  IF FOUND THEN
    SELECT * INTO v_cartilla FROM public.cartillas WHERE cliente_id = p_cliente_id AND negocio_id = p_negocio_id;
    RETURN jsonb_build_object('duplicado', true, 'sello_id', v_sello_id, 'cartilla', to_jsonb(v_cartilla));
  END IF;

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
  SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id AND negocio_id = p_negocio_id;
  SELECT * INTO v_cartilla FROM public.cartillas
  WHERE negocio_id = p_negocio_id AND cliente_id = p_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartilla no encontrada para el cliente';
  END IF;

  SELECT max(created_at) INTO v_ultimo_sello
  FROM public.sellos
  WHERE cliente_id = p_cliente_id AND negocio_id = p_negocio_id AND tipo = 'visita';

  IF v_ultimo_sello IS NOT NULL AND v_negocio.intervalo_minimo_sellos_min > 0 THEN
    IF v_ultimo_sello + (v_negocio.intervalo_minimo_sellos_min || ' minutes')::interval > now() THEN
      RAISE EXCEPTION 'Intervalo mínimo de % minutos entre sellos no cumplido.', v_negocio.intervalo_minimo_sellos_min;
    END IF;
  END IF;

  SELECT count(*) INTO v_sellos_en_10min
  FROM public.sellos
  WHERE cajero_id = p_cajero_id AND created_at > now() - interval '10 minutes';

  IF v_sellos_en_10min >= 15 THEN
    INSERT INTO public.auditoria_seguridad (negocio_id, sede_id, actor_id, dispositivo_id, accion, detalle, alerta_fraude)
    VALUES (p_negocio_id, p_sede_id, p_cajero_id, p_dispositivo_id, 'rafaga_sellos',
      jsonb_build_object('cantidad_10min', v_sellos_en_10min), true);
  END IF;

  -- Verificar Happy Hour (Doble sello en horas muertas)
  IF coalesce((v_negocio.happy_hour_config->>'activo')::boolean, false) THEN
    v_local_ts := now() AT TIME ZONE coalesce(v_negocio.zona_horaria, 'America/Lima');
    v_dow := extract(dow FROM v_local_ts)::int;
    v_hhmm := to_char(v_local_ts, 'HH24:MI');

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(coalesce(v_negocio.happy_hour_config->'dias', '[]'::jsonb)) d
      WHERE d::int = v_dow
    ) AND v_hhmm >= coalesce(v_negocio.happy_hour_config->>'hora_inicio', '15:00')
      AND v_hhmm <= coalesce(v_negocio.happy_hour_config->>'hora_fin', '18:00') THEN
      v_hh_activo := true;
      v_hh_mult := greatest(2, coalesce((v_negocio.happy_hour_config->>'multiplicador')::int, 2));
      IF p_cantidad = 1 THEN
        v_cantidad_efectiva := v_hh_mult;
      END IF;
    END IF;
  END IF;

  -- Si es la primera visita y fue referido, sumar bono invitado si corresponde
  IF v_negocio.referidos_activo
     AND v_cliente.referido_por_cliente_id IS NOT NULL
     AND v_cliente.referido_por_cliente_id <> v_cliente.id
     AND v_cliente.referido_recompensado = false THEN
    v_ref_invitador_sellos := greatest(1, coalesce(v_negocio.referidos_sellos_invitador, 1));
    v_ref_invitado_sellos := greatest(0, coalesce(v_negocio.referidos_sellos_invitado, 1));
    v_referidor_recompensado_id := v_cliente.referido_por_cliente_id;
  END IF;

  v_nuevo_total := least(v_cartilla.sellos_objetivo, v_cartilla.sellos_actuales + v_cantidad_efectiva + v_ref_invitado_sellos);
  v_nuevo_historico := v_cartilla.sellos_historicos + v_cantidad_efectiva + v_ref_invitado_sellos;
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
    v_cantidad_efectiva, 'visita',
    CASE WHEN v_hh_activo THEN p_detalle || ' (Hora Feliz 2x)' ELSE p_detalle END,
    v_key
  )
  RETURNING id INTO v_sello_id;

  IF v_ref_invitado_sellos > 0 THEN
    INSERT INTO public.sellos (
      negocio_id, sede_id, cliente_id, cartilla_id, cajero_id, dispositivo_id,
      cantidad, tipo, detalle, idempotency_key
    ) VALUES (
      p_negocio_id, p_sede_id, p_cliente_id, v_cartilla.id, p_cajero_id, p_dispositivo_id,
      v_ref_invitado_sellos, 'referido', 'Bono bienvenida por invitación de amigo',
      'ref-guest-' || v_cliente.id::text
    )
    ON CONFLICT (negocio_id, idempotency_key) DO NOTHING;
  END IF;

  UPDATE public.cartillas
  SET sellos_actuales = v_nuevo_total,
      sellos_historicos = v_nuevo_historico,
      nivel = v_nuevo_nivel,
      premio_disponible = v_premio_listo,
      updated_at = now()
  WHERE id = v_cartilla.id
  RETURNING * INTO v_cartilla;

  UPDATE public.clientes
  SET total_visitas = total_visitas + 1,
      ultima_visita_at = now(),
      referido_recompensado = CASE WHEN v_referidor_recompensado_id IS NOT NULL THEN true ELSE referido_recompensado END,
      updated_at = now()
  WHERE id = p_cliente_id;

  -- Acreditar premio al invitador tras la primera visita real del amigo
  IF v_referidor_recompensado_id IS NOT NULL THEN
    SELECT * INTO v_ref_cartilla
    FROM public.cartillas
    WHERE negocio_id = p_negocio_id AND cliente_id = v_referidor_recompensado_id
    FOR UPDATE;

    IF FOUND THEN
      INSERT INTO public.sellos (
        negocio_id, sede_id, cliente_id, cartilla_id, cajero_id, dispositivo_id,
        cantidad, tipo, detalle, idempotency_key
      ) VALUES (
        p_negocio_id, p_sede_id, v_referidor_recompensado_id, v_ref_cartilla.id, p_cajero_id, p_dispositivo_id,
        v_ref_invitador_sellos, 'referido',
        '¡Referido exitoso! Primera visita de ' || v_cliente.nombre,
        'ref-host-' || v_cliente.id::text
      )
      ON CONFLICT (negocio_id, idempotency_key) DO NOTHING;

      UPDATE public.cartillas
      SET sellos_actuales = least(sellos_objetivo, sellos_actuales + v_ref_invitador_sellos),
          sellos_historicos = sellos_historicos + v_ref_invitador_sellos,
          premio_disponible = (least(sellos_objetivo, sellos_actuales + v_ref_invitador_sellos) >= sellos_objetivo),
          updated_at = now()
      WHERE id = v_ref_cartilla.id;

      UPDATE public.clientes
      SET total_referidos_exitosos = total_referidos_exitosos + 1,
          updated_at = now()
      WHERE id = v_referidor_recompensado_id;

      PERFORM public.encolar_outbox(
        p_negocio_id,
        'referido_completado',
        jsonb_build_object(
          'invitador_id', v_referidor_recompensado_id,
          'invitado_id', p_cliente_id,
          'invitado_nombre', v_cliente.nombre,
          'sellos_otorgados', v_ref_invitador_sellos
        )
      );
    END IF;
  END IF;

  INSERT INTO public.auditoria_seguridad (negocio_id, sede_id, actor_id, dispositivo_id, accion, detalle)
  VALUES (p_negocio_id, p_sede_id, p_cajero_id, p_dispositivo_id, 'dar_sello',
    jsonb_build_object('cliente_id', p_cliente_id, 'sello_id', v_sello_id, 'sellos_actuales', v_nuevo_total, 'happy_hour', v_hh_activo));

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

  RETURN jsonb_build_object(
    'duplicado', false,
    'sello_id', v_sello_id,
    'happy_hour_aplicado', v_hh_activo,
    'cantidad_otorgada', v_cantidad_efectiva,
    'referidor_id', v_referidor_recompensado_id,
    'cartilla', to_jsonb(v_cartilla)
  );
END;
$$;
