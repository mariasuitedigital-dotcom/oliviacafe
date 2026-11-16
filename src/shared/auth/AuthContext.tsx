import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AppJwtMetadata, RolUsuario } from '@/src/types/database';
import { getSupabaseClient, isSupabaseConfigured } from '@/src/shared/lib/supabase';

export interface PosCashierSession {
  id: string;
  nombre_completo: string;
  rol: 'cashier' | 'owner';
  sede_id: string;
  dispositivo_id: string;
  dispositivo_nombre: string;
  negocio_id: string;
  autenticado_at: number;
}

export interface ClientLocalSession {
  cliente_id: string;
  nombre: string;
  celular: string;
  negocio_slug: string;
  modo: 'otp' | 'rapido_sin_otp';
  dia_nac?: number;
  mes_nac?: number;
  anio_nac?: number | null;
  consentimiento_push?: boolean;
  contacto_guardado?: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: RolUsuario | null;
  negocioId: string | null;
  sedeId: string | null;
  loading: boolean;
  supabaseReady: boolean;
  // Sesiones operativas por app
  posSession: PosCashierSession | null;
  clientSession: ClientLocalSession | null;
  ownerDemoSession: { email: string } | null;
  // Acciones Admin / Dueño
  signInOwnerWithPassword: (email: string, password: string) => Promise<{ error: string | null; mfaRequired?: boolean }>;
  signInOwnerWithGoogle: () => Promise<{ error: string | null }>;
  verifyOwnerMfa: (code: string) => Promise<{ error: string | null }>;
  setOwnerDemoSession: (data: { email: string } | null) => void;
  // Acciones Cliente
  sendClientOtp: (phonePe: string) => Promise<{ error: string | null }>;
  verifyClientOtp: (phonePe: string, token: string) => Promise<{ error: string | null }>;
  setClientQuickSession: (data: ClientLocalSession | null) => void;
  // Acciones Caja POS
  setPosCashierSession: (data: PosCashierSession | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const POS_SESSION_KEY = 'aitama_pos_cashier_session';
const CLIENT_SESSION_KEY = 'aitama_client_quick_session';
const OWNER_DEMO_KEY = 'aitama_owner_demo_session';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(isSupabaseConfigured);
  const [posSession, setPosSessionState] = useState<PosCashierSession | null>(() => {
    try {
      const raw = sessionStorage.getItem(POS_SESSION_KEY);
      return raw ? (JSON.parse(raw) as PosCashierSession) : null;
    } catch {
      return null;
    }
  });
  const [clientSession, setClientSessionState] = useState<ClientLocalSession | null>(() => {
    try {
      const raw = localStorage.getItem(CLIENT_SESSION_KEY);
      return raw ? (JSON.parse(raw) as ClientLocalSession) : null;
    } catch {
      return null;
    }
  });
  const [ownerDemoSession, setOwnerDemoSessionState] = useState<{ email: string } | null>(() => {
    try {
      const raw = sessionStorage.getItem(OWNER_DEMO_KEY);
      return raw ? (JSON.parse(raw) as { email: string }) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession ?? null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const appMeta = (session?.user?.app_metadata ?? {}) as AppJwtMetadata;
  const role: RolUsuario | null = appMeta.role ?? null;
  const negocioId: string | null = appMeta.negocio_id ?? null;
  const sedeId: string | null = appMeta.sede_id ?? null;

  const setPosCashierSession = useCallback((data: PosCashierSession | null) => {
    setPosSessionState(data);
    try {
      if (data) {
        sessionStorage.setItem(POS_SESSION_KEY, JSON.stringify(data));
      } else {
        sessionStorage.removeItem(POS_SESSION_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const setClientQuickSession = useCallback((data: ClientLocalSession | null) => {
    setClientSessionState(data);
    try {
      if (data) {
        localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(data));
      } else {
        localStorage.removeItem(CLIENT_SESSION_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const setOwnerDemoSession = useCallback((data: { email: string } | null) => {
    setOwnerDemoSessionState(data);
    try {
      if (data) {
        sessionStorage.setItem(OWNER_DEMO_KEY, JSON.stringify(data));
      } else {
        sessionStorage.removeItem(OWNER_DEMO_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, []);

  const signInOwnerWithPassword = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { error: 'Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para iniciar sesión.' };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // Verificar rol estricto en app_metadata
    const userRole = (data.user?.app_metadata as AppJwtMetadata | undefined)?.role;
    if (userRole && userRole !== 'owner' && userRole !== 'superadmin') {
      await supabase.auth.signOut();
      return { error: 'Tu cuenta no tiene permisos de Dueño o Administrador.' };
    }

    // Comprobar si tiene 2FA TOTP activado
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasVerifiedTotp = factors?.totp?.some((f) => f.status === 'verified');
    if (hasVerifiedTotp) {
      return { error: null, mfaRequired: true };
    }
    return { error: null, mfaRequired: false };
  }, []);

  const signInOwnerWithGoogle = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { error: 'Supabase no configurado todavía.' };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin` },
    });
    return { error: error ? error.message : null };
  }, []);

  const verifyOwnerMfa = useCallback(async (code: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return { error: 'Supabase no configurado.' };
    const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
    if (listErr) return { error: listErr.message };
    const factor = factors?.totp?.find((f) => f.status === 'verified');
    if (!factor) return { error: 'No hay factor 2FA configurado.' };

    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (chErr) return { error: chErr.message };

    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code,
    });
    return { error: verErr ? verErr.message : null };
  }, []);

  const sendClientOtp = useCallback(async (phonePe: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return { error: 'Supabase no configurado.' };
    const { error } = await supabase.auth.signInWithOtp({ phone: phonePe });
    return { error: error ? error.message : null };
  }, []);

  const verifyClientOtp = useCallback(async (phonePe: string, token: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return { error: 'Supabase no configurado.' };
    const { error } = await supabase.auth.verifyOtp({
      phone: phonePe,
      token,
      type: 'sms',
    });
    return { error: error ? error.message : null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setPosCashierSession(null);
    setClientQuickSession(null);
    setOwnerDemoSession(null);
  }, [setPosCashierSession, setClientQuickSession, setOwnerDemoSession]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        negocioId,
        sedeId,
        loading,
        supabaseReady: isSupabaseConfigured,
        posSession,
        clientSession,
        ownerDemoSession,
        signInOwnerWithPassword,
        signInOwnerWithGoogle,
        verifyOwnerMfa,
        setOwnerDemoSession,
        sendClientOtp,
        verifyClientOtp,
        setClientQuickSession,
        setPosCashierSession,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
