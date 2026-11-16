import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
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
  const [tapCount, setTapCount] = useState(0);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
    };
  }, []);

  const handleMarIaLogoTap = (e: React.MouseEvent | React.TouchEvent) => {
    // Evita zoom o scroll accidental al dar toques rápidos en móvil
    e.stopPropagation();

    if (!onTriggerRoot) return;

    tapCountRef.current += 1;
    setTapCount(tapCountRef.current);

    // Feedback háptico en móviles compatibles
    try {
      if (navigator.vibrate) navigator.vibrate(35);
    } catch {
      // Ignorar
    }

    if (tapTimerRef.current) {
      window.clearTimeout(tapTimerRef.current);
    }

    if (tapCountRef.current >= 4) {
      tapCountRef.current = 0;
      setTapCount(0);
      onTriggerRoot();
      return;
    }

    // Ventana generosa de 3.5 segundos para que sea fácil en móviles
    tapTimerRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
      setTapCount(0);
    }, 3500);
  };

  return (
    <footer className="border-t border-black/10 bg-white relative">
      {/* Toast visual flotante en móvil mientras se dan los toques */}
      {tapCount > 0 && tapCount < 4 && (
        <div
          role="status"
          className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-[#14201E] text-white px-4 py-2.5 text-xs font-bold shadow-2xl flex items-center gap-2 border border-white/20 animate-bounce"
        >
          <ShieldCheck className="w-4 h-4 text-[#F2B632]" />
          <span>Consola Root: {tapCount} de 4 toques (da {4 - tapCount} más)</span>
        </div>
      )}

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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMarIaLogoTap}
            onTouchEnd={handleMarIaLogoTap}
            className="inline-flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-[#F4F6F4] active:bg-[#E8F1EE] transition select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C45] touch-manipulation"
            aria-label="Desarrollado por MarIA Sistemas Digitales (4 clics para consola Root)"
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

          {/* Botón directo opcional para desarrollador */}
          {onTriggerRoot && (
            <button
              type="button"
              onClick={onTriggerRoot}
              title="Abrir Consola Root (Clave 1982)"
              className="rounded-lg p-1.5 text-[#546560] hover:text-[#0F4C45] hover:bg-[#F4F6F4] transition"
              aria-label="Acceso directo consola Root"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
