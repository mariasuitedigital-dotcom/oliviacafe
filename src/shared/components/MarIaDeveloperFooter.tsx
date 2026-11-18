import React, { useEffect, useRef } from 'react';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

interface MarIaDeveloperFooterProps {
  onTriggerRoot?: () => void;
  onOpenPrivacy?: () => void;
}

export const MarIaDeveloperFooter: React.FC<MarIaDeveloperFooterProps> = ({
  onTriggerRoot,
  onOpenPrivacy,
}) => {
  const { negocio } = useTheme();
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
    };
  }, []);

  const handleMarIaLogoTap = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!onTriggerRoot) return;

    tapCountRef.current += 1;

    if (tapTimerRef.current) {
      window.clearTimeout(tapTimerRef.current);
    }

    if (tapCountRef.current >= 4) {
      tapCountRef.current = 0;
      onTriggerRoot();
      return;
    }

    tapTimerRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
    }, 2500);
  };

  return (
    <footer className="border-t border-black/10 bg-white relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#546560]">
        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
          <span className="font-bold text-[#14201E]">{negocio.nombre}</span>
          <span aria-hidden="true">·</span>
          <span>Miraflores & San Isidro, Lima</span>
          {onOpenPrivacy && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={onOpenPrivacy}
                className="hover:text-[#0F4C45] underline py-1"
              >
                Privacidad
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleMarIaLogoTap}
          className="inline-flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-[#F4F6F4] active:bg-[#E8F1EE] transition select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C45] touch-manipulation"
          aria-label="Desarrollado por MarIA Sistemas Digitales"
        >
          <img
            src="/assets/aistudio/Captura_de_Pantalla_2026-11-14_a_la_s__13.37.51_9d5343a3.png"
            alt="Logo MarIA Sistemas Digitales"
            className="w-7 h-7 rounded-lg object-cover border border-black/10 shrink-0 pointer-events-none"
          />
          <span className="text-[11px] font-medium text-[#4A5A56] text-left">
            Desarrollado por <strong className="font-bold text-[#14201E]">MarIA Sistemas Digitales</strong>
          </span>
        </button>
      </div>
    </footer>
  );
};
