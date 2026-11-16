import { getSupabaseClient } from '@/src/shared/lib/supabase';

export interface ProvisionedAccount {
  id: string;
  negocio_id: string;
  sede_id: string | null;
  sede_nombre: string;
  rol: 'owner' | 'cashier';
  nombre_completo: string;
  email: string | null;
  celular_otp: string;
  clave_acceso: string; // En Supabase live se valida en servidor por hash bcrypt; en vista previa local se guarda para pruebas
  primer_ingreso_pendiente: boolean;
  activo: boolean;
  creado_por: 'root' | 'admin';
  created_at: string;
}

export interface KeyLoginResult {
  valido: boolean;
  requiereOtp?: boolean;
  mensaje?: string;
  perfilId?: string;
  nombreCompleto?: string;
  rol?: 'owner' | 'cashier';
  sedeId?: string | null;
  email?: string | null;
  destinoEnmascarado?: string;
  demoOtpCode?: string; // Solo en modo vista previa local para simular envío por WhatsApp
}

export interface OtpVerifyResult {
  autorizado: boolean;
  mensaje?: string;
  perfil?: {
    id: string;
    nombre_completo: string;
    rol: 'owner' | 'cashier';
    sede_id: string | null;
    email: string | null;
  };
}

const ACCESS_STORE_KEY = 'olivia_access_credentials_v1';
const PENDING_OTP_STORE_KEY = 'olivia_pending_otp_challenges_v1';

// Clave maestra de Root (desarrollador) para abrir consola de provisión de Dueños
export const DEFAULT_ROOT_DEV_KEY =
  (import.meta.env.VITE_ROOT_DEV_KEY as string | undefined) || '1982';

export function maskPhoneOtp(phonePe: string): string {
  const digits = phonePe.replace(/\D/g, '').slice(-9);
  if (digits.length !== 9) return 'WhatsApp registrado';
  return `+51 ${digits.slice(0, 3)} *** ${digits.slice(6)}`;
}

export function generateNumericDigits(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

function buildInitialProvisionedAccounts(): ProvisionedAccount[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'owner-olivia-principal',
      negocio_id: '11111111-1111-4111-8111-111111111111',
      sede_id: null,
      sede_nombre: 'Todas las sedes',
      rol: 'owner',
      nombre_completo: 'Dueño Olivia Café',
      email: 'dueno@oliviacafe.pe',
      celular_otp: '+51987111222',
      clave_acceso: '84920173', // Clave de 8 dígitos creada por Root
      primer_ingreso_pendiente: true,
      activo: true,
      creado_por: 'root',
      created_at: now,
    },
    {
      id: 'demo-cashier-carlos',
      negocio_id: '11111111-1111-4111-8111-111111111111',
      sede_id: '22222222-2222-4222-8222-222222222221',
      sede_nombre: 'Local Principal · Miraflores',
      rol: 'cashier',
      nombre_completo: 'Carlos M.',
      email: null,
      celular_otp: '+51987000111',
      clave_acceso: '1234',
      primer_ingreso_pendiente: true,
      activo: true,
      creado_por: 'admin',
      created_at: now,
    },
    {
      id: 'demo-cashier-valeria',
      negocio_id: '11111111-1111-4111-8111-111111111111',
      sede_id: '22222222-2222-4222-8222-222222222222',
      sede_nombre: 'Barra Express · San Isidro',
      rol: 'cashier',
      nombre_completo: 'Valeria R.',
      email: null,
      celular_otp: '+51987000222',
      clave_acceso: '5678',
      primer_ingreso_pendiente: false,
      activo: true,
      creado_por: 'admin',
      created_at: now,
    },
  ];
}

export function listLocalAccounts(): ProvisionedAccount[] {
  try {
    const raw = localStorage.getItem(ACCESS_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProvisionedAccount[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  const initial = buildInitialProvisionedAccounts();
  saveLocalAccounts(initial);
  return initial;
}

export function saveLocalAccounts(accounts: ProvisionedAccount[]) {
  try {
    localStorage.setItem(ACCESS_STORE_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore storage errors
  }
}

export function createOwnerByRootLocal(input: {
  negocio_id: string;
  nombre_completo: string;
  email: string;
  celular_otp: string;
  clave_8_digitos: string;
}): { ok: boolean; error?: string; account?: ProvisionedAccount } {
  if (!/^[0-9]{8}$/.test(input.clave_8_digitos)) {
    return { ok: false, error: 'La clave de dueño debe tener exactamente 8 dígitos numéricos.' };
  }
  if (!/^\+519[0-9]{8}$/.test(input.celular_otp)) {
    return { ok: false, error: 'El celular OTP debe tener formato +519XXXXXXXX.' };
  }

  const accounts = listLocalAccounts();
  const next: ProvisionedAccount = {
    id: `owner-${Date.now()}`,
    negocio_id: input.negocio_id,
    sede_id: null,
    sede_nombre: 'Todas las sedes',
    rol: 'owner',
    nombre_completo: input.nombre_completo.trim(),
    email: input.email.trim().toLowerCase(),
    celular_otp: input.celular_otp,
    clave_acceso: input.clave_8_digitos,
    primer_ingreso_pendiente: true,
    activo: true,
    creado_por: 'root',
    created_at: new Date().toISOString(),
  };

  saveLocalAccounts([next, ...accounts]);
  return { ok: true, account: next };
}

export function createPosUserByAdminLocal(input: {
  negocio_id: string;
  sede_id: string;
  sede_nombre: string;
  nombre_completo: string;
  celular_otp: string;
  clave_pos: string;
}): { ok: boolean; error?: string; account?: ProvisionedAccount } {
  if (!/^[0-9]{4,8}$/.test(input.clave_pos)) {
    return { ok: false, error: 'La clave del usuario POS debe tener entre 4 y 8 dígitos.' };
  }
  if (!/^\+519[0-9]{8}$/.test(input.celular_otp)) {
    return { ok: false, error: 'El celular OTP debe tener formato +519XXXXXXXX.' };
  }

  const accounts = listLocalAccounts();
  if (accounts.some((a) => a.rol === 'cashier' && a.clave_acceso === input.clave_pos && a.activo)) {
    return { ok: false, error: 'Ya existe un usuario POS activo con esa misma clave.' };
  }

  const next: ProvisionedAccount = {
    id: `pos-${Date.now()}`,
    negocio_id: input.negocio_id,
    sede_id: input.sede_id,
    sede_nombre: input.sede_nombre,
    rol: 'cashier',
    nombre_completo: input.nombre_completo.trim(),
    email: null,
    celular_otp: input.celular_otp,
    clave_acceso: input.clave_pos,
    primer_ingreso_pendiente: true,
    activo: true,
    creado_por: 'admin',
    created_at: new Date().toISOString(),
  };

  saveLocalAccounts([...accounts, next]);
  return { ok: true, account: next };
}

export function resetAccountOtpActivationLocal(accountId: string) {
  const accounts = listLocalAccounts().map((a) =>
    a.id === accountId ? { ...a, primer_ingreso_pendiente: true } : a
  );
  saveLocalAccounts(accounts);
}

export function toggleAccountActiveLocal(accountId: string) {
  const accounts = listLocalAccounts().map((a) =>
    a.id === accountId ? { ...a, activo: !a.activo } : a
  );
  saveLocalAccounts(accounts);
}

export async function validarAccesoClaveConOtp(params: {
  supabaseReady: boolean;
  negocioId: string;
  rolObjetivo: 'owner' | 'cashier';
  clave: string;
  sedeId?: string | null;
  dispositivoId?: string | null;
}): Promise<KeyLoginResult> {
  const supabase = getSupabaseClient();

  if (supabase && params.supabaseReady) {
    const { data, error } = await supabase.rpc('validar_acceso_clave_con_otp', {
      p_negocio_id: params.negocioId,
      p_rol_objetivo: params.rolObjetivo,
      p_clave: params.clave,
      p_sede_id: params.sedeId ?? null,
      p_dispositivo_id: params.dispositivoId ?? null,
    });
    if (error) {
      return { valido: false, mensaje: error.message };
    }
    const res = data as {
      valido: boolean;
      requiere_otp?: boolean;
      mensaje?: string;
      perfil_id?: string;
      nombre_completo?: string;
      rol?: 'owner' | 'cashier';
      destino_enmascarado?: string;
      perfil?: {
        id: string;
        nombre_completo: string;
        rol: 'owner' | 'cashier';
        sede_id: string | null;
        email: string | null;
      };
    };

    if (!res.valido) {
      return { valido: false, mensaje: res.mensaje || 'Clave incorrecta.' };
    }

    if (res.requiere_otp) {
      return {
        valido: true,
        requiereOtp: true,
        perfilId: res.perfil_id,
        nombreCompleto: res.nombre_completo,
        rol: res.rol,
        destinoEnmascarado: res.destino_enmascarado,
      };
    }

    return {
      valido: true,
      requiereOtp: false,
      perfilId: res.perfil?.id,
      nombreCompleto: res.perfil?.nombre_completo,
      rol: res.perfil?.rol,
      sedeId: res.perfil?.sede_id ?? null,
      email: res.perfil?.email ?? null,
    };
  }

  // Modo vista previa local
  if (params.rolObjetivo === 'owner' && !/^[0-9]{8}$/.test(params.clave)) {
    return {
      valido: false,
      mensaje: 'La clave de Dueño debe tener exactamente 8 dígitos numéricos.',
    };
  }
  if (params.rolObjetivo === 'cashier' && !/^[0-9]{4,8}$/.test(params.clave)) {
    return {
      valido: false,
      mensaje: 'La clave POS debe tener entre 4 y 8 dígitos numéricos.',
    };
  }

  const accounts = listLocalAccounts();
  const match = accounts.find(
    (a) =>
      a.activo &&
      a.rol === params.rolObjetivo &&
      a.clave_acceso === params.clave
  );

  if (!match) {
    return {
      valido: false,
      mensaje:
        params.rolObjetivo === 'owner'
          ? 'Clave de 8 dígitos incorrecta o desactivada. (Demo: 84920173)'
          : 'Clave POS incorrecta o usuario suspendido. (Demo: 1234 o 5678)',
    };
  }

  if (match.primer_ingreso_pendiente) {
    const code = generateNumericDigits(6);
    try {
      const raw = sessionStorage.getItem(PENDING_OTP_STORE_KEY);
      const map = raw ? (JSON.parse(raw) as Record<string, { code: string; exp: number }>) : {};
      map[match.id] = { code, exp: Date.now() + 10 * 60 * 1000 };
      sessionStorage.setItem(PENDING_OTP_STORE_KEY, JSON.stringify(map));
    } catch {
      // Ignore storage errors
    }

    return {
      valido: true,
      requiereOtp: true,
      perfilId: match.id,
      nombreCompleto: match.nombre_completo,
      rol: match.rol,
      sedeId: match.sede_id,
      email: match.email,
      destinoEnmascarado: maskPhoneOtp(match.celular_otp),
      demoOtpCode: code,
    };
  }

  return {
    valido: true,
    requiereOtp: false,
    perfilId: match.id,
    nombreCompleto: match.nombre_completo,
    rol: match.rol,
    sedeId: match.sede_id,
    email: match.email,
  };
}

export async function confirmarOtpPrimerIngreso(params: {
  supabaseReady: boolean;
  perfilId: string;
  codigoOtp: string;
}): Promise<OtpVerifyResult> {
  const supabase = getSupabaseClient();
  if (supabase && params.supabaseReady) {
    const { data, error } = await supabase.rpc('confirmar_otp_primer_ingreso', {
      p_perfil_id: params.perfilId,
      p_codigo_otp: params.codigoOtp,
    });
    if (error) {
      return { autorizado: false, mensaje: error.message };
    }
    const res = data as OtpVerifyResult;
    return res;
  }

  // Modo vista previa local
  if (!/^[0-9]{6}$/.test(params.codigoOtp)) {
    return { autorizado: false, mensaje: 'Ingresa los 6 dígitos del código OTP.' };
  }

  let stored: { code: string; exp: number } | undefined;
  try {
    const raw = sessionStorage.getItem(PENDING_OTP_STORE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, { code: string; exp: number }>) : {};
    stored = map[params.perfilId];
  } catch {
    stored = undefined;
  }

  if (!stored || stored.exp < Date.now()) {
    return {
      autorizado: false,
      mensaje: 'El código OTP expiró. Vuelve a ingresar tu clave para generar uno nuevo.',
    };
  }

  if (stored.code !== params.codigoOtp) {
    return { autorizado: false, mensaje: 'Código OTP incorrecto. Verifica el mensaje recibido.' };
  }

  const accounts = listLocalAccounts();
  const target = accounts.find((a) => a.id === params.perfilId);
  if (!target) {
    return { autorizado: false, mensaje: 'Cuenta no encontrada.' };
  }

  saveLocalAccounts(
    accounts.map((a) =>
      a.id === params.perfilId ? { ...a, primer_ingreso_pendiente: false } : a
    )
  );

  return {
    autorizado: true,
    perfil: {
      id: target.id,
      nombre_completo: target.nombre_completo,
      rol: target.rol,
      sede_id: target.sede_id,
      email: target.email,
    },
  };
}
