import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, QrCode, X } from 'lucide-react';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onDecoded: (rawText: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ open, onClose, onDecoded }) => {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const decodedOnceRef = useRef(false);
  const readerElementId = 'olivia-pos-qr-reader';

  useEffect(() => {
    if (!open) return;

    decodedOnceRef.current = false;
    setCameraError(null);

    let active = true;
    const html5QrCode = new Html5Qrcode(readerElementId);
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            if (!active || decodedOnceRef.current) return;
            decodedOnceRef.current = true;
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate(70);
            }
            onDecoded(decodedText);
          },
          () => {
            // Frame sin QR detectado: ignorar silenciosamente
          }
        );
      } catch {
        if (active) {
          setCameraError(
            'No pudimos acceder a la cámara en este dispositivo o navegador. Puedes pegar el código QR o buscar por celular.'
          );
        }
      }
    };

    const timer = window.setTimeout(() => {
      void startScanner();
    }, 120);

    return () => {
      active = false;
      window.clearTimeout(timer);
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (instance) {
        try {
          if (instance.isScanning) {
            void instance.stop().then(() => instance.clear()).catch(() => {});
          } else {
            instance.clear();
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [open, onDecoded]);

  if (!open) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualInput.trim();
    if (!cleaned) return;
    onDecoded(cleaned);
    setManualInput('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Escáner QR de Caja POS"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0F4C45] text-[#F2B632] flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#14201E]">Escanear QR</h2>
              <p className="text-xs text-[#546560]">Pase Rápido de cliente o Cupón Promo</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F3F6F4] flex items-center justify-center text-[#4A5A56] hover:text-[#14201E]"
            aria-label="Cerrar escáner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden bg-[#14201E] min-h-[240px] flex items-center justify-center relative">
          <div id={readerElementId} className="w-full" />
          {cameraError && (
            <div className="absolute inset-0 p-5 flex flex-col items-center justify-center text-center text-white bg-[#14201E]/95">
              <QrCode className="w-10 h-10 text-[#F2B632] mb-2" />
              <p className="text-xs leading-relaxed text-white/85">{cameraError}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Pega código QR, cupón CUP-... o #OL-8942"
            className="flex-1 rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs text-[#14201E] placeholder:text-[#7B8B86] focus:outline-none focus:ring-2 focus:ring-[#0F4C45] min-h-[44px]"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white whitespace-nowrap min-h-[44px]"
          >
            Validar
          </button>
        </form>
      </div>
    </div>
  );
};
