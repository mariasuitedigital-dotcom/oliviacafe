import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, QrCode, ShieldCheck, Sparkles, Volume2, VolumeX, Coffee } from 'lucide-react';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useAuth } from '@/src/shared/auth/AuthContext';
import {
  getSplashSoundMuted,
  playWarmCoffeeChime,
  setSplashSoundMuted,
} from '@/src/shared/pwa/welcomeSound';

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

// Partículas doradas determinísticas (evita saltos de hidratación)
const GOLDEN_PARTICLES = [
  { id: 1, left: '16%', top: '26%', size: 4, delay: 0.2, duration: 3.4 },
  { id: 2, left: '28%', top: '68%', size: 3, delay: 0.6, duration: 3.8 },
  { id: 3, left: '42%', top: '20%', size: 5, delay: 0.4, duration: 4.1 },
  { id: 4, left: '62%', top: '24%', size: 3, delay: 0.9, duration: 3.5 },
  { id: 5, left: '78%', top: '34%', size: 4, delay: 0.3, duration: 3.9 },
  { id: 6, left: '84%', top: '64%', size: 3, delay: 0.7, duration: 3.6 },
  { id: 7, left: '22%', top: '48%', size: 2.5, delay: 1.0, duration: 4.0 },
  { id: 8, left: '72%', top: '52%', size: 2.5, delay: 0.5, duration: 3.7 },
  { id: 9, left: '36%', top: '76%', size: 3.5, delay: 1.1, duration: 4.2 },
  { id: 10, left: '64%', top: '74%', size: 4, delay: 0.8, duration: 3.5 },
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
  const effectiveMinMs = minDurationMs ?? (isClient ? 2200 : 1250);
  const clientAutoCloseMs = 7600;

  const [installedLaunch] = useState<boolean>(() => isInstalledPwaLaunch());
  const [minElapsed, setMinElapsed] = useState(false);
  const [forceReady, setForceReady] = useState(false);
  const [clientDismissed, setClientDismissed] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => getSplashSoundMuted());
  const revealSoundPlayedRef = useRef(false);

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

    let soundTimer: number | null = null;
    if (isClient && !revealSoundPlayedRef.current) {
      soundTimer = window.setTimeout(() => {
        revealSoundPlayedRef.current = true;
        void playWarmCoffeeChime('reveal', muted);
      }, 420);
    }

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
      if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
      if (soundTimer) window.clearTimeout(soundTimer);
    };
  }, [installedLaunch, effectiveMinMs, maxDurationMs, isClient, muted]);

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

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSplashSoundMuted(next);
  };

  const handleEnterClient = () => {
    void playWarmCoffeeChime('enter', muted);
    try {
      if (navigator.vibrate) navigator.vibrate(25);
    } catch {
      // Ignorar si no soporta vibración
    }
    setClientDismissed(true);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`app-splash-${appRole}`}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none px-6 bg-[#06100E] text-white"
          style={{
            background:
              'radial-gradient(circle at 50% 36%, #16544B 0%, #0A201D 52%, #050D0C 100%)',
          }}
          aria-label={`Bienvenida a ${brandName}`}
          role="dialog"
          aria-modal="true"
        >
          {/* Botón discreto de silencio (solo Clientes) */}
          {isClient && (
            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={muted ? 'Activar sonido de bienvenida' : 'Silenciar sonido'}
              className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/80 transition pwa-safe-top"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#F2B632]" />}
            </button>
          )}

          {/* Partículas doradas sutiles flotando */}
          {isClient && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
              {GOLDEN_PARTICLES.map((p) => (
                <motion.span
                  key={p.id}
                  initial={{ opacity: 0, y: 16, scale: 0.6 }}
                  animate={{
                    opacity: [0, 0.75, 0.25, 0],
                    y: [-4, -36, -64],
                    scale: [0.6, 1.15, 0.8],
                  }}
                  transition={{
                    delay: p.delay,
                    duration: p.duration,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="absolute rounded-full bg-[#F2B632] blur-[0.5px]"
                  style={{
                    left: p.left,
                    top: p.top,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Halo de luz focal detrás del emblema */}
          <motion.div
            initial={{ opacity: 0, scale: 0.65 }}
            animate={{ opacity: [0.15, 0.52, 0.32], scale: [0.8, 1.16, 1] }}
            transition={{ duration: isClient ? 2.4 : 1.25, ease: 'easeOut' }}
            className="absolute w-80 h-80 rounded-full pointer-events-none blur-3xl"
            style={{ backgroundColor: 'rgba(242, 182, 50, 0.24)' }}
          />

          {/* Contenedor central con zoom cinematográfico suave */}
          <motion.div
            initial={{ scale: 0.94 }}
            animate={{ scale: 1.01 }}
            transition={{ duration: isClient ? 4.5 : 1.3, ease: 'easeOut' }}
            className="relative flex flex-col items-center max-w-sm w-full text-center"
          >
            {/* Emblema + Arco luminoso Disney+ + Trazado dorado */}
            <div className="relative w-32 h-32 flex items-center justify-center">
              {/* Destello estelar al cerrarse el arco */}
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: [0, 0.85, 0], scale: [0.5, 1.45, 1.7] }}
                transition={{
                  delay: isClient ? 1.25 : 0.75,
                  duration: 0.75,
                  ease: 'easeOut',
                }}
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                  background:
                    'radial-gradient(circle, rgba(255,244,210,0.7) 0%, rgba(242,182,50,0.28) 45%, transparent 72%)',
                }}
              />

              {/* Arco luminoso orbital SVG */}
              <svg
                viewBox="0 0 140 140"
                className="absolute inset-0 w-full h-full -rotate-110"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="oliviaGoldArcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#F2B632" stopOpacity="0.1" />
                    <stop offset="55%" stopColor="#F2B632" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#FFF7DA" stopOpacity="1" />
                  </linearGradient>
                </defs>

                {/* Guía circular sutil */}
                <circle
                  cx="70"
                  cy="70"
                  r="60"
                  fill="none"
                  stroke="rgba(242, 182, 50, 0.14)"
                  strokeWidth="1.5"
                />

                {/* Arco cometa principal */}
                <motion.circle
                  cx="70"
                  cy="70"
                  r="60"
                  fill="none"
                  stroke="url(#oliviaGoldArcGrad)"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0.35 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    duration: isClient ? 1.45 : 0.9,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />

                {/* Arco exterior fino cruzado estilo Disney+ */}
                <motion.path
                  d="M 18 86 A 64 64 0 0 1 124 48"
                  fill="none"
                  stroke="rgba(255, 243, 209, 0.65)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: [0, 1, 1], opacity: [0, 0.9, 0] }}
                  transition={{
                    delay: 0.25,
                    duration: isClient ? 1.6 : 0.9,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </svg>

              {/* Medallón central con trazado dorado artesanal de taza */}
              <motion.div
                initial={{ scale: 0.65, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  duration: isClient ? 0.85 : 0.5,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative w-22 h-22 rounded-full bg-gradient-to-b from-[#135A51] to-[#0A352F] border border-[#F2B632]/55 shadow-2xl flex items-center justify-center overflow-hidden"
              >
                {negocio?.logo_url ? (
                  <img
                    src={negocio.logo_url}
                    alt={brandName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    viewBox="0 0 64 64"
                    className="w-11 h-11"
                    fill="none"
                    aria-hidden="true"
                  >
                    {/* Ondas de vapor dibujadas */}
                    <motion.path
                      d="M24 19 C22 15, 26 12, 24 8"
                      stroke="#FFF3D1"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.9 }}
                      transition={{ delay: 0.35, duration: isClient ? 0.8 : 0.45, ease: 'easeOut' }}
                    />
                    <motion.path
                      d="M32 18 C30 13, 35 10, 33 6"
                      stroke="#F2B632"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ delay: 0.45, duration: isClient ? 0.85 : 0.45, ease: 'easeOut' }}
                    />
                    <motion.path
                      d="M40 19 C38 15, 42 12, 40 8"
                      stroke="#FFF3D1"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.9 }}
                      transition={{ delay: 0.55, duration: isClient ? 0.8 : 0.45, ease: 'easeOut' }}
                    />

                    {/* Taza dibujada trazo a trazo en dorado */}
                    <motion.path
                      d="M15 26 H43 V39 C43 46.5 37 52 29 52 C21 52 15 46.5 15 39 V26 Z"
                      stroke="#F2B632"
                      strokeWidth="2.8"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0, fill: 'rgba(242,182,50,0)' }}
                      animate={{
                        pathLength: 1,
                        fill: ['rgba(242,182,50,0)', 'rgba(242,182,50,0)', 'rgba(242,182,50,0.16)'],
                      }}
                      transition={{
                        delay: 0.2,
                        duration: isClient ? 1.2 : 0.65,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    />

                    {/* Asa de la taza */}
                    <motion.path
                      d="M43 29 H47.5 C50.8 29 53 31.4 53 34.5 C53 37.6 50.8 40 47.5 40 H43"
                      stroke="#F2B632"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{
                        delay: 0.65,
                        duration: isClient ? 0.65 : 0.4,
                        ease: 'easeOut',
                      }}
                    />

                    {/* Platillo inferior */}
                    <motion.path
                      d="M13 55 H45"
                      stroke="#FFF3D1"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.9 }}
                      transition={{
                        delay: 0.85,
                        duration: isClient ? 0.55 : 0.35,
                        ease: 'easeOut',
                      }}
                    />
                  </svg>
                )}

                {/* Barrido de brillo metálico sobre el medallón */}
                <motion.div
                  initial={{ x: '-140%' }}
                  animate={{ x: '160%' }}
                  transition={{
                    delay: isClient ? 1.35 : 0.65,
                    duration: 0.95,
                    ease: 'easeInOut',
                  }}
                  className="absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/35 to-transparent skew-x-[-20deg] pointer-events-none"
                />
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

            {/* Marca con barrido luminoso tipo cine */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: isClient ? 0.85 : 0.3,
                duration: 0.65,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-6 relative overflow-hidden"
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#F2B632]">
                {brandName} · {meta.subtitle}
              </p>

              {isClient ? (
                <>
                  <motion.h1
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 1.35, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-white"
                  >
                    {greetingHeadline}
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 0.92, y: 0 }}
                    transition={{ delay: 1.75, duration: 0.65, ease: 'easeOut' }}
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

            {/* Botón Empezar dorado con reflejo sutil (solo Clientes) */}
            {isClient && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 2.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="mt-8 w-full max-w-[236px]"
              >
                <button
                  type="button"
                  onClick={handleEnterClient}
                  className="relative overflow-hidden w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F2B632] px-6 py-3.5 text-sm font-bold text-[#14201E] shadow-2xl hover:brightness-105 active:scale-[0.97] transition min-h-[50px] cursor-pointer"
                >
                  <motion.span
                    initial={{ x: '-140%' }}
                    animate={{ x: '200%' }}
                    transition={{
                      delay: 2.5,
                      duration: 1.2,
                      repeat: Infinity,
                      repeatDelay: 2.0,
                      ease: 'easeInOut',
                    }}
                    className="absolute inset-y-0 w-14 bg-gradient-to-r from-transparent via-white/45 to-transparent skew-x-[-20deg] pointer-events-none"
                  />
                  <span className="relative z-10">Empezar</span>
                  <ArrowRight className="w-4 h-4 relative z-10" />
                </button>
              </motion.div>
            )}
          </motion.div>

          {/* Barra luminosa inferior sutil */}
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
