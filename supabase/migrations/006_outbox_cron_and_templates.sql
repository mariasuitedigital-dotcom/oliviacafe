-- ============================================================================
-- FASE 6: OUTBOX AUTOMATIONS, CUOTAS ANTI-SPAM Y CRON DIARIO (LIMA, PERÚ)
-- ============================================================================

-- 1. Verificar cuota diaria de WhatsApp y ventana horaria en zona del negocio
CREATE OR REPLACE FUNCTION public.verificar_cuota_whatsapp(p_negocio_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_negocio public.negocios%ROWTYPE;
  v_hora_local TIME;
  v_enviados_hoy INT;
  v_dentro_horario BOOLEAN;
BEGIN
  SELECT * INTO v_negocio FROM public.negocios WHERE id = p_negocio_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('disponible', false, 'motivo', 'negocio_no_encontrado');
  END IF;

  v_hora_local := (now() AT TIME ZONE coalesce(v_negocio.zona_horaria, 'America/Lima'))::time;
  v_dentro_horario := (v_hora_local BETWEEN v_negocio.horario_envio_inicio AND v_negocio.horario_envio_fin);

  SELECT count(*) INTO v_enviados_hoy
  FROM public.mensajes_log
  WHERE negocio_id = p_negocio_id
    AND canal IN ('whatsapp', 'ambos')
    AND estado IN ('enviado', 'entregado')
    AND (created_at AT TIME ZONE coalesce(v_negocio.zona_horaria, 'America/Lima'))::date =
        (now() AT TIME ZONE coalesce(v_negocio.zona_horaria, 'America/Lima'))::date;

  RETURN jsonb_build_object(
    'disponible', (v_dentro_horario AND v_enviados_hoy < v_negocio.whatsapp_limite_diario),
    'dentro_horario', v_dentro_horario,
    'enviados_hoy', v_enviados_hoy,
    'limite_diario', v_negocio.whatsapp_limite_diario,
    'restantes', greatest(0, v_negocio.whatsapp_limite_diario - v_enviados_hoy),
    'hora_local', v_hora_local::text
  );
END;
$$;

-- 2. Encolar cumpleaños del día y reactivaciones (15, 30 y 45 días sin visita)
CREATE OR REPLACE FUNCTION public.encolar_campanas_diarias()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cumples INT := 0;
  v_reactivaciones INT := 0;
  v_row RECORD;
  v_hoy DATE;
BEGIN
  FOR v_row IN
    SELECT n.id AS negocio_id, n.slug, n.nombre, n.nombre_premio, n.zona_horaria,
           c.id AS cliente_id, c.nombre AS cliente_nombre, c.celular,
           c.consentimiento_whatsapp, c.consentimiento_push, c.baja_whatsapp,
           car.sellos_actuales, car.sellos_objetivo
    FROM public.negocios n
    JOIN public.clientes c ON c.negocio_id = n.id
    JOIN public.cartillas car ON car.cliente_id = c.id AND car.negocio_id = n.id
    WHERE n.activo = true
      AND c.baja_whatsapp = false
      AND (c.consentimiento_whatsapp = true OR c.consentimiento_push = true)
      AND c.fecha_nacimiento_mes = extract(month FROM (now() AT TIME ZONE coalesce(n.zona_horaria, 'America/Lima')))::smallint
      AND c.fecha_nacimiento_dia = extract(day FROM (now() AT TIME ZONE coalesce(n.zona_horaria, 'America/Lima')))::smallint
  LOOP
    v_hoy := (now() AT TIME ZONE coalesce(v_row.zona_horaria, 'America/Lima'))::date;
    IF NOT EXISTS (
      SELECT 1 FROM public.eventos_outbox eo
      WHERE eo.negocio_id = v_row.negocio_id
        AND eo.tipo_evento = 'cumpleanos_hoy'
        AND eo.payload->>'cliente_id' = v_row.cliente_id::text
        AND (eo.created_at AT TIME ZONE coalesce(v_row.zona_horaria, 'America/Lima'))::date = v_hoy
    ) THEN
      PERFORM public.encolar_outbox(
        v_row.negocio_id,
        'cumpleanos_hoy',
        jsonb_build_object(
          'cliente_id', v_row.cliente_id,
          'nombre', v_row.cliente_nombre,
          'celular', v_row.celular,
          'sellos_actuales', v_row.sellos_actuales,
          'premio', v_row.nombre_premio,
          'negocio_slug', v_row.slug
        )
      );
      v_cumples := v_cumples + 1;
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT n.id AS negocio_id, n.slug, n.nombre, n.nombre_premio, n.zona_horaria,
           c.id AS cliente_id, c.nombre AS cliente_nombre, c.celular,
           car.sellos_actuales,
           extract(day FROM (now() - c.ultima_visita_at))::int AS dias_inactivo
    FROM public.negocios n
    JOIN public.clientes c ON c.negocio_id = n.id
    JOIN public.cartillas car ON car.cliente_id = c.id AND car.negocio_id = n.id
    WHERE n.activo = true
      AND c.baja_whatsapp = false
      AND (c.consentimiento_whatsapp = true OR c.consentimiento_push = true)
      AND c.ultima_visita_at IS NOT NULL
      AND extract(day FROM (now() - c.ultima_visita_at))::int IN (15, 30, 45)
  LOOP
    v_hoy := (now() AT TIME ZONE coalesce(v_row.zona_horaria, 'America/Lima'))::date;
    IF NOT EXISTS (
      SELECT 1 FROM public.eventos_outbox eo
      WHERE eo.negocio_id = v_row.negocio_id
        AND eo.tipo_evento = 'reactivacion_inactivos'
        AND eo.payload->>'cliente_id' = v_row.cliente_id::text
        AND (eo.created_at AT TIME ZONE coalesce(v_row.zona_horaria, 'America/Lima'))::date = v_hoy
    ) THEN
      PERFORM public.encolar_outbox(
        v_row.negocio_id,
        'reactivacion_inactivos',
        jsonb_build_object(
          'cliente_id', v_row.cliente_id,
          'nombre', v_row.cliente_nombre,
          'celular', v_row.celular,
          'sellos_actuales', v_row.sellos_actuales,
          'dias_inactivo', v_row.dias_inactivo,
          'premio', v_row.nombre_premio,
          'negocio_slug', v_row.slug
        )
      );
      v_reactivaciones := v_reactivaciones + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'cumpleanos_encolados', v_cumples,
    'reactivaciones_encoladas', v_reactivaciones
  );
END;
$$;

-- 3. Encolar encuestas 2 horas post-visita (clientes desde 3er sello histórico)
CREATE OR REPLACE FUNCTION public.encolar_encuestas_pendientes()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT DISTINCT ON (s.cliente_id)
           s.negocio_id, s.id AS sello_id, s.cliente_id,
           c.nombre AS cliente_nombre, c.celular,
           car.sellos_actuales, n.slug AS negocio_slug
    FROM public.sellos s
    JOIN public.clientes c ON c.id = s.cliente_id
    JOIN public.cartillas car ON car.id = s.cartilla_id
    JOIN public.negocios n ON n.id = s.negocio_id
    WHERE n.activo = true
      AND s.tipo = 'visita'
      AND car.sellos_historicos >= 3
      AND s.created_at BETWEEN (now() - interval '4 hours') AND (now() - interval '2 hours')
      AND NOT EXISTS (
        SELECT 1 FROM public.encuestas e
        WHERE e.cliente_id = s.cliente_id
          AND e.created_at > now() - interval '7 days'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.eventos_outbox eo
        WHERE eo.negocio_id = s.negocio_id
          AND eo.tipo_evento = 'encuesta_visita'
          AND eo.payload->>'sello_id' = s.id::text
      )
  LOOP
    PERFORM public.encolar_outbox(
      v_row.negocio_id,
      'encuesta_visita',
      jsonb_build_object(
        'sello_id', v_row.sello_id,
        'cliente_id', v_row.cliente_id,
        'nombre', v_row.cliente_nombre,
        'celular', v_row.celular,
        'sellos_actuales', v_row.sellos_actuales,
        'negocio_slug', v_row.negocio_slug
      )
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 4. Registro opcional de pg_cron (si las extensiones pg_cron y pg_net están habilitadas en Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('olivia-campanas-diarias')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'olivia-campanas-diarias');

    PERFORM cron.schedule(
      'olivia-campanas-diarias',
      '0 15 * * *', -- 10:00 AM America/Lima (UTC-5)
      $$SELECT public.encolar_campanas_diarias();$$
    );

    PERFORM cron.unschedule('olivia-encuestas-2h')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'olivia-encuestas-2h');

    PERFORM cron.schedule(
      'olivia-encuestas-2h',
      '*/30 * * * *', -- Cada 30 min revisa visitas de hace 2 horas
      $$SELECT public.encolar_encuestas_pendientes();$$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
