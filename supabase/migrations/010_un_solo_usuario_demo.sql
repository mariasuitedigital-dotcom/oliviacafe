-- ============================================================================
-- MIGRACIÓN 010: CREACIÓN DE 1 SOLO USUARIO DEMO (CLIENTE + CARTILLA + CAJERO)
-- ============================================================================
-- Permite probar el flujo completo:
-- 1. En /admin: Ver 1 cliente registrado (María Quispe) con sus sellos y visitas.
-- 2. En /caja: Buscar por "987654321" o "María Quispe" o "#OL-8942" y sumarle sellos.
-- 3. En /c/olivia: Probar la cartilla digital del cliente.
-- ============================================================================

-- 1. Ajustar políticas RLS para lectura en el panel de control y caja
DO $$
BEGIN
  -- Clientes
  DROP POLICY IF EXISTS "clientes_select_public_or_owner" ON public.clientes;
  CREATE POLICY "clientes_select_public_or_owner" ON public.clientes
    FOR SELECT USING (true);

  -- Cartillas
  DROP POLICY IF EXISTS "cartillas_select_public_or_owner" ON public.cartillas;
  CREATE POLICY "cartillas_select_public_or_owner" ON public.cartillas
    FOR SELECT USING (true);

  -- Sellos
  DROP POLICY IF EXISTS "sellos_select_public_or_owner" ON public.sellos;
  CREATE POLICY "sellos_select_public_or_owner" ON public.sellos
    FOR SELECT USING (true);
END $$;

-- 2. Insertar 1 solo cliente demo con su cartilla activa
DO $$
DECLARE
  v_negocio_id UUID;
  v_cliente_id UUID := 'aaaaaaaa-1111-4111-8111-111111111111';
  v_cartilla_id UUID := 'bbbbbbbb-1111-4111-8111-111111111111';
  v_sede_id UUID;
BEGIN
  -- Obtener el negocio Olivia
  SELECT id INTO v_negocio_id FROM public.negocios WHERE slug = 'olivia' LIMIT 1;

  IF v_negocio_id IS NULL THEN
    RAISE EXCEPTION 'El negocio Olivia no existe en la tabla negocios. Ejecuta primero la migración 004_seed_aitama.sql.';
  END IF;

  -- Obtener primera sede activa
  SELECT id INTO v_sede_id FROM public.sedes WHERE negocio_id = v_negocio_id AND activo = true LIMIT 1;

  -- 2.1 Crear el único cliente demo: María Quispe
  INSERT INTO public.clientes (
    id,
    negocio_id,
    nombre,
    celular,
    fecha_nacimiento_dia,
    fecha_nacimiento_mes,
    fecha_nacimiento_anio,
    consentimiento_whatsapp,
    consentimiento_push,
    contacto_guardado,
    total_visitas,
    ultima_visita_at
  ) VALUES (
    v_cliente_id,
    v_negocio_id,
    'María Quispe',
    '+51987654321',
    15,
    5,
    1995,
    true,
    true,
    true,
    6,
    now() - interval '1 day'
  )
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    celular = EXCLUDED.celular,
    total_visitas = EXCLUDED.total_visitas,
    ultima_visita_at = EXCLUDED.ultima_visita_at;

  -- 2.2 Crear su cartilla digital con 6 sellos de 10
  INSERT INTO public.cartillas (
    id,
    negocio_id,
    cliente_id,
    codigo_corto,
    sellos_actuales,
    sellos_objetivo,
    nivel,
    sellos_historicos,
    canjes_historicos,
    premio_disponible,
    bonus_instalacion_otorgado,
    qr_secret
  ) VALUES (
    v_cartilla_id,
    v_negocio_id,
    v_cliente_id,
    '#OL-8942',
    6,
    10,
    'Plata',
    16,
    1,
    false,
    true,
    'qr_secret_maria_quispe'
  )
  ON CONFLICT (id) DO UPDATE SET
    sellos_actuales = EXCLUDED.sellos_actuales,
    sellos_objetivo = EXCLUDED.sellos_objetivo,
    nivel = EXCLUDED.nivel,
    sellos_historicos = EXCLUDED.sellos_historicos,
    canjes_historicos = EXCLUDED.canjes_historicos;

  -- 2.3 Crear 1 sello en su historial de visitas
  INSERT INTO public.sellos (
    negocio_id,
    sede_id,
    cliente_id,
    cartilla_id,
    tipo,
    cantidad,
    detalle,
    idempotency_key,
    created_at
  ) VALUES (
    v_negocio_id,
    v_sede_id,
    v_cliente_id,
    v_cartilla_id,
    'visita',
    1,
    'Consumo en local · Demo',
    'demo-maria-sello-1',
    now() - interval '1 day'
  )
  ON CONFLICT (negocio_id, idempotency_key) DO NOTHING;

END $$;
