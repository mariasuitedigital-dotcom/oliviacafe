-- ============================================================================
-- FASE 1: ROLES EN APP_METADATA Y POLÍTICAS RLS MULTI-TENANT ESTRICTAS
-- ============================================================================
-- Reglas de seguridad:
-- 1. Los roles ('customer', 'cashier', 'owner', 'superadmin') viven SOLO en
--    auth.users.raw_app_meta_data (app_metadata), NUNCA en user_metadata.
-- 2. Cada usuario solo accede a filas de su negocio_id y según su rol.
-- 3. Un cajero solo opera en su sede_id y no puede leer datos sensibles completos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FUNCIONES AUXILIARES DE CONTEXTO JWT (leídas desde app_metadata)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_rol()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

CREATE OR REPLACE FUNCTION public.auth_negocio_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(auth.jwt() -> 'app_metadata' ->> 'negocio_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.auth_sede_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(auth.jwt() -> 'app_metadata' ->> 'sede_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.auth_rol() = 'superadmin';
$$;

CREATE OR REPLACE FUNCTION public.is_owner_of(p_negocio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_superadmin()
      OR (public.auth_rol() = 'owner' AND public.auth_negocio_id() = p_negocio_id);
$$;

CREATE OR REPLACE FUNCTION public.is_staff_of(p_negocio_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_superadmin()
      OR (public.auth_rol() IN ('owner', 'cashier') AND public.auth_negocio_id() = p_negocio_id);
$$;

-- ----------------------------------------------------------------------------
-- SINCRONIZACIÓN AUTOMÁTICA DE PERFILES -> auth.users.raw_app_meta_data
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_to_app_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', NEW.rol::text,
    'negocio_id', NEW.negocio_id::text,
    'sede_id', coalesce(NEW.sede_id::text, '')
  )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_app_metadata ON public.perfiles;
CREATE TRIGGER trg_sync_profile_app_metadata
AFTER INSERT OR UPDATE OF rol, negocio_id, sede_id ON public.perfiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_app_metadata();

-- ----------------------------------------------------------------------------
-- HABILITAR RLS EN TODAS LAS TABLAS
-- ----------------------------------------------------------------------------
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canjes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promociones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campanas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automatizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensajes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_seguridad ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- POLÍTICAS POR TABLA
-- ----------------------------------------------------------------------------

-- 1. NEGOCIOS: Lectura pública mínima por slug para branding/registro; edición solo dueño/superadmin
CREATE POLICY "negocios_select_publico" ON public.negocios
  FOR SELECT USING (activo = true OR public.is_owner_of(id));

CREATE POLICY "negocios_update_owner" ON public.negocios
  FOR UPDATE USING (public.is_owner_of(id))
  WITH CHECK (public.is_owner_of(id));

CREATE POLICY "negocios_insert_superadmin" ON public.negocios
  FOR INSERT WITH CHECK (public.is_superadmin());

-- 2. SEDES: Lectura para staff y clientes activos del negocio; escritura solo dueño
CREATE POLICY "sedes_select_negocio" ON public.sedes
  FOR SELECT USING (
    public.is_staff_of(negocio_id)
    OR (activo = true AND public.auth_negocio_id() = negocio_id)
  );

CREATE POLICY "sedes_manage_owner" ON public.sedes
  FOR ALL USING (public.is_owner_of(negocio_id))
  WITH CHECK (public.is_owner_of(negocio_id));

-- 3. PERFILES: Usuario ve su perfil; dueño gestiona personal de su negocio
CREATE POLICY "perfiles_select_own_or_owner" ON public.perfiles
  FOR SELECT USING (
    id = auth.uid()
    OR public.is_owner_of(negocio_id)
  );

CREATE POLICY "perfiles_manage_owner" ON public.perfiles
  FOR ALL USING (public.is_owner_of(negocio_id))
  WITH CHECK (public.is_owner_of(negocio_id));

-- 4. DISPOSITIVOS: Dueño administra; cajero lee dispositivos de su sede
CREATE POLICY "dispositivos_select_staff" ON public.dispositivos
  FOR SELECT USING (
    public.is_owner_of(negocio_id)
    OR (public.auth_rol() = 'cashier' AND public.auth_negocio_id() = negocio_id AND public.auth_sede_id() = sede_id)
  );

CREATE POLICY "dispositivos_manage_owner" ON public.dispositivos
  FOR ALL USING (public.is_owner_of(negocio_id))
  WITH CHECK (public.is_owner_of(negocio_id));

-- 5. CLIENTES:
-- Cliente ve y actualiza solo SU fila (consentimientos, cumpleaños); Dueño ve todo su negocio.
-- El cajero NO accede directamente a tabla clientes (usa RPC o vista enmascarada v_clientes_caja).
CREATE POLICY "clientes_select_own_or_owner" ON public.clientes
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_owner_of(negocio_id)
  );

CREATE POLICY "clientes_update_own_or_owner" ON public.clientes
  FOR UPDATE USING (
    user_id = auth.uid()
    OR public.is_owner_of(negocio_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_owner_of(negocio_id)
  );

-- 6. CARTILLAS: Cliente ve su cartilla; Dueño ve todas; Cajero consulta vía RPC de caja
CREATE POLICY "cartillas_select_own_or_staff" ON public.cartillas
  FOR SELECT USING (
    public.is_owner_of(negocio_id)
    OR (public.auth_rol() = 'cashier' AND public.auth_negocio_id() = negocio_id)
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cartillas.cliente_id AND c.user_id = auth.uid()
    )
  );

-- 7. QR_TOKENS: Cliente ve su token; Staff lo valida vía RPC
CREATE POLICY "qr_tokens_select_own" ON public.qr_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = qr_tokens.cliente_id AND c.user_id = auth.uid()
    )
  );

-- 8. SELLOS: Solo inserción vía Edge Function / SECURITY DEFINER RPC. Lectura por dueño, cajero de su sede, o propio cliente.
CREATE POLICY "sellos_select_scoped" ON public.sellos
  FOR SELECT USING (
    public.is_owner_of(negocio_id)
    OR (public.auth_rol() = 'cashier' AND public.auth_negocio_id() = negocio_id AND public.auth_sede_id() = sede_id)
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = sellos.cliente_id AND c.user_id = auth.uid()
    )
  );

-- 9. CANJES: Igual que sellos (solo lectura por scope; escritura exclusiva por RPC)
CREATE POLICY "canjes_select_scoped" ON public.canjes
  FOR SELECT USING (
    public.is_owner_of(negocio_id)
    OR (public.auth_rol() = 'cashier' AND public.auth_negocio_id() = negocio_id AND public.auth_sede_id() = sede_id)
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = canjes.cliente_id AND c.user_id = auth.uid()
    )
  );

-- 10. PUSH_SUBSCRIPTIONS: Cliente gestiona sus propias suscripciones; Dueño puede contar activas
CREATE POLICY "push_subs_own_manage" ON public.push_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = push_subscriptions.cliente_id AND c.user_id = auth.uid()
    )
    OR public.is_owner_of(negocio_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = push_subscriptions.cliente_id AND c.user_id = auth.uid()
    )
  );

-- 11. PROMOCIONES: Clientes registrados del negocio ven promos activas; Dueño gestiona todas
CREATE POLICY "promociones_select_scoped" ON public.promociones
  FOR SELECT USING (
    public.is_owner_of(negocio_id)
    OR (activa = true AND vigencia_fin > now() AND public.auth_negocio_id() = negocio_id)
  );

CREATE POLICY "promociones_manage_owner" ON public.promociones
  FOR ALL USING (public.is_owner_of(negocio_id))
  WITH CHECK (public.is_owner_of(negocio_id));

-- 12. CUPONES: Cliente ve sus cupones; Dueño ve todos; Cajero lee solo para validar en su negocio
CREATE POLICY "cupones_select_scoped" ON public.cupones
  FOR SELECT USING (
    public.is_owner_of(negocio_id)
    OR (public.auth_rol() = 'cashier' AND public.auth_negocio_id() = negocio_id)
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cupones.cliente_id AND c.user_id = auth.uid()
    )
  );

-- 13. CAMPAÑAS, AUTOMATIZACIONES, MENSAJES_LOG, EVENTOS_OUTBOX, AUDITORÍA: Solo Dueño / Superadmin
CREATE POLICY "campanas_owner" ON public.campanas
  FOR ALL USING (public.is_owner_of(negocio_id))
  WITH CHECK (public.is_owner_of(negocio_id));

CREATE POLICY "automatizaciones_owner" ON public.automatizaciones
  FOR ALL USING (public.is_owner_of(negocio_id))
  WITH CHECK (public.is_owner_of(negocio_id));

CREATE POLICY "mensajes_log_owner" ON public.mensajes_log
  FOR SELECT USING (public.is_owner_of(negocio_id));

CREATE POLICY "eventos_outbox_owner" ON public.eventos_outbox
  FOR SELECT USING (public.is_owner_of(negocio_id));

CREATE POLICY "auditoria_owner" ON public.auditoria_seguridad
  FOR SELECT USING (public.is_owner_of(negocio_id));

-- 14. ENCUESTAS: Cliente ve/crea sus encuestas; Dueño ve todas
CREATE POLICY "encuestas_select_scoped" ON public.encuestas
  FOR SELECT USING (
    public.is_owner_of(negocio_id)
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = encuestas.cliente_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "encuestas_insert_own" ON public.encuestas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = encuestas.cliente_id AND c.user_id = auth.uid()
    )
  );

-- 15. REFERIDOS: Cliente ve sus referidos; Dueño ve todos
CREATE POLICY "referidos_select_scoped" ON public.referidos
  FOR SELECT USING (
    public.is_owner_of(negocio_id)
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = referidos.referente_cliente_id AND c.user_id = auth.uid()
    )
  );
