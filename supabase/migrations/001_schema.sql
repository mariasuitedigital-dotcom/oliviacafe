-- ============================================================================
-- FASE 1: ESQUEMA COMPLETO MULTI-NEGOCIO (AITAMA LEALTAD SAAS)
-- ============================================================================
-- Principios:
-- 1. Todas las tablas operativas incluyen negocio_id para aislamiento multi-tenant.
-- 2. Índices optimizados para consultas de caja POS (<50ms) y campañas por lotes.
-- 3. Vista v_clientes_caja con celular enmascarado para cajeros.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- ENUMS DE DOMINIO
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.rol_usuario AS ENUM ('customer', 'cashier', 'owner', 'superadmin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nivel_lealtad AS ENUM ('Bambú', 'Plata', 'Oro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_sello AS ENUM ('visita', 'bienvenida', 'instalacion_pwa', 'promo', 'referido', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.estado_cupon AS ENUM ('activo', 'canjeado', 'expirado', 'anulado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.canal_mensaje AS ENUM ('push', 'whatsapp', 'ambos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.estado_campana AS ENUM ('borrador', 'programada', 'procesando', 'completada', 'fallida', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.estado_outbox AS ENUM ('pendiente', 'procesando', 'enviado', 'fallido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 1. NEGOCIOS (Tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.negocios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  subtitulo TEXT DEFAULT 'Club de Lealtad',
  logo_url TEXT,
  color_primario TEXT NOT NULL DEFAULT '#0F4C45',
  color_secundario TEXT NOT NULL DEFAULT '#F2B632',
  color_terciario TEXT NOT NULL DEFAULT '#DCE3DE',
  color_neutro TEXT NOT NULL DEFAULT '#14201E',
  zona_horaria TEXT NOT NULL DEFAULT 'America/Lima',
  texto_privacidad TEXT NOT NULL DEFAULT 'De conformidad con la Ley N° 29733 (Ley de Protección de Datos Personales del Perú), tus datos serán tratados únicamente para gestionar tu cartilla de lealtad y enviarte beneficios autorizados.',
  url_privacidad TEXT DEFAULT '/privacidad',
  google_maps_url TEXT,
  otp_requerido_login BOOLEAN NOT NULL DEFAULT false,
  otp_requerido_canje BOOLEAN NOT NULL DEFAULT true,
  sellos_para_premio INT NOT NULL DEFAULT 10 CHECK (sellos_para_premio BETWEEN 3 AND 30),
  nombre_premio TEXT NOT NULL DEFAULT 'Café de Especialidad o Postre de la Vitrina',
  intervalo_minimo_sellos_min INT NOT NULL DEFAULT 30 CHECK (intervalo_minimo_sellos_min >= 0),
  niveles_config JSONB NOT NULL DEFAULT '[
    {"nombre": "Bambú", "min_sellos_historicos": 0, "beneficio": "1 sello por visita"},
    {"nombre": "Plata", "min_sellos_historicos": 15, "beneficio": "Regalo doble en cumpleaños"},
    {"nombre": "Oro", "min_sellos_historicos": 35, "beneficio": "Acceso anticipado a catas y promos"}
  ]'::jsonb,
  evolution_instance_name TEXT,
  evolution_status TEXT NOT NULL DEFAULT 'disconnected',
  whatsapp_contacto_numero TEXT DEFAULT '+51987111222',
  whatsapp_limite_diario INT NOT NULL DEFAULT 150,
  horario_envio_inicio TIME NOT NULL DEFAULT '09:00:00',
  horario_envio_fin TIME NOT NULL DEFAULT '20:00:00',
  webhook_n8n_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. SEDES (Sucursales por negocio)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sedes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sedes_negocio ON public.sedes(negocio_id);

-- ----------------------------------------------------------------------------
-- 3. PERFILES (Staff / Usuarios autenticados - Rol sincronizado en app_metadata)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  rol public.rol_usuario NOT NULL DEFAULT 'customer',
  nombre_completo TEXT NOT NULL,
  email TEXT,
  pin_hash TEXT, -- Hash bcrypt (crypt) de PIN 4-6 dígitos para cajeros POS
  pin_intentos_fallidos INT NOT NULL DEFAULT 0,
  pin_bloqueado_hasta TIMESTAMPTZ,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_perfiles_negocio_rol ON public.perfiles(negocio_id, rol);

-- ----------------------------------------------------------------------------
-- 4. DISPOSITIVOS (Cajas POS vinculadas por código de emparejamiento)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispositivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL, -- ej. "Caja 01 · Barra"
  codigo_emparejamiento TEXT NOT NULL,
  emparejado BOOLEAN NOT NULL DEFAULT false,
  device_secret_hash TEXT,
  user_agent TEXT,
  ultimo_acceso_at TIMESTAMPTZ,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(negocio_id, codigo_emparejamiento)
);
CREATE INDEX IF NOT EXISTS idx_dispositivos_negocio ON public.dispositivos(negocio_id, sede_id);

-- ----------------------------------------------------------------------------
-- 5. CLIENTES (Consumidores finales por negocio)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  celular TEXT NOT NULL CHECK (celular ~ '^\+519[0-9]{8}$'), -- Formato Perú +519XXXXXXXX
  fecha_nacimiento_dia SMALLINT CHECK (fecha_nacimiento_dia BETWEEN 1 AND 31),
  fecha_nacimiento_mes SMALLINT CHECK (fecha_nacimiento_mes BETWEEN 1 AND 12),
  fecha_nacimiento_anio SMALLINT CHECK (fecha_nacimiento_anio IS NULL OR fecha_nacimiento_anio BETWEEN 1920 AND 2020),
  consentimiento_whatsapp BOOLEAN NOT NULL DEFAULT false,
  consentimiento_push BOOLEAN NOT NULL DEFAULT false,
  contacto_guardado BOOLEAN NOT NULL DEFAULT false,
  fecha_consentimiento TIMESTAMPTZ,
  version_consentimiento TEXT DEFAULT 'v1.0-pe-29733',
  baja_whatsapp BOOLEAN NOT NULL DEFAULT false,
  fecha_baja TIMESTAMPTZ,
  origen_registro TEXT DEFAULT 'qr_mesa',
  total_visitas INT NOT NULL DEFAULT 0,
  ultima_visita_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(negocio_id, celular)
);
CREATE INDEX IF NOT EXISTS idx_clientes_negocio_celular ON public.clientes(negocio_id, celular);
CREATE INDEX IF NOT EXISTS idx_clientes_user ON public.clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_cumple ON public.clientes(negocio_id, fecha_nacimiento_mes, fecha_nacimiento_dia);

-- Vista segura para Caja POS: enmascara el celular (987 *** 321) y oculta datos sensibles
CREATE OR REPLACE VIEW public.v_clientes_caja AS
SELECT
  c.id,
  c.negocio_id,
  c.nombre,
  regexp_replace(c.celular, '^\+51([0-9]{3})[0-9]{3}([0-9]{3})$', '\1 *** \2') AS celular_enmascarado,
  right(c.celular, 9) AS celular_ultimos_9_solo_match, -- usado internamente por RPC
  c.total_visitas,
  c.ultima_visita_at
FROM public.clientes c;

-- ----------------------------------------------------------------------------
-- 6. CARTILLAS (Estado de lealtad por cliente y negocio)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cartillas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  codigo_corto TEXT NOT NULL, -- ej. "#AI-8942"
  sellos_actuales INT NOT NULL DEFAULT 0 CHECK (sellos_actuales >= 0),
  sellos_objetivo INT NOT NULL DEFAULT 10 CHECK (sellos_objetivo >= 1),
  nivel public.nivel_lealtad NOT NULL DEFAULT 'Bambú',
  sellos_historicos INT NOT NULL DEFAULT 0,
  canjes_historicos INT NOT NULL DEFAULT 0,
  puntos_bonus INT NOT NULL DEFAULT 0, -- ej. +10 pts por reseña Google Maps
  premio_disponible BOOLEAN NOT NULL DEFAULT false,
  bonus_instalacion_otorgado BOOLEAN NOT NULL DEFAULT false,
  qr_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(negocio_id, cliente_id),
  UNIQUE(negocio_id, codigo_corto)
);
CREATE INDEX IF NOT EXISTS idx_cartillas_negocio_cliente ON public.cartillas(negocio_id, cliente_id);

-- ----------------------------------------------------------------------------
-- 7. QR TOKENS (Tokens rotativos de 30s generados en servidor)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expira_at TIMESTAMPTZ NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_lookup ON public.qr_tokens(token, expira_at);

-- ----------------------------------------------------------------------------
-- 8. SELLOS (Libro contable inmutable de sellos otorgados)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sellos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  cartilla_id UUID NOT NULL REFERENCES public.cartillas(id) ON DELETE CASCADE,
  cajero_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  dispositivo_id UUID REFERENCES public.dispositivos(id) ON DELETE SET NULL,
  cantidad INT NOT NULL DEFAULT 1 CHECK (cantidad BETWEEN 1 AND 10),
  tipo public.tipo_sello NOT NULL DEFAULT 'visita',
  detalle TEXT DEFAULT 'Consumo en local',
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(negocio_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_sellos_negocio_fecha ON public.sellos(negocio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sellos_cliente ON public.sellos(cliente_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 9. CANJES (Historial inmutable de recompensas entregadas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.canjes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  cartilla_id UUID NOT NULL REFERENCES public.cartillas(id) ON DELETE CASCADE,
  cajero_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  dispositivo_id UUID REFERENCES public.dispositivos(id) ON DELETE SET NULL,
  premio_entregado TEXT NOT NULL,
  sellos_consumidos INT NOT NULL,
  verificado_otp BOOLEAN NOT NULL DEFAULT false,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(negocio_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_canjes_negocio_fecha ON public.canjes(negocio_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 10. PUSH SUBSCRIPTIONS (Web Push VAPID por dispositivo de cliente)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Lima',
  user_agent TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_negocio_enabled ON public.push_subscriptions(negocio_id, enabled);
CREATE INDEX IF NOT EXISTS idx_push_subs_cliente ON public.push_subscriptions(cliente_id);

-- ----------------------------------------------------------------------------
-- 11. PROMOCIONES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.promociones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  precio_especial NUMERIC(10, 2) NOT NULL CHECK (precio_especial >= 0),
  precio_regular NUMERIC(10, 2),
  sellos_extra INT NOT NULL DEFAULT 1 CHECK (sellos_extra >= 0),
  imagen_url TEXT,
  vigencia_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  vigencia_fin TIMESTAMPTZ NOT NULL,
  limite_por_cliente INT NOT NULL DEFAULT 1 CHECK (limite_por_cliente >= 1),
  stock_total INT,
  stock_usado INT NOT NULL DEFAULT 0,
  audiencia TEXT NOT NULL DEFAULT 'todos', -- todos | frecuentes | inactivos_15 | cumpleanos | nivel_oro | falta_1
  canal public.canal_mensaje NOT NULL DEFAULT 'push',
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promociones_negocio_activas ON public.promociones(negocio_id, activa, vigencia_fin);

-- ----------------------------------------------------------------------------
-- 12. CUPONES (Cupones activados por cliente con QR único)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cupones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  promocion_id UUID NOT NULL REFERENCES public.promociones(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  codigo_qr TEXT NOT NULL UNIQUE,
  estado public.estado_cupon NOT NULL DEFAULT 'activo',
  activado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_at TIMESTAMPTZ NOT NULL,
  canjeado_at TIMESTAMPTZ,
  sede_canje_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  cajero_canje_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  dispositivo_canje_id UUID REFERENCES public.dispositivos(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_cupones_cliente_promo ON public.cupones(cliente_id, promocion_id);
CREATE INDEX IF NOT EXISTS idx_cupones_codigo ON public.cupones(codigo_qr);

-- ----------------------------------------------------------------------------
-- 13. CAMPAÑAS (Envíos programados y procesamiento por lotes max 50)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campanas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  promocion_id UUID REFERENCES public.promociones(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  segmento TEXT NOT NULL DEFAULT 'todos',
  canal public.canal_mensaje NOT NULL DEFAULT 'push',
  titulo_push TEXT,
  mensaje_plantilla TEXT NOT NULL,
  fecha_programada TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado public.estado_campana NOT NULL DEFAULT 'programada',
  lote_actual INT NOT NULL DEFAULT 0,
  total_objetivo INT NOT NULL DEFAULT 0,
  total_enviados INT NOT NULL DEFAULT 0,
  total_entregados INT NOT NULL DEFAULT 0,
  total_abiertos INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campanas_pendientes ON public.campanas(estado, fecha_programada);

-- ----------------------------------------------------------------------------
-- 14. AUTOMATIZACIONES (Flujos configurables por negocio)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automatizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- bienvenida | casi_premio | premio_listo | cumpleanos | reactivacion_15 | reactivacion_30 | reactivacion_45 | encuesta_visita | alerta_detractor
  nombre_visible TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  canal public.canal_mensaje NOT NULL DEFAULT 'whatsapp',
  plantilla TEXT NOT NULL,
  horario_inicio TIME NOT NULL DEFAULT '09:00:00',
  horario_fin TIME NOT NULL DEFAULT '20:00:00',
  limite_diario INT NOT NULL DEFAULT 100,
  enviados_hoy INT NOT NULL DEFAULT 0,
  total_enviados INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(negocio_id, tipo)
);

-- ----------------------------------------------------------------------------
-- 15. MENSAJES LOG (Auditoría de envíos Push y WhatsApp)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mensajes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  campana_id UUID REFERENCES public.campanas(id) ON DELETE SET NULL,
  canal public.canal_mensaje NOT NULL,
  tipo_evento TEXT NOT NULL,
  destinatario TEXT,
  contenido TEXT,
  estado TEXT NOT NULL DEFAULT 'enviado', -- pendiente | enviado | entregado | abierto | fallido | baja
  respuesta_raw JSONB,
  error_mensaje TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mensajes_log_negocio ON public.mensajes_log(negocio_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 16. EVENTOS OUTBOX (Cola transaccional hacia n8n)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.eventos_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  payload JSONB NOT NULL,
  estado public.estado_outbox NOT NULL DEFAULT 'pendiente',
  intentos INT NOT NULL DEFAULT 0,
  max_intentos INT NOT NULL DEFAULT 5,
  proximo_reintento_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_outbox_pendientes ON public.eventos_outbox(estado, proximo_reintento_at);

-- ----------------------------------------------------------------------------
-- 17. ENCUESTAS (Satisfacción post-visita desde el 3er sello)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.encuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  sello_id UUID REFERENCES public.sellos(id) ON DELETE SET NULL,
  calificacion SMALLINT NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
  comentario TEXT,
  redirigido_maps BOOLEAN NOT NULL DEFAULT false,
  bonus_maps_otorgado BOOLEAN NOT NULL DEFAULT false,
  alerta_dueno_enviada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_encuestas_negocio ON public.encuestas(negocio_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 18. REFERIDOS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  referente_cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  referido_cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  codigo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  sellos_bonus INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(negocio_id, codigo)
);

-- ----------------------------------------------------------------------------
-- 19. AUDITORÍA DE SEGURIDAD Y ANTI-FRAUDE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auditoria_seguridad (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  dispositivo_id UUID REFERENCES public.dispositivos(id) ON DELETE SET NULL,
  accion TEXT NOT NULL,
  detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
  alerta_fraude BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_negocio ON public.auditoria_seguridad(negocio_id, created_at DESC);
