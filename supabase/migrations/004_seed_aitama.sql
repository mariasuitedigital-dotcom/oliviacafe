-- ============================================================================
-- FASE 1: DATOS DEMO INICIALES — OLIVIA CAFÉ (PERÚ)
-- ============================================================================

INSERT INTO public.negocios (
  id, slug, nombre, subtitulo, color_primario, color_secundario, color_terciario, color_neutro,
  zona_horaria, google_maps_url, otp_requerido_login, otp_requerido_canje,
  sellos_para_premio, nombre_premio, intervalo_minimo_sellos_min, evolution_instance_name, whatsapp_contacto_numero
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'olivia',
  'Olivia Café',
  'Café de Especialidad & Pastelería Artesanal',
  '#0F4C45',
  '#F2B632',
  '#DCE3DE',
  '#14201E',
  'America/Lima',
  'https://maps.google.com/?q=Olivia+Cafe+Miraflores+Lima',
  false, -- Modo sin SMS OTP al registrar para ahorrar costos
  true,  -- Verificación al canjear premio
  10,
  'Café de Especialidad o Postre de la Vitrina',
  30,
  'olivia-lima-wa',
  '+51987111222'
) ON CONFLICT (slug) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  subtitulo = EXCLUDED.subtitulo,
  evolution_instance_name = EXCLUDED.evolution_instance_name;

-- Sedes
INSERT INTO public.sedes (id, negocio_id, nombre, direccion, telefono) VALUES
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'Local Principal · Miraflores', 'Av. La Mar 1240, Miraflores, Lima', '+51 1 445 8920'),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Barra Express · San Isidro', 'Calle Miguel Dasso 185, San Isidro, Lima', '+51 1 422 3310')
ON CONFLICT (id) DO NOTHING;

-- Dispositivo Caja POS demo (código de emparejamiento inicial: OLIVIA-CAJA-01)
INSERT INTO public.dispositivos (id, negocio_id, sede_id, nombre, codigo_emparejamiento, emparejado) VALUES
  ('33333333-3333-4333-8333-333333333331', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'Caja 01 · Barra Miraflores', 'OLIVIA-CAJA-01', true),
  ('33333333-3333-4333-8333-333333333332', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Caja 02 · San Isidro', 'OLIVIA-CAJA-02', false)
ON CONFLICT (id) DO NOTHING;

-- Automatizaciones iniciales por negocio
INSERT INTO public.automatizaciones (negocio_id, tipo, nombre_visible, activo, canal, plantilla) VALUES
  ('11111111-1111-4111-8111-111111111111', 'bienvenida', 'Bienvenida al Club', true, 'whatsapp', '¡Hola {nombre}! Bienvenido a Olivia Café ☕ Ya tienes 1 sello de bienvenida. Mira tu cartilla aquí: {url}. Responde BAJA para no recibir más.'),
  ('11111111-1111-4111-8111-111111111111', 'casi_premio', 'A 1 sello del premio', true, 'push', '¡{nombre}, te falta solo {falta} sello para tu {premio} gratis en Olivia Café!'),
  ('11111111-1111-4111-8111-111111111111', 'premio_listo', 'Premio listo para canjear', true, 'whatsapp', '🎉 ¡Felicidades, {nombre}! Completaste {sellos} sellos. Tu {premio} te espera en Olivia Café. Responde BAJA para no recibir más.'),
  ('11111111-1111-4111-8111-111111111111', 'cumpleanos', 'Regalo de Cumpleaños', true, 'whatsapp', '🎂 ¡Feliz cumpleaños, {nombre}! Pasa por Olivia Café esta semana y disfruta una porción de tarta artesanal gratis. Responde BAJA para no recibir más.'),
  ('11111111-1111-4111-8111-111111111111', 'reactivacion_15', 'Reactivación 15 días sin visita', true, 'whatsapp', '¡Te extrañamos, {nombre}! Llevas {sellos} sellos en tu cartilla de Olivia Café. Vuelve esta semana por tu café de especialidad. Responde BAJA para no recibir más.'),
  ('11111111-1111-4111-8111-111111111111', 'encuesta_visita', 'Encuesta 2h post-visita (desde 3er sello)', true, 'whatsapp', 'Hola {nombre}, ¿cómo estuvo tu café hoy en Olivia Café? Responde del 1 al 5 ⭐. Responde BAJA para no recibir más.')
ON CONFLICT (negocio_id, tipo) DO NOTHING;

-- Promociones activas demo
INSERT INTO public.promociones (negocio_id, titulo, descripcion, precio_especial, precio_regular, sellos_extra, vigencia_fin, limite_por_cliente, audiencia, canal) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Flat White + Croissant de Mantequilla', 'Combo exclusivo de mañana para miembros del club. Incluye 2 sellos en tu cartilla.', 18.90, 26.00, 2, now() + interval '30 days', 2, 'todos', 'push'),
  ('11111111-1111-4111-8111-111111111111', 'Cold Brew Citron de Tarde', 'Extracción en frío 18h con naranja orgánica de Chanchamayo.', 12.50, 17.00, 1, now() + interval '15 days', 1, 'frecuentes', 'ambos')
ON CONFLICT DO NOTHING;
