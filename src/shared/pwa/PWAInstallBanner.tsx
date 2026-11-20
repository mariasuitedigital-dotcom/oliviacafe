import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Bell,
  Check,
  CheckCircle2,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import { usePWAInstall } from './usePWAInstall';
import { downloadBusinessVCard } from '@/src/shared/utils/vcard';

interface PWAInstallBannerProps {
  appName: string;
  incentiveText?: string;
  compact?: boolean;
  /** Muestra modal de bienvenida con instalación real PWA, alertas y contacto */
  mandatoryModal?: boolean;
  whatsappNumber?: string;
  negocioSlug?: string;
  onActivatePush?: () => Promise<void>;
}

const DISMISS_MODAL_KEY = 'olivia_pwa_modal_dismissed_v1';

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  appName,
  incentiveText,
  compact = false,
  mandatoryModal = false,
  whatsappNumber = '+51987111222',
  negocioSlug = 'olivia',
  onActivatePush,
}) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showFallbackSteps, setShowFallbackSteps] = useState(false);
  const [modalDismissed, setModalDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_MODAL_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [platformTab, setPlatformTab] = useState<'android' | 'ios'>(isIOS ? 'ios' : 'android');
  const [installingNative, setInstallingNative] = useState(false);
  const [pushReady, setPushReady] = useState<boolean>(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const [pushBusy, setPushBusy] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);

  useEffect(() => {
    setPlatformTab(isIOS ? 'ios' : 'android');
  }, [isIOS]);

  if (isInstalled) {
    return null;
  }

  const dismissModal = () => {
    try {
      sessionStorage.setItem(DISMISS_MODAL_KEY, '1');
    } catch {
      // Ignorar errores de almacenamiento
    }
    setModalDismissed(true);
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstallingNative(true);
      try {
        const accepted = await install();
        if (accepted) {
          return;
        }
      } finally {
        setInstallingNative(false);
      }
    }

    if (mandatoryModal) {
      setShowFallbackSteps(true);
    } else {
      setShowGuideModal(true);
    }
  };

  const handlePushAction = async () => {
    setPushBusy(true);
    try {
      if (onActivatePush) {
        await onActivatePush();
      } else if (typeof Notification !== 'undefined') {
        await Notification.requestPermission();
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        setPushReady(true);
      }
    } finally {
      setPushBusy(false);
    }
  };

  const handleContactAction = () => {
    downloadBusinessVCard({
      nombreNegocio: appName,
      telefonoWhatsapp: whatsappNumber,
      sitioUrl: `${window.location.origin}/c/${negocioSlug}`,
    });
    setContactSaved(true);
  };

  if (mandatoryModal) {
    if (modalDismissed) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
        role="dialog"
        aria-modal="true"
        aria-label={`Instalar aplicación ${appName}`}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-sm rounded-3xl bg-white overflow-hidden shadow-2xl border border-black/10"
        >
          {/* Cabecera visual con botón de cerrar */}
          <div className="relative h-32 bg-[#0F4C45] overflow-hidden">
            <img
              src="/src/assets/images/aitama_reward_cup_1794847436322.jpg"
              alt={appName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-75"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F4C45] via-[#0F4C45]/55 to-transparent" />

            <button
              type="button"
              onClick={dismissModal}
              aria-label="Cerrar ventana de instalación"
              className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-xl bg-[#F2B632] text-[#14201E] px-2.5 py-1 text-[11px] font-bold shadow">
              <Sparkles className="w-3 h-3" />
              <span>+1 Sello extra</span>
            </div>

            <div className="absolute bottom-3 left-4 right-4 flex items-center gap-3">
              <img
                src="/icons/client-192x192.png"
                alt=""
                className="w-11 h-11 rounded-2xl border border-white/25 bg-[#0F4C45] shadow-md shrink-0"
              />
              <div className="text-white min-w-0">
                <h2 className="text-base font-bold leading-tight truncate">
                  Instala {appName}
                </h2>
                <p className="text-[11px] text-white/85 truncate">
                  Acceso directo en la pantalla de tu celular
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Selector interactivo Android / iPhone */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F3F6F4]">
              <button
                type="button"
                onClick={() => setPlatformTab('android')}
                className={`py-2 rounded-lg text-xs font-bold transition ${
                  platformTab === 'android'
                    ? 'bg-white text-[#14201E] shadow-sm'
                    : 'text-[#546560]'
                }`}
              >
                Android / Chrome
              </button>
              <button
                type="button"
                onClick={() => setPlatformTab('ios')}
                className={`py-2 rounded-lg text-xs font-bold transition ${
                  platformTab === 'ios'
                    ? 'bg-white text-[#14201E] shadow-sm'
                    : 'text-[#546560]'
                }`}
              >
                iPhone / Safari
              </button>
            </div>

            {/* Pasos reales del navegador */}
            <div className="grid grid-cols-2 gap-2">
              {platformTab === 'ios' ? (
                <>
                  <div className="rounded-2xl bg-[#F3F6F4] p-3 flex flex-col items-center text-center gap-1.5">
                    <span className="w-8 h-8 rounded-xl bg-white text-[#0F4C45] flex items-center justify-center shadow-sm">
                      <Share className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-bold text-[#14201E]">1. Toca Compartir</span>
                  </div>
                  <div className="rounded-2xl bg-[#F3F6F4] p-3 flex flex-col items-center text-center gap-1.5">
                    <span className="w-8 h-8 rounded-xl bg-white text-[#0F4C45] flex items-center justify-center shadow-sm">
                      <PlusSquare className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-bold text-[#14201E]">2. A pantalla inicio</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-2xl bg-[#F3F6F4] p-3 flex flex-col items-center text-center gap-1.5">
                    <span className="w-8 h-8 rounded-xl bg-white text-[#0F4C45] flex items-center justify-center shadow-sm">
                      <MoreVertical className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-bold text-[#14201E]">1. Menú ⋮ Chrome</span>
                  </div>
                  <div className="rounded-2xl bg-[#F3F6F4] p-3 flex flex-col items-center text-center gap-1.5">
                    <span className="w-8 h-8 rounded-xl bg-white text-[#0F4C45] flex items-center justify-center shadow-sm">
                      <Download className="w-4 h-4" />
                    </span>
                    <span className="text-[11px] font-bold text-[#14201E]">2. Instalar app</span>
                  </div>
                </>
              )}
            </div>

            {/* Botón de instalación nativa real (solo dispara prompt nativo o muestra guía real) */}
            {isInstallable ? (
              <button
                type="button"
                disabled={installingNative}
                onClick={() => void handleInstallClick()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0F4C45] px-5 py-4 text-sm font-bold text-white shadow-sm hover:opacity-95 active:scale-[0.98] transition min-h-[52px]"
              >
                <Download className="w-4 h-4 text-[#F2B632]" />
                <span>{installingNative ? 'Abriendo instalador...' : 'Instalar App en mi celular'}</span>
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void handleInstallClick()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0F4C45] px-5 py-3.5 text-sm font-bold text-white shadow-sm hover:opacity-95 active:scale-[0.98] transition min-h-[48px]"
                >
                  <Smartphone className="w-4 h-4 text-[#F2B632]" />
                  <span>
                    {isIOS ? 'Ver pasos para instalar en iPhone' : 'Cómo instalar en mi celular'}
                  </span>
                </button>

                {showFallbackSteps && (
                  <div className="rounded-2xl bg-[#FEF6E0] border border-[#F2B632]/40 p-3 text-[11px] text-[#5C4100] leading-relaxed">
                    {isInIframe ? (
                      <p>
                        Estás viendo la app dentro de una vista previa o navegador integrado. Abre este enlace directamente en <strong>Chrome (Android)</strong> o <strong>Safari (iPhone)</strong> para que aparezca el instalador nativo.
                      </p>
                    ) : isIOS ? (
                      <p>
                        En Safari: toca el ícono <strong>Compartir</strong> (abajo) y selecciona <strong>“Agregar a pantalla de inicio”</strong> → <strong>Agregar</strong>.
                      </p>
                    ) : (
                      <p>
                        Toca los 3 puntos <strong>(⋮)</strong> arriba a la derecha en Chrome y elige <strong>“Instalar aplicación”</strong> o <strong>“Agregar a la pantalla principal”</strong>.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Botones de acción directa: Alertas + Guardar Contacto */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-black/10">
              <button
                type="button"
                disabled={pushBusy}
                onClick={() => void handlePushAction()}
                className={`rounded-xl px-3 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition min-h-[44px] ${
                  pushReady
                    ? 'bg-[#E8F1EE] text-[#0F4C45]'
                    : 'bg-[#FEF6E0] text-[#7A5600] hover:brightness-95 active:scale-[0.98]'
                }`}
              >
                {pushReady ? <Check className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                <span>{pushReady ? 'Alertas OK' : 'Activar alertas'}</span>
              </button>

              <button
                type="button"
                onClick={handleContactAction}
                className={`rounded-xl px-3 py-3 text-xs font-bold flex items-center justify-center gap-1.5 transition min-h-[44px] ${
                  contactSaved
                    ? 'bg-[#E8F1EE] text-[#0F4C45]'
                    : 'bg-[#F3F6F4] text-[#14201E] hover:bg-[#E8F1EE] active:scale-[0.98]'
                }`}
              >
                {contactSaved ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                <span>{contactSaved ? 'Guardado' : 'Guardar chat'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={dismissModal}
              className="w-full py-2 text-xs font-semibold text-[#546560] hover:text-[#14201E] transition"
            >
              Continuar en el navegador
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-95 active:scale-[0.98] whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Instalar app</span>
        </button>
      ) : (
        <div className="rounded-2xl bg-white p-4 border border-black/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--brand-neutral)]">
                Instala {appName} en tu inicio
              </p>
              <p className="text-xs text-[#4A5A56] mt-0.5 leading-relaxed">
                {incentiveText ||
                  'Accede en un toque sin usar navegador y recibe alertas directas en tu celular.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleInstallClick()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-xs font-semibold text-white transition hover:opacity-95 active:scale-[0.98] whitespace-nowrap shrink-0 min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span>{isIOS ? 'Cómo instalar en iPhone' : 'Instalar app'}</span>
          </button>
        </div>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Instrucciones de instalación"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--brand-neutral)]">
                Instalar {appName}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-9 h-9 rounded-full bg-[#F3F6F4] flex items-center justify-center text-[#4A5A56] hover:text-[var(--brand-neutral)]"
                aria-label="Cerrar guía"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInIframe ? (
              <div className="rounded-2xl bg-[#FEF6E0] p-4 text-xs text-[#5C4100] leading-relaxed">
                Estás dentro de una vista previa o navegador integrado. Para instalar la app en tu pantalla de inicio, abre esta página directamente en <strong>Chrome</strong> o <strong>Safari</strong>.
              </div>
            ) : isIOS ? (
              <div className="space-y-3 text-sm text-[#354440]">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#F3F6F4]">
                  <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-[var(--brand-neutral)] flex items-center gap-1.5">
                      Toca el botón Compartir <Share className="w-4 h-4 text-[var(--brand-primary)]" />
                    </p>
                    <p className="text-xs text-[#546560] mt-0.5">
                      Está en la barra inferior de Safari (cuadrado con flecha hacia arriba).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#F3F6F4]">
                  <span className="w-6 h-6 rounded-full bg-[var(--brand-primary)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-[var(--brand-neutral)] flex items-center gap-1.5">
                      Selecciona “Agregar a inicio” <PlusSquare className="w-4 h-4 text-[var(--brand-primary)]" />
                    </p>
                    <p className="text-xs text-[#546560] mt-0.5">
                      Desliza hacia abajo en el menú y confirma tocando “Agregar”.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-[#354440]">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#F3F6F4]">
                  <CheckCircle2 className="w-5 h-5 text-[var(--brand-primary)] shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed">
                    Abre el menú de tu navegador (⋮) y selecciona{' '}
                    <strong>“Instalar aplicación”</strong> o <strong>“Agregar a la pantalla principal”</strong>.
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-xl bg-[var(--brand-primary)] py-3 text-sm font-semibold text-white min-h-[44px]"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
