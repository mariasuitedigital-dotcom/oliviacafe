import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Coffee } from 'lucide-react';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

interface ClientSplashScreenProps {
  durationMs?: number;
}

function isInstalledPwaLaunch(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export const ClientSplashScreen: React.FC<ClientSplashScreenProps> = ({
  durationMs = 1450,
}) => {
  const { negocio } = useTheme();
  const [visible, setVisible] = useState<boolean>(() => isInstalledPwaLaunch());

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, visible]);

  const brandName = negocio?.nombre || 'Olivia Café';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="client-splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden select-none bg-[#0A1816] text-white"
          style={{
            background:
              'radial-gradient(circle at 50% 42%, #134E46 0%, #0C2622 52%, #071210 100%)',
          }}
          aria-label={`Cargando ${brandName}`}
          role="status"
        >
          {/* Halo ambiental dorado */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0.2, 0.45, 0.28], scale: [0.85, 1.08, 1] }}
            transition={{ duration: 1.35, ease: 'easeOut' }}
            className="absolute w-72 h-72 rounded-full pointer-events-none blur-3xl"
            style={{ backgroundColor: 'rgba(242, 182, 50, 0.22)' }}
          />

          <div className="relative flex flex-col items-center">
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
                  transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
                />
              </motion.svg>

              <motion.div
                initial={{ scale: 0.55, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
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
            </div>

            {/* Revelado cinematográfico de marca */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 text-center"
            >
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {brandName}
              </h1>
              <motion.p
                initial={{ opacity: 0, letterSpacing: '0.35em' }}
                animate={{ opacity: 0.9, letterSpacing: '0.22em' }}
                transition={{ delay: 0.45, duration: 0.6, ease: 'easeOut' }}
                className="mt-1.5 text-[11px] font-bold uppercase text-[#F2B632]"
              >
                Club de Sellos
              </motion.p>
            </motion.div>
          </div>

          {/* Barra luminosa inferior sutil */}
          <div className="absolute bottom-14 w-32 h-1 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '0%' }}
              transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              className="h-full w-full rounded-full bg-gradient-to-r from-[#F2B632]/60 via-[#F2B632] to-white"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
