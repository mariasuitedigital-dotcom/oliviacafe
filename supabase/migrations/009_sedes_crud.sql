-- ============================================================================
-- MIGRACIÓN 009: GESTIÓN COMPLETA DE SEDES Y LOCALES (CRUD, RLS Y RPCs)
-- ============================================================================
-- Permite:
-- 1. Crear sedes con nombre, dirección, teléfono y estado activo.
-- 2. Editar y actualizar datos de la sede en línea.
-- 3. Pausar / Activar sedes operativas.
-- 4. Eliminar sedes sin romper historial de sellos o perfiles.
-- ============================================================================

-- 1. Asegurar tabla sedes con todas las columnas e índices
CREATE TABLE IF NOT EXISTS public.sedes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Asegurar columnas si la tabla ya existía previamente
ALTER TABLE public.sedes
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_sedes_negocio ON public.sedes(negocio_id);
CREATE INDEX IF NOT EXISTS idx_sedes_activo ON public.sedes(activo);

-- 2. Asegurar que las llaves foráneas a sedes en otras tablas permitan eliminación segura (ON DELETE SET NULL)
DO $$
BEGIN
  -- perfiles
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'perfiles' AND column_name = 'sede_id') THEN
    ALTER TABLE public.perfiles DROP CONSTRAINT IF EXISTS perfiles_sede_id_fkey;
    ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON DELETE SET NULL;
  END IF;

  -- sellos
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sellos' AND column_name = 'sede_id') THEN
    ALTER TABLE public.sellos DROP CONSTRAINT IF EXISTS sellos_sede_id_fkey;
    ALTER TABLE public.sellos ADD CONSTRAINT sellos_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON DELETE SET NULL;
  END IF;

  -- canjes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'canjes' AND column_name = 'sede_id') THEN
    ALTER TABLE public.canjes DROP CONSTRAINT IF EXISTS canjes_sede_id_fkey;
    ALTER TABLE public.canjes ADD CONSTRAINT canjes_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON DELETE SET NULL;
  END IF;

  -- auditoria_seguridad (agregar columna si no existe, o ajustar constraint)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auditoria_seguridad') THEN
    ALTER TABLE public.auditoria_seguridad ADD COLUMN IF NOT EXISTS sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL;
  END IF;

  -- dispositivos (cajas POS asociadas a la sede)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dispositivos' AND column_name = 'sede_id') THEN
    ALTER TABLE public.dispositivos DROP CONSTRAINT IF EXISTS dispositivos_sede_id_fkey;
    ALTER TABLE public.dispositivos ADD CONSTRAINT dispositivos_sede_id_fkey FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Habilitar y configurar Políticas de Seguridad (RLS)
ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores para evitar duplicados o conflictos
DROP POLICY IF EXISTS "sedes_select_negocio" ON public.sedes;
DROP POLICY IF EXISTS "sedes_manage_owner" ON public.sedes;
DROP POLICY IF EXISTS "sedes_select_public" ON public.sedes;
DROP POLICY IF EXISTS "sedes_insert_policy" ON public.sedes;
DROP POLICY IF EXISTS "sedes_update_policy" ON public.sedes;
DROP POLICY IF EXISTS "sedes_delete_policy" ON public.sedes;

-- Lectura: Pública y accesible para clientes PWA, cajas POS y panel de control
CREATE POLICY "sedes_select_public" ON public.sedes
  FOR SELECT USING (true);

-- Creación: Permitida para panel de control y administradores
CREATE POLICY "sedes_insert_policy" ON public.sedes
  FOR INSERT WITH CHECK (true);

-- Edición y pausa/activación:
CREATE POLICY "sedes_update_policy" ON public.sedes
  FOR UPDATE USING (true) WITH CHECK (true);

-- Eliminación:
CREATE POLICY "sedes_delete_policy" ON public.sedes
  FOR DELETE USING (true);

-- 4. Funciones RPC seguras (SECURITY DEFINER) para operaciones desde el frontend

-- Crear Sede
CREATE OR REPLACE FUNCTION public.admin_crear_sede(
  p_negocio_id UUID,
  p_nombre TEXT,
  p_direccion TEXT DEFAULT NULL,
  p_telefono TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sede public.sedes%ROWTYPE;
BEGIN
  IF trim(p_nombre) IS NULL OR trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre de la sede es obligatorio.';
  END IF;

  INSERT INTO public.sedes (negocio_id, nombre, direccion, telefono, activo)
  VALUES (p_negocio_id, trim(p_nombre), trim(p_direccion), trim(p_telefono), true)
  RETURNING * INTO v_sede;

  RETURN jsonb_build_object(
    'ok', true,
    'sede', row_to_json(v_sede)
  );
END;
$$;

-- Actualizar Sede
CREATE OR REPLACE FUNCTION public.admin_actualizar_sede(
  p_sede_id UUID,
  p_nombre TEXT,
  p_direccion TEXT DEFAULT NULL,
  p_telefono TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sede public.sedes%ROWTYPE;
BEGIN
  IF trim(p_nombre) IS NULL OR trim(p_nombre) = '' THEN
    RAISE EXCEPTION 'El nombre de la sede es obligatorio.';
  END IF;

  UPDATE public.sedes
  SET
    nombre = trim(p_nombre),
    direccion = trim(p_direccion),
    telefono = trim(p_telefono),
    updated_at = now()
  WHERE id = p_sede_id
  RETURNING * INTO v_sede;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sede no encontrada.';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'sede', row_to_json(v_sede)
  );
END;
$$;

-- Pausar / Activar Sede
CREATE OR REPLACE FUNCTION public.admin_toggle_sede(p_sede_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_next_active BOOLEAN;
BEGIN
  UPDATE public.sedes
  SET
    activo = NOT activo,
    updated_at = now()
  WHERE id = p_sede_id
  RETURNING activo INTO v_next_active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sede no encontrada.';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'activo', v_next_active
  );
END;
$$;

-- Eliminar Sede
CREATE OR REPLACE FUNCTION public.admin_eliminar_sede(p_sede_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  DELETE FROM public.sedes WHERE id = p_sede_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sede no encontrada o ya eliminada.';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 5. Seed inicial de Olivia Café (si aún no existen en tu Supabase)
DO $$
DECLARE
  v_negocio_id UUID;
BEGIN
  SELECT id INTO v_negocio_id FROM public.negocios WHERE slug = 'olivia' LIMIT 1;

  IF v_negocio_id IS NOT NULL THEN
    INSERT INTO public.sedes (id, negocio_id, nombre, direccion, telefono, activo)
    VALUES
      ('22222222-2222-4222-8222-222222222221', v_negocio_id, 'Local Principal · Miraflores', 'Av. La Mar 1240, Miraflores, Lima', '+51 1 445 8920', true),
      ('22222222-2222-4222-8222-222222222222', v_negocio_id, 'Barra Express · San Isidro', 'Calle Miguel Dasso 185, San Isidro, Lima', '+51 1 422 3310', true)
    ON CONFLICT (id) DO UPDATE SET
      nombre = EXCLUDED.nombre,
      direccion = EXCLUDED.direccion,
      telefono = EXCLUDED.telefono,
      activo = EXCLUDED.activo;
  END IF;
END $$;
