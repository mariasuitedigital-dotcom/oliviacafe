-- ============================================================================
-- FASE 8: CLAVE 8 DÍGITOS CREADA POR ROOT + ACTIVACIÓN OTP PRIMER INGRESO
-- (ADMIN DUEÑO Y USUARIO POS)
-- ============================================================================

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS clave_acceso_hash TEXT,
  ADD COLUMN IF NOT EXISTS celular_otp TEXT CHECK (celular_otp IS NULL OR celular_otp ~ '^\+519[0-9]{8}$'),
  ADD COLUMN IF NOT EXISTS primer_ingreso_pendiente BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS otp_codigo_hash TEXT,
  ADD COLUMN IF NOT EXISTS otp_expira_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS otp_verificado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS creado_por UUID REFERENCES public.perfiles(id) ON DELETE SET NULL;

-- 1. Root (desarrollador) crea o actualiza clave de 8 dígitos para Dueño/Admin
CREATE OR REPLACE FUNCTION public.root_crear_dueno(
  p_negocio_id UUID,
  p_nombre TEXT,
  p_email TEXT,
  p_celular_otp TEXT,
  p_clave_8_digitos TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_perfil public.perfiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND public.auth_rol() <> 'superadmin' THEN
    RAISE EXCEPTION 'Solo el usuario Root (superadmin) puede provisionar claves de Dueño.';
  END IF;

  IF p_clave_8_digitos !~ '^[0-9]{8}$' THEN
    RAISE EXCEPTION 'La clave del Dueño/Admin debe tener exactamente 8 dígitos numéricos.';
  END IF;

  IF p_celular_otp !~ '^\+519[0-9]{8}$' THEN
    RAISE EXCEPTION 'El celular para OTP debe tener formato Perú (+519XXXXXXXX).';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Primero crea o invita el usuario Auth con el correo % antes de vincular la clave.', p_email;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object('role', 'owner', 'negocio_id', p_negocio_id)
  WHERE id = v_user_id;

  INSERT INTO public.perfiles (
    id, negocio_id, rol, nombre_completo, email,
    clave_acceso_hash, celular_otp, primer_ingreso_pendiente, activo, creado_por
  ) VALUES (
    v_user_id, p_negocio_id, 'owner', trim(p_nombre), lower(trim(p_email)),
    crypt(p_clave_8_digitos, gen_salt('bf')), p_celular_otp, true, true, auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    negocio_id = EXCLUDED.negocio_id,
    rol = 'owner',
    nombre_completo = EXCLUDED.nombre_completo,
    email = EXCLUDED.email,
    clave_acceso_hash = EXCLUDED.clave_acceso_hash,
    celular_otp = EXCLUDED.celular_otp,
    primer_ingreso_pendiente = true,
    otp_verificado_at = NULL,
    activo = true,
    updated_at = now()
  RETURNING * INTO v_perfil;

  INSERT INTO public.auditoria_seguridad (negocio_id, actor_id, accion, detalle)
  VALUES (
    p_negocio_id,
    auth.uid(),
    'root_provisiona_dueno',
    jsonb_build_object('perfil_id', v_perfil.id, 'email', v_perfil.email, 'primer_ingreso_pendiente', true)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'perfil_id', v_perfil.id,
    'primer_ingreso_pendiente', v_perfil.primer_ingreso_pendiente
  );
END;
$$;

-- 2. Admin (Dueño) crea o actualiza usuario POS (cajero) con OTP obligatorio en primer ingreso
CREATE OR REPLACE FUNCTION public.admin_crear_usuario_pos(
  p_negocio_id UUID,
  p_sede_id UUID,
  p_nombre TEXT,
  p_celular_otp TEXT,
  p_clave_pos TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_perfil public.perfiles%ROWTYPE;
  v_target_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND public.auth_rol() NOT IN ('owner', 'superadmin') THEN
    RAISE EXCEPTION 'Solo el Dueño/Admin puede administrar usuarios POS.';
  END IF;

  IF p_clave_pos !~ '^[0-9]{4,8}$' THEN
    RAISE EXCEPTION 'La clave POS debe tener entre 4 y 8 dígitos numéricos.';
  END IF;

  IF p_celular_otp !~ '^\+519[0-9]{8}$' THEN
    RAISE EXCEPTION 'El celular para OTP debe tener formato Perú (+519XXXXXXXX).';
  END IF;

  v_target_id := coalesce(p_user_id, auth.uid());
  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere p_user_id de Auth válido para crear el usuario POS.';
  END IF;

  INSERT INTO public.perfiles (
    id, negocio_id, sede_id, rol, nombre_completo,
    pin_hash, clave_acceso_hash, celular_otp, primer_ingreso_pendiente, activo, creado_por
  ) VALUES (
    v_target_id, p_negocio_id, p_sede_id, 'cashier', trim(p_nombre),
    crypt(p_clave_pos, gen_salt('bf')),
    crypt(p_clave_pos, gen_salt('bf')),
    p_celular_otp, true, true, auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    sede_id = EXCLUDED.sede_id,
    nombre_completo = EXCLUDED.nombre_completo,
    pin_hash = EXCLUDED.pin_hash,
    clave_acceso_hash = EXCLUDED.clave_acceso_hash,
    celular_otp = EXCLUDED.celular_otp,
    primer_ingreso_pendiente = true,
    otp_verificado_at = NULL,
    activo = true,
    updated_at = now()
  RETURNING * INTO v_perfil;

  INSERT INTO public.auditoria_seguridad (negocio_id, sede_id, actor_id, accion, detalle)
  VALUES (
    p_negocio_id,
    p_sede_id,
    auth.uid(),
    'admin_crea_usuario_pos',
    jsonb_build_object('cajero_id', v_perfil.id, 'nombre', v_perfil.nombre_completo)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'perfil_id', v_perfil.id,
    'primer_ingreso_pendiente', v_perfil.primer_ingreso_pendiente
  );
END;
$$;

-- 3. Validar clave de Admin (8 dígitos) o usuario POS (4-8 dígitos) y disparar OTP si es primer ingreso
CREATE OR REPLACE FUNCTION public.validar_acceso_clave_con_otp(
  p_negocio_id UUID,
  p_rol_objetivo TEXT,
  p_clave TEXT,
  p_sede_id UUID DEFAULT NULL,
  p_dispositivo_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_perfil public.perfiles%ROWTYPE;
  v_otp TEXT;
  v_masked TEXT;
BEGIN
  IF p_rol_objetivo = 'owner' AND p_clave !~ '^[0-9]{8}$' THEN
    RAISE EXCEPTION 'La clave de Dueño/Admin debe tener exactamente 8 dígitos.';
  END IF;

  IF p_rol_objetivo = 'cashier' AND p_clave !~ '^[0-9]{4,8}$' THEN
    RAISE EXCEPTION 'La clave POS debe tener entre 4 y 8 dígitos.';
  END IF;

  SELECT * INTO v_perfil
  FROM public.perfiles
  WHERE negocio_id = p_negocio_id
    AND activo = true
    AND (
      (p_rol_objetivo = 'owner' AND rol IN ('owner', 'superadmin'))
      OR (p_rol_objetivo = 'cashier' AND rol IN ('cashier', 'owner') AND (p_sede_id IS NULL OR sede_id = p_sede_id OR rol = 'owner'))
    )
    AND (
      (clave_acceso_hash IS NOT NULL AND clave_acceso_hash = crypt(p_clave, clave_acceso_hash))
      OR (pin_hash IS NOT NULL AND pin_hash = crypt(p_clave, pin_hash))
    )
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.auditoria_seguridad (negocio_id, sede_id, dispositivo_id, accion, detalle)
    VALUES (
      p_negocio_id,
      p_sede_id,
      p_dispositivo_id,
      CASE WHEN p_rol_objetivo = 'owner' THEN 'clave_admin_invalida' ELSE 'pin_invalido' END,
      jsonb_build_object('hora', now())
    );
    RETURN jsonb_build_object('valido', false, 'mensaje', 'Clave incorrecta o usuario inactivo.');
  END IF;

  IF v_perfil.pin_bloqueado_hasta IS NOT NULL AND v_perfil.pin_bloqueado_hasta > now() THEN
    RETURN jsonb_build_object('valido', false, 'mensaje', 'Acceso bloqueado temporalmente por seguridad.');
  END IF;

  -- Primer ingreso: generar OTP de 6 dígitos y encolar en outbox
  IF v_perfil.primer_ingreso_pendiente THEN
    v_otp := lpad(floor(random() * 1000000)::int::text, 6, '0');
    v_masked := coalesce(
      regexp_replace(v_perfil.celular_otp, '^\+51([0-9]{3})[0-9]{3}([0-9]{3})$', '+51 \1 *** \2'),
      'WhatsApp/Correo registrado'
    );

    UPDATE public.perfiles
    SET otp_codigo_hash = crypt(v_otp, gen_salt('bf')),
        otp_expira_at = now() + interval '10 minutes',
        updated_at = now()
    WHERE id = v_perfil.id;

    PERFORM public.encolar_outbox(
      p_negocio_id,
      'otp_activacion_primer_ingreso',
      jsonb_build_object(
        'perfil_id', v_perfil.id,
        'rol', v_perfil.rol,
        'nombre', v_perfil.nombre_completo,
        'celular_otp', v_perfil.celular_otp,
        'email', v_perfil.email,
        'codigo_otp', v_otp,
        'expira_min', 10
      )
    );

    RETURN jsonb_build_object(
      'valido', true,
      'requiere_otp', true,
      'perfil_id', v_perfil.id,
      'nombre_completo', v_perfil.nombre_completo,
      'rol', v_perfil.rol,
      'destino_enmascarado', v_masked
    );
  END IF;

  IF p_dispositivo_id IS NOT NULL THEN
    UPDATE public.dispositivos SET ultimo_acceso_at = now() WHERE id = p_dispositivo_id;
  END IF;

  RETURN jsonb_build_object(
    'valido', true,
    'requiere_otp', false,
    'perfil', jsonb_build_object(
      'id', v_perfil.id,
      'nombre_completo', v_perfil.nombre_completo,
      'rol', v_perfil.rol,
      'sede_id', coalesce(v_perfil.sede_id, p_sede_id),
      'email', v_perfil.email
    )
  );
END;
$$;

-- 4. Confirmar OTP de 6 dígitos en primer ingreso y activar cuenta permanentemente
CREATE OR REPLACE FUNCTION public.confirmar_otp_primer_ingreso(
  p_perfil_id UUID,
  p_codigo_otp TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_perfil public.perfiles%ROWTYPE;
BEGIN
  IF p_codigo_otp !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object('autorizado', false, 'mensaje', 'El código OTP debe tener 6 dígitos.');
  END IF;

  SELECT * INTO v_perfil
  FROM public.perfiles
  WHERE id = p_perfil_id AND activo = true
  FOR UPDATE;

  IF NOT FOUND OR v_perfil.otp_codigo_hash IS NULL THEN
    RETURN jsonb_build_object('autorizado', false, 'mensaje', 'No hay una activación OTP pendiente.');
  END IF;

  IF v_perfil.otp_expira_at IS NULL OR v_perfil.otp_expira_at < now() THEN
    RETURN jsonb_build_object('autorizado', false, 'mensaje', 'El código OTP expiró. Vuelve a ingresar tu clave para generar uno nuevo.');
  END IF;

  IF v_perfil.otp_codigo_hash <> crypt(p_codigo_otp, v_perfil.otp_codigo_hash) THEN
    RETURN jsonb_build_object('autorizado', false, 'mensaje', 'Código OTP incorrecto.');
  END IF;

  UPDATE public.perfiles
  SET primer_ingreso_pendiente = false,
      otp_verificado_at = now(),
      otp_codigo_hash = NULL,
      otp_expira_at = NULL,
      pin_intentos_fallidos = 0,
      updated_at = now()
  WHERE id = v_perfil.id
  RETURNING * INTO v_perfil;

  INSERT INTO public.auditoria_seguridad (negocio_id, sede_id, actor_id, accion, detalle)
  VALUES (
    v_perfil.negocio_id,
    v_perfil.sede_id,
    v_perfil.id,
    'activacion_primer_ingreso_otp',
    jsonb_build_object('rol', v_perfil.rol, 'nombre', v_perfil.nombre_completo)
  );

  RETURN jsonb_build_object(
    'autorizado', true,
    'perfil', jsonb_build_object(
      'id', v_perfil.id,
      'nombre_completo', v_perfil.nombre_completo,
      'rol', v_perfil.rol,
      'sede_id', v_perfil.sede_id,
      'email', v_perfil.email
    )
  );
END;
$$;
