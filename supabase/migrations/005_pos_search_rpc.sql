-- ============================================================================
-- FASE 3: RPCs DE CAJA POS (BÚSQUEDA ENMASCARADA Y VALIDACIÓN DE CUPÓN)
-- ============================================================================
-- Garantiza que el cajero NUNCA acceda a datos de contacto completos ni
-- estadísticas del negocio. Devuelve únicamente celular enmascarado y estado
-- de cartilla.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.buscar_cliente_caja(
  p_negocio_id UUID,
  p_query TEXT DEFAULT NULL,
  p_cliente_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean TEXT := regexp_replace(coalesce(p_query, ''), '\D', '', 'g');
  v_cliente RECORD;
  v_cartilla public.cartillas%ROWTYPE;
BEGIN
  IF p_cliente_id IS NOT NULL THEN
    SELECT id, negocio_id, nombre, celular_enmascarado, total_visitas, ultima_visita_at
    INTO v_cliente
    FROM public.v_clientes_caja
    WHERE negocio_id = p_negocio_id AND id = p_cliente_id
    LIMIT 1;
  ELSIF length(v_clean) = 9 THEN
    SELECT id, negocio_id, nombre, celular_enmascarado, total_visitas, ultima_visita_at
    INTO v_cliente
    FROM public.v_clientes_caja
    WHERE negocio_id = p_negocio_id AND celular_ultimos_9_solo_match = v_clean
    LIMIT 1;
  ELSIF coalesce(p_query, '') <> '' THEN
    SELECT v.id, v.negocio_id, v.nombre, v.celular_enmascarado, v.total_visitas, v.ultima_visita_at
    INTO v_cliente
    FROM public.v_clientes_caja v
    JOIN public.cartillas ca ON ca.cliente_id = v.id AND ca.negocio_id = v.negocio_id
    WHERE v.negocio_id = p_negocio_id
      AND upper(ca.codigo_corto) = upper(trim(p_query))
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;

  SELECT * INTO v_cartilla
  FROM public.cartillas
  WHERE negocio_id = p_negocio_id AND cliente_id = v_cliente.id
  LIMIT 1;

  RETURN jsonb_build_object(
    'encontrado', true,
    'cliente', jsonb_build_object(
      'id', v_cliente.id,
      'negocio_id', v_cliente.negocio_id,
      'nombre', v_cliente.nombre,
      'celular_enmascarado', v_cliente.celular_enmascarado,
      'total_visitas', v_cliente.total_visitas,
      'ultima_visita_at', v_cliente.ultima_visita_at
    ),
    'cartilla', to_jsonb(v_cartilla)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buscar_cupon_caja(
  p_negocio_id UUID,
  p_codigo_qr TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupon public.cupones%ROWTYPE;
  v_promo public.promociones%ROWTYPE;
  v_cliente RECORD;
BEGIN
  SELECT * INTO v_cupon
  FROM public.cupones
  WHERE negocio_id = p_negocio_id AND upper(codigo_qr) = upper(trim(p_codigo_qr))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;

  SELECT * INTO v_promo FROM public.promociones WHERE id = v_cupon.promocion_id;
  SELECT nombre, celular_enmascarado INTO v_cliente
  FROM public.v_clientes_caja
  WHERE id = v_cupon.cliente_id;

  RETURN jsonb_build_object(
    'encontrado', true,
    'cupon', to_jsonb(v_cupon),
    'promocion', to_jsonb(v_promo),
    'cliente_nombre', coalesce(v_cliente.nombre, 'Cliente'),
    'celular_enmascarado', coalesce(v_cliente.celular_enmascarado, '***')
  );
END;
$$;
