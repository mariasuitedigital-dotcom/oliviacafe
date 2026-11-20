import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Coffee, QrCode, ShieldCheck, Sparkles } from 'lucide-react';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useAuth } from '@/src/shared/auth/AuthContext';

export type SplashAppRole = 'client' | 'pos' | 'admin';

interface AppSplashScreenProps {
  appRole?: SplashAppRole;
  minDurationMs?: number;
  maxDurationMs?: number;
}

const ROLE_META: Record<
  SplashAppRole,
  {
    subtitle: string;
    badgeLabel: string | null;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  client: {
    subtitle: 'Club de Sellos',
    badgeLabel: null,
    Icon: Coffee,
  },
  pos: {
    subtitle: 'Terminal POS',
    badgeLabel: 'CAJA',
    Icon: QrCode,
  },
  admin: {
    subtitle: 'Panel Ejecutivo',
    badgeLabel: 'ADMIN',
    Icon: ShieldCheck,
  },
};

const MOTIVATING_PHRASES = [
  'Hoy es un gran día para disfrutar un buen café.',
  'Cada visita te acerca más a tu premio gratis.',
  'Qué gusto tenerte de vuelta en tu club favorito.',
  'Tu pausa perfecta de café y pastelería empieza aquí.',
];

function getPeruGreeting(): string {
  try {
    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Lima',
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    const hour = Number(hourStr);
    if (hour >= 5 && hour < 12) return '¡Buenos días';
    if (hour >= 12 && hour < 19) return '¡Buenas tardes';
    return '¡Buenas noches';
  } catch {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return '¡Buenos días';
    if (h >= 12 && h < 19) return '¡Buenas tardes';
    return '¡Buenas noches';
  }
}

function extractFirstName(fullName?: string | null): string | null {
  if (!fullName) return null;
  const trimmed = fullName.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/)[0];
  if (!first) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function isInstalledPwaLaunch(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({
  appRole = 'client',
  minDurationMs,
  maxDurationMs = 2600,
}) => {
  const { negocio, loading: themeLoading } = useTheme();
  const { clientSession, user, loading: authLoading } = useAuth();

  const isClient = appRole === 'client';
  const effectiveMinMs = minDurationMs ?? (isClient ? 2000 : 1250);
  const clientAutoCloseMs = 6800; // ~2s animación + ~4.8s para saludar y permitir pulsar "Empezar"

  const [installedLaunch] = useState<boolean>(() => isInstalledPwaLaunch());
  const [minElapsed, setMinElapsed] = useState(false);
  const [forceReady, setForceReady] = useState(false);
  const [clientDismissed, setClientDismissed] = useState(false);

  const phrase = useMemo(
    () => MOTIVATING_PHRASES[Math.floor(Math.random() * MOTIVATING_PHRASES.length)],
    []
  );

  useEffect(() => {
    if (!installedLaunch) return;

    const minTimer = window.setTimeout(() => setMinElapsed(true), effectiveMinMs);
    const maxTimer = window.setTimeout(
      () => setForceReady(true),
      isClient ? clientAutoCloseMs : maxDurationMs
    );
    const autoCloseTimer = isClient
      ? window.setTimeout(() => setClientDismissed(true), clientAutoCloseMs)
      : null;

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
      if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
    };
  }, [installedLaunch, effectiveMinMs, maxDurationMs, isClient]);

  const appReady = forceReady || (!authLoading && !themeLoading);
  const visible = isClient
    ? installedLaunch && !clientDismissed
    : installedLaunch && !(minElapsed && appReady);

  const brandName = negocio?.nombre || 'Olivia Café';
  const meta = ROLE_META[appRole];
  const RoleIcon = meta.Icon;

  const firstName = extractFirstName(
    clientSession?.nombre || (user?.user_metadata?.nombre as string | undefined)
  );
  const greetingHeadline = firstName
    ? `${getPeruGreeting()}, ${firstName}!`
    : `${getPeruGreeting()}!`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`app-splash-${appRole}`}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none px-6 bg-[#0A1816] text-white"
          style={{
            background:
              'radial-gradient(circle at 50% 38%, #134E46 0%, #0C2622 52%, #071210 100%)',
          }}
          aria-label={`Bienvenida a ${brandName}`}
          role="dialog"
          aria-modal="true"
        >
          {/* Halo ambiental dorado */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0.18, 0.48, 0.3], scale: [0.85, 1.12, 1] }}
            transition={{ duration: isClient ? 2.2 : 1.25, ease: 'easeOut' }}
            className="absolute w-80 h-80 rounded-full pointer-events-none blur-3xl"
            style={{ backgroundColor: 'rgba(242, 182, 50, 0.22)' }}
          />

          <div className="relative flex flex-col items-center max-w-sm w-full text-center">
            {/* Emblema central con anillo luminoso animado */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <motion.svg
                viewBox="0 0 120 120"
                className="absolute inset-0 w-full h-full -rotate-90"
                aria-hidden="true"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="rgba(242, 182, 50, 0.16)"
                  strokeWidth="2.5"
                />
                <motion.circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#F2B632"
                  strokeWidth="3"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0.4 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    duration: isClient ? 1.45 : 0.9,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </motion.svg>

              <motion.div
                initial={{ scale: 0.55, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: isClient ? 0.75 : 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="w-20 h-20 rounded-full bg-[#0F4C45] border border-[#F2B632]/50 shadow-2xl flex items-center justify-center overflow-hidden"
              >
                {negocio?.logo_url ? (
                  <img
                    src={negocio.logo_url}
                    alt={brandName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Coffee className="w-9 h-9 text-[#F2B632]" />
                )}
              </motion.div>

              {meta.badgeLabel && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35, duration: 0.35 }}
                  className="absolute -bottom-1 inline-flex items-center gap-1 rounded-lg bg-[#F2B632] text-[#14201E] px-2 py-0.5 text-[9px] font-extrabold tracking-wider shadow-md"
                >
                  <RoleIcon className="w-2.5 h-2.5" />
                  <span>{meta.badgeLabel}</span>
                </motion.span>
              )}
            </div>

            {/* Marca + Subtítulo */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: isClient ? 0.5 : 0.28,
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-5"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#F2B632]">
                {brandName} · {meta.subtitle}
              </p>

              {isClient ? (
                <>
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.0, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-white"
                  >
                    {greetingHeadline}
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 0.9, y: 0 }}
                    transition={{ delay: 1.35, duration: 0.6, ease: 'easeOut' }}
                    className="mt-2.5 text-sm text-white/85 leading-relaxed max-w-xs mx-auto flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-[#F2B632] shrink-0" />
                    <span>{phrase}</span>
                  </motion.p>
                </>
              ) : (
                <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {brandName}
                </h1>
              )}
            </motion.div>

            {/* Botón Empezar (solo Clientes) */}
            {isClient && (
              <motion.div
                initial={{ opacity: 0, y: 14, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 1.75, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="mt-8 w-full max-w-[230px]"
              >
                <button
                  type="button"
                  onClick={() => setClientDismissed(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F2B632] px-6 py-3.5 text-sm font-bold text-[#14201E] shadow-xl hover:brightness-105 active:scale-[0.97] transition min-h-[50px] cursor-pointer"
                >
                  <span>Empezar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </div>

          {/* Barra luminosa inferior sutil (en Clientes muestra el avance hasta entrar automático) */}
          <div className="absolute bottom-12 w-36 h-1 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '0%' }}
              transition={{
                duration: isClient ? clientAutoCloseMs / 1000 : 1.1,
                ease: isClient ? 'linear' : [0.22, 1, 0.36, 1],
              }}
              className="h-full w-full rounded-full bg-gradient-to-r from-[#F2B632]/60 via-[#F2B632] to-white"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
