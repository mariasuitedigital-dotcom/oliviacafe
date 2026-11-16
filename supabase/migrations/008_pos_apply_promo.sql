-- ============================================================================
-- MIGRACIÓN 008: APLICAR Y CANJEAR PROMOCIONES DIRECTAMENTE DESDE CAJA POS
-- ============================================================================

-- 1. Listar promociones activas de un negocio para la terminal POS
CREATE OR REPLACE FUNCTION public.listar_promociones_caja(
  p_negocio_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promos JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(p ORDER BY p.vigencia_fin ASC), '[]'::jsonb)
  INTO v_promos
  FROM public.promociones p
  WHERE p.negocio_id = p_negocio_id
    AND p.activa = true
    AND p.vigencia_fin > now()
    AND (p.stock_total IS NULL OR p.stock_usado < p.stock_total);

  RETURN v_promos;
END;
$$;

-- 2. Aplicar una promoción directamente a un cliente desde Caja POS (atomiza activación + canje + sellos extra)
CREATE OR REPLACE FUNCTION public.aplicar_promo_caja(
  p_negocio_id UUID,
  p_sede_id UUID,
  p_cliente_id UUID,
  p_promocion_id UUID,
  p_cajero_id UUID,
  p_dispositivo_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo public.promociones%ROWTYPE;
  v_cupon public.cupones%ROWTYPE;
  v_cartilla public.cartillas%ROWTYPE;
  v_usos INT;
  v_codigo TEXT;
  v_idem TEXT;
BEGIN
  v_idem := coalesce(nullif(trim(p_idempotency_key), ''), 'pos-promo-' || gen_random_uuid()::text);

  IF EXISTS (SELECT 1 FROM public.sellos WHERE idempotency_key = v_idem) THEN
    SELECT * INTO v_cartilla
    FROM public.cartillas
    WHERE negocio_id = p_negocio_id AND cliente_id = p_cliente_id;
    RETURN jsonb_build_object(
      'duplicado', true,
      'cartilla', to_jsonb(v_cartilla)
    );
  END IF;

  SELECT * INTO v_promo
  FROM public.promociones
  WHERE id = p_promocion_id
    AND negocio_id = p_negocio_id
    AND activa = true
  FOR UPDATE;

  IF NOT FOUND OR v_promo.vigencia_fin < now() THEN
    RAISE EXCEPTION 'Promoción no disponible o expirada';
  END IF;

  IF v_promo.stock_total IS NOT NULL AND v_promo.stock_usado >= v_promo.stock_total THEN
    RAISE EXCEPTION 'Stock agotado para esta promoción';
  END IF;

  -- Si el cliente ya había activado un cupón para esta promo y sigue activo, lo canjeamos directamente
  SELECT * INTO v_cupon
  FROM public.cupones
  WHERE negocio_id = p_negocio_id
    AND promocion_id = p_promocion_id
    AND cliente_id = p_cliente_id
    AND estado = 'activo'
    AND expira_at > now()
  ORDER BY activado_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.cupones
    SET estado = 'canjeado',
        canjeado_at = now(),
        sede_canje_id = p_sede_id,
        cajero_canje_id = p_cajero_id,
        dispositivo_canje_id = p_dispositivo_id
    WHERE id = v_cupon.id
    RETURNING * INTO v_cupon;
  ELSE
    SELECT count(*) INTO v_usos
    FROM public.cupones
    WHERE promocion_id = p_promocion_id
      AND cliente_id = p_cliente_id
      AND estado IN ('activo', 'canjeado');

    IF v_usos >= v_promo.limite_por_cliente THEN
      RAISE EXCEPTION 'El cliente ya alcanzó el límite de uso (%) para esta promoción.', v_promo.limite_por_cliente;
    END IF;

    v_codigo := 'CUP-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));

    INSERT INTO public.cupones (
      negocio_id, promocion_id, cliente_id, codigo_qr,
      estado, expira_at, canjeado_at,
      sede_canje_id, cajero_canje_id, dispositivo_canje_id
    ) VALUES (
      p_negocio_id, p_promocion_id, p_cliente_id, v_codigo,
      'canjeado', v_promo.vigencia_fin, now(),
      p_sede_id, p_cajero_id, p_dispositivo_id
    )
    RETURNING * INTO v_cupon;
  END IF;

  UPDATE public.promociones
  SET stock_usado = stock_usado + 1
  WHERE id = v_promo.id;

  SELECT * INTO v_cartilla
  FROM public.cartillas
  WHERE negocio_id = p_negocio_id AND cliente_id = p_cliente_id
  FOR UPDATE;

  IF v_promo.sellos_extra > 0 THEN
    INSERT INTO public.sellos (
      negocio_id, sede_id, cliente_id, cartilla_id, cajero_id, dispositivo_id,
      cantidad, tipo, detalle, idempotency_key
    ) VALUES (
      p_negocio_id, p_sede_id, p_cliente_id, v_cartilla.id, p_cajero_id, p_dispositivo_id,
      v_promo.sellos_extra, 'promo', 'Promo POS: ' || v_promo.titulo, v_idem
    );

    UPDATE public.cartillas
    SET sellos_actuales = least(sellos_objetivo, sellos_actuales + v_promo.sellos_extra),
        sellos_historicos = sellos_historicos + v_promo.sellos_extra,
        premio_disponible = (least(sellos_objetivo, sellos_actuales + v_promo.sellos_extra) >= sellos_objetivo),
        updated_at = now()
    WHERE id = v_cartilla.id
    RETURNING * INTO v_cartilla;
  END IF;

  INSERT INTO public.auditoria_seguridad (negocio_id, actor_id, dispositivo_id, accion, metadata)
  VALUES (
    p_negocio_id,
    p_cajero_id,
    p_dispositivo_id,
    'aplicar_promo_caja',
    jsonb_build_object(
      'promocion_id', p_promocion_id,
      'cupon_id', v_cupon.id,
      'cliente_id', p_cliente_id,
      'sellos_extra', v_promo.sellos_extra
    )
  );

  PERFORM public.encolar_outbox(
    p_negocio_id,
    'cupon_canjeado',
    jsonb_build_object(
      'cliente_id', p_cliente_id,
      'cupon_id', v_cupon.id,
      'promocion_titulo', v_promo.titulo,
      'sellos_extra', v_promo.sellos_extra
    )
  );

  RETURN jsonb_build_object(
    'cupon', to_jsonb(v_cupon),
    'promocion', to_jsonb(v_promo),
    'cartilla', to_jsonb(v_cartilla)
  );
END;
$$;
