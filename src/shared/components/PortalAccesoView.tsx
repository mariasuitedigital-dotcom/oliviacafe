import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  Bell,
  Cake,
  Check,
  CheckCircle2,
  Coffee,
  Copy,
  Download,
  Gift,
  KeyRound,
  Lock,
  MessageCircle,
  Phone,
  Plus,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Store,
  Tablet,
  UserPlus,
  X,
} from 'lucide-react';
import { useAuth } from '@/src/shared/auth/AuthContext';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { usePWAInstall } from '@/src/shared/pwa/usePWAInstall';
import { getSupabaseClient } from '@/src/shared/lib/supabase';
import { registerClientPushSubscription } from '@/src/shared/pwa/pushSubscription';
import { downloadBusinessVCard } from '@/src/shared/utils/vcard';
import {
  confirmarOtpPrimerIngreso,
  validarAccesoClaveConOtp,
} from '@/src/shared/auth/accessProvisioning';
import { MarIaDeveloperFooter } from '@/src/shared/components/MarIaDeveloperFooter';
import { RootProvisioningModal } from '@/src/apps/admin/components/RootProvisioningModal';

type ActiveModal =
  | null
  | 'cliente-register'
  | 'cliente-login'
  | 'negocio-hub'
  | 'negocio-admin'
  | 'privacy';

type RegisterStage = 'form' | 'activate';
type HeroVisualScene = 'barra' | 'premio';

const MESES_PERU = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface PortalAccesoViewProps {
  /** Si es true (desde /c/:slug), desactiva también el acceso oculto de negocio */
  clientOnly?: boolean;
}

export const PortalAccesoView: React.FC<PortalAccesoViewProps> = ({ clientOnly = false }) => {
  const { negocio } = useTheme();
  const {
    supabaseReady,
    setClientQuickSession,
    setOwnerDemoSession,
    sendClientOtp,
    verifyClientOtp,
  } = useAuth();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [registerStage, setRegisterStage] = useState<RegisterStage>('form');

  // Escena interactiva en la imagen hero
  const [heroScene, setHeroScene] = useState<HeroVisualScene>('barra');
  const [previewStamps, setPreviewStamps] = useState<number>(6);

  const [logoTapCount, setLogoTapCount] = useState<number>(0);
  const logoTapCountRef = useRef<number>(0);
  const logoTapTimerRef = useRef<number | null>(null);

  const handleSecretLogoClick = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();

    logoTapCountRef.current += 1;
    setLogoTapCount(logoTapCountRef.current);

    try {
      if (navigator.vibrate) navigator.vibrate(35);
    } catch {
      // Ignorar
    }

    if (logoTapTimerRef.current) {
      window.clearTimeout(logoTapTimerRef.current);
    }

    if (logoTapCountRef.current >= 3) {
      logoTapCountRef.current = 0;
      setLogoTapCount(0);
      setErrorMsg(null);
      setActiveModal('negocio-hub');
      return;
    }

    logoTapTimerRef.current = window.setTimeout(() => {
      logoTapCountRef.current = 0;
      setLogoTapCount(0);
    }, 3500);
  };

  // Registro Cliente
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [diaNac, setDiaNac] = useState<number>(15);
  const [mesNac, setMesNac] = useState<number>(5);
  const [anioNac, setAnioNac] = useState<string>('');
  const [consentimiento, setConsentimiento] = useState(false);

  // Requisitos de activación (PWA + Push + Libreta de contactos)
  const [pendingClientId, setPendingClientId] = useState<string>('demo-client-1');
  const [pwaConfirmed, setPwaConfirmed] = useState<boolean>(false);
  const [pushConfirmed, setPushConfirmed] = useState<boolean>(false);
  const [contactConfirmed, setContactConfirmed] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);

  // Ingreso Cliente
  const [clientPhoneLogin, setClientPhoneLogin] = useState('');
  const [otpStep, setOtpStep] = useState<'input' | 'code'>('input');
  const [otpCode, setOtpCode] = useState('');

  // Ingreso Negocio (Admin por clave de 8 dígitos + OTP primer ingreso)
  const [adminClave8, setAdminClave8] = useState('');
  const [adminPendingOtp, setAdminPendingOtp] = useState<{
    perfilId: string;
    nombre: string;
    email: string | null;
    destinoEnmascarado: string;
    demoOtpCode?: string;
  } | null>(null);
  const [adminOtpInput, setAdminOtpInput] = useState('');
  const [rootModalOpen, setRootModalOpen] = useState(false);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isInstalled) setPwaConfirmed(true);
  }, [isInstalled]);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      setPushConfirmed(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (logoTapTimerRef.current) window.clearTimeout(logoTapTimerRef.current);
    };
  }, []);

  const cleanDigits = (raw: string) => raw.replace(/\D/g, '').replace(/^51/, '').slice(0, 9);
  const regDigits = cleanDigits(telefono);
  const isRegPhoneValid = /^9\d{8}$/.test(regDigits);

  const loginDigits = cleanDigits(clientPhoneLogin);
  const isLoginPhoneValid = /^9\d{8}$/.test(loginDigits);

  const whatsappBusinessNumber = negocio.whatsapp_contacto_numero || '+51987111222';
  const whatsappCleanDigits = whatsappBusinessNumber.replace(/\D/g, '');
  const stepsCompletedCount =
    (pwaConfirmed ? 1 : 0) + (pushConfirmed ? 1 : 0) + (contactConfirmed ? 1 : 0);

  const openModal = (modal: ActiveModal) => {
    setErrorMsg(null);
    if (modal === 'cliente-register') {
      setRegisterStage('form');
    }
    if (modal === 'negocio-admin') {
      setAdminPendingOtp(null);
      setAdminOtpInput('');
      setAdminClave8('');
    }
    setActiveModal(modal);
  };

  const handleStampDemoTap = () => {
    setPreviewStamps((prev) => {
      const next = prev >= negocio.sellos_para_premio ? 1 : prev + 1;
      if (next >= negocio.sellos_para_premio) {
        setHeroScene('premio');
      }
      return next;
    });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (nombre.trim().length < 2) {
      setErrorMsg('Ingresa tu nombre completo.');
      return;
    }
    if (!isRegPhoneValid) {
      setErrorMsg('Ingresa un celular válido de Perú (9 dígitos iniciando con 9).');
      return;
    }
    if (!consentimiento) {
      setErrorMsg('Debes aceptar los avisos y la política de privacidad para crear tu cartilla.');
      return;
    }

    const fullPhonePe = `+51${regDigits}`;
    const parsedYear = anioNac.trim() ? Number(anioNac.trim()) : null;

    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        const { data, error } = await supabase.rpc('registrar_cliente_rapido', {
          p_negocio_slug: negocio.slug,
          p_nombre: nombre.trim(),
          p_celular: fullPhonePe,
          p_dia_nac: diaNac,
          p_mes_nac: mesNac,
          p_anio_nac: parsedYear,
          p_consentimiento_wa: consentimiento,
          p_origen: 'landing_registro',
        });
        if (error) throw error;
        const payload = data as { cliente: { id: string } };
        setPendingClientId(payload.cliente.id);
      } else {
        setPendingClientId(`demo-${regDigits}`);
      }
      setRegisterStage('activate');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos crear tu cartilla.');
    } finally {
      setBusy(false);
    }
  };

  const handleInstallStep = async () => {
    if (isInstalled) {
      setPwaConfirmed(true);
      return;
    }
    if (isInstallable) {
      const ok = await install();
      if (ok) setPwaConfirmed(true);
      return;
    }
    setShowIosGuide(true);
  };

  const handlePushStep = async () => {
    setErrorMsg(null);
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushConfirmed(true);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushConfirmed(true);
        await registerClientPushSubscription(negocio.id, pendingClientId);
        const supabase = getSupabaseClient();
        if (supabase && supabaseReady) {
          await supabase.rpc('otorgar_bonus_instalacion', {
            p_negocio_id: negocio.id,
            p_cliente_id: pendingClientId,
          });
        }
      } else {
        setErrorMsg(
          'Permiso de notificaciones denegado en este navegador. Puedes activarlo luego desde Perfil.'
        );
      }
    } catch {
      setErrorMsg('No se pudo solicitar el permiso de notificaciones.');
    }
  };

  const handleDownloadVCard = () => {
    downloadBusinessVCard({
      nombreNegocio: negocio.nombre,
      telefonoWhatsapp: whatsappBusinessNumber,
      subtitulo: negocio.subtitulo,
      sitioUrl: `${window.location.origin}/c/${negocio.slug}`,
    });
    setContactConfirmed(true);
  };

  const handleCopyNumber = async () => {
    try {
      await navigator.clipboard.writeText(whatsappBusinessNumber);
      setCopiedPhone(true);
      setContactConfirmed(true);
      window.setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      setContactConfirmed(true);
    }
  };

  const handleFinishActivation = async () => {
    const fullPhonePe = `+51${regDigits}`;
    const supabase = getSupabaseClient();
    if (supabase && supabaseReady && contactConfirmed) {
      await supabase
        .from('clientes')
        .update({ contacto_guardado: true, consentimiento_push: pushConfirmed })
        .eq('id', pendingClientId);
    }
    setClientQuickSession({
      cliente_id: pendingClientId,
      nombre: nombre.trim(),
      celular: fullPhonePe,
      negocio_slug: negocio.slug,
      modo: 'rapido_sin_otp',
      dia_nac: diaNac,
      mes_nac: mesNac,
      anio_nac: anioNac.trim() ? Number(anioNac.trim()) : null,
      consentimiento_push: pushConfirmed,
      contacto_guardado: contactConfirmed,
    });
    setActiveModal(null);
  };

  const handleClientLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!isLoginPhoneValid) {
      setErrorMsg('Ingresa un celular peruano válido de 9 dígitos (empieza en 9).');
      return;
    }
    const fullPhonePe = `+51${loginDigits}`;
    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      if (negocio.otp_requerido_login && supabase && supabaseReady) {
        if (otpStep === 'input') {
          const res = await sendClientOtp(fullPhonePe);
          if (res.error) throw new Error(res.error);
          setOtpStep('code');
        } else {
          const res = await verifyClientOtp(fullPhonePe, otpCode.trim());
          if (res.error) throw new Error(res.error);
        }
      } else if (supabase && supabaseReady) {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nombre, celular')
          .eq('negocio_id', negocio.id)
          .eq('celular', fullPhonePe)
          .maybeSingle();
        if (error) throw error;
        if (!data) {
          throw new Error('No encontramos una cartilla con ese celular. Pulsa "Registrarse" para crear la tuya.');
        }
        setClientQuickSession({
          cliente_id: data.id,
          nombre: data.nombre,
          celular: data.celular,
          negocio_slug: negocio.slug,
          modo: 'rapido_sin_otp',
        });
        setActiveModal(null);
      } else {
        setClientQuickSession({
          cliente_id: `demo-${loginDigits}`,
          nombre: 'María Quispe',
          celular: fullPhonePe,
          negocio_slug: negocio.slug,
          modo: 'rapido_sin_otp',
        });
        setActiveModal(null);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos validar tu número.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await validarAccesoClaveConOtp({
        supabaseReady,
        negocioId: negocio.id,
        rolObjetivo: 'owner',
        clave: adminClave8.trim(),
      });
      if (!res.valido) {
        throw new Error(res.mensaje || 'Clave de 8 dígitos incorrecta.');
      }
      if (res.requiereOtp && res.perfilId) {
        setAdminPendingOtp({
          perfilId: res.perfilId,
          nombre: res.nombreCompleto || 'Dueño',
          email: res.email || null,
          destinoEnmascarado: res.destinoEnmascarado || 'WhatsApp registrado',
          demoOtpCode: res.demoOtpCode,
        });
        setAdminOtpInput('');
        return;
      }
      setOwnerDemoSession({ email: res.email || res.nombreCompleto || 'dueno@oliviacafe.pe' });
      setAdminClave8('');
      setActiveModal(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error validando clave de 8 dígitos.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPendingOtp) return;
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await confirmarOtpPrimerIngreso({
        supabaseReady,
        perfilId: adminPendingOtp.perfilId,
        codigoOtp: adminOtpInput.trim(),
      });
      if (!res.autorizado || !res.perfil) {
        throw new Error(res.mensaje || 'Código OTP incorrecto.');
      }
      setOwnerDemoSession({
        email: res.perfil.email || res.perfil.nombre_completo || 'dueno@oliviacafe.pe',
      });
      setAdminPendingOtp(null);
      setAdminOtpInput('');
      setAdminClave8('');
      setActiveModal(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error validando código OTP.');
    } finally {
      setBusy(false);
    }
  };

  const rewardUnlocked = previewStamps >= negocio.sellos_para_premio;

  return (
    <div className="min-h-dvh bg-[#F4F6F4] text-[#14201E] flex flex-col">
      {/* Toast visual en móvil al dar toques al logo */}
      {logoTapCount > 0 && logoTapCount < 3 && (
        <div
          role="status"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-2xl bg-[#14201E] text-white px-4 py-2.5 text-xs font-bold shadow-2xl flex items-center gap-2 border border-white/20 animate-bounce"
        >
          <ShieldCheck className="w-4 h-4 text-[#F2B632]" />
          <span>Acceso Equipo: {logoTapCount} de 3 toques (da {3 - logoTapCount} más)</span>
        </div>
      )}

      {/* TOP BAR CONTRACT: Logo con acceso oculto (3 clics), enlaces y CTA */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-black/5 pwa-safe-top">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleSecretLogoClick}
            onTouchEnd={handleSecretLogoClick}
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#14201E] whitespace-nowrap shrink-0 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F4C45] rounded-xl pr-2 touch-manipulation"
            title="Toca 3 veces para acceso de equipo/dueño/root"
          >
            <span className="w-8 h-8 rounded-full bg-[#0F4C45] flex items-center justify-center border border-[#F2B632]">
              <Coffee className="w-4 h-4 text-[#F2B632]" />
            </span>
            <span>{negocio.nombre}</span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4A5A56]">
            <a href="#experiencia" className="hover:text-[#0F4C45] transition-colors whitespace-nowrap shrink-0">
              Cartilla digital
            </a>
            <a href="#como-funciona" className="hover:text-[#0F4C45] transition-colors whitespace-nowrap shrink-0">
              Cómo funciona
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {/* Botón de recarga rápida para móvil */}
            <button
              type="button"
              onClick={() => window.location.reload()}
              title="Recargar página / Actualizar datos"
              className="rounded-xl p-2 text-[#546560] hover:text-[#0F4C45] hover:bg-[#F3F6F4] transition active:scale-95"
              aria-label="Recargar página"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Acceso directo a Equipo / Dueño / Root */}
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setActiveModal('negocio-hub');
              }}
              title="Acceso Equipo (Caja POS / Dueño / Root)"
              className="rounded-xl p-2 text-[#546560] hover:text-[#0F4C45] hover:bg-[#F3F6F4] transition active:scale-95"
              aria-label="Acceso Equipo"
            >
              <Lock className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => openModal('cliente-register')}
              className="rounded-xl bg-[#0F4C45] px-4 py-2 text-xs font-bold text-white hover:opacity-95 transition whitespace-nowrap shrink-0 min-h-[40px]"
            >
              Registrarse
            </button>
          </div>
        </div>
      </header>

      <main id="inicio" className="flex-1">
        {/* 1. PRIMERA VISTA ARRIBA: IMAGEN DE LA CAFETERÍA + TÍTULO PROTAGÓNICO */}
        <section id="experiencia" className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="relative rounded-3xl overflow-hidden min-h-[340px] sm:min-h-[430px] bg-[#0F4C45] shadow-sm flex flex-col justify-between">
            <AnimatePresence mode="wait">
              <motion.img
                key={heroScene}
                src={
                  heroScene === 'barra'
                    ? '/src/assets/images/aitama_cafe_hero_1794847435488.jpg'
                    : '/src/assets/images/aitama_reward_cup_1794847436322.jpg'
                }
                alt={
                  heroScene === 'barra'
                    ? 'Barista preparando café en Olivia Café'
                    : 'Premio Flat White y Croissant artesanal en Olivia Café'
                }
                referrerPolicy="no-referrer"
                initial={{ opacity: 0.6, scale: 1.015 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.6 }}
                transition={{ duration: 0.22 }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </AnimatePresence>

            <div className="absolute inset-0 bg-gradient-to-t from-[#14201E]/95 via-[#14201E]/35 to-[#14201E]/25" />

            {/* Selector de escena arriba sobre la foto */}
            <div className="relative z-10 p-4 sm:p-6 flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-black/45 backdrop-blur-md border border-white/15">
                <button
                  type="button"
                  onClick={() => setHeroScene('barra')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    heroScene === 'barra' ? 'bg-white text-[#14201E]' : 'text-white/85 hover:text-white'
                  }`}
                >
                  Tu visita
                </button>
                <button
                  type="button"
                  onClick={() => setHeroScene('premio')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    heroScene === 'premio' ? 'bg-[#F2B632] text-[#14201E]' : 'text-white/85 hover:text-white'
                  }`}
                >
                  Tu premio
                </button>
              </div>
            </div>

            {/* Texto principal sobre la imagen de la cafetería */}
            <div className="relative z-10 p-5 sm:p-8 pt-16">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#F2B632]">
                {negocio.nombre} · Club de Sellos
              </p>
              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white text-balance mt-1">
                Tu café en Olivia, premiado.
              </h1>
              <p className="text-sm sm:text-base text-white/90 mt-2 max-w-xl">
                10 visitas = 1 café de especialidad o postre gratis.
              </p>
            </div>
          </div>
        </section>

        {/* 2. DEBAJO DE LA IMAGEN: CARTILLA INTERACTIVA + BOTONES REGISTRARSE E INGRESAR */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-8">
          <div className="rounded-3xl bg-white border border-black/10 p-4 sm:p-6 shadow-sm space-y-5">
            {/* Cartilla interactiva */}
            <div className="rounded-2xl bg-[#0F4C45] p-4 sm:p-6 text-white shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#F2B632]">
                    {negocio.nombre} · Cartilla interactiva
                  </p>
                  <p className="text-sm sm:text-base font-bold mt-0.5">
                    {rewardUnlocked
                      ? '¡Premio desbloqueado! Café + Croissant gratis'
                      : `Te faltan ${negocio.sellos_para_premio - previewStamps} sellos para tu premio gratis`}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-lg sm:text-xl font-bold tabular-nums text-[#F2B632] whitespace-nowrap">
                    {previewStamps}/{negocio.sellos_para_premio}
                  </span>
                  <button
                    type="button"
                    onClick={handleStampDemoTap}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#F2B632] text-[#14201E] px-3 py-2 text-xs font-bold shadow-sm hover:brightness-95 active:scale-95 transition whitespace-nowrap min-h-[38px]"
                  >
                    {rewardUnlocked ? (
                      <RotateCcw className="w-3.5 h-3.5" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>{rewardUnlocked ? 'Reiniciar' : '+1 Sello'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {Array.from({ length: negocio.sellos_para_premio }, (_, idx) => {
                  const num = idx + 1;
                  const filled = num <= previewStamps;
                  const isReward = num === negocio.sellos_para_premio;
                  return (
                    <motion.button
                      key={num}
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        setPreviewStamps(num);
                        if (num >= negocio.sellos_para_premio) setHeroScene('premio');
                      }}
                      aria-label={`Simular sello ${num}`}
                      className={`aspect-square rounded-xl flex items-center justify-center transition ${
                        filled
                          ? 'bg-[#F2B632] text-[#14201E] font-bold shadow-sm'
                          : isReward
                          ? 'bg-white/15 border border-dashed border-[#F2B632] text-[#F2B632]'
                          : 'bg-white/10 border border-dashed border-white/25 text-white/75 hover:bg-white/20'
                      }`}
                    >
                      {isReward ? <Gift className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Botones de acción: Registrarse e Ingresar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => openModal('cliente-register')}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0F4C45] px-6 py-3.5 text-sm font-bold text-white hover:opacity-95 active:scale-[0.99] transition whitespace-nowrap min-h-[50px]"
              >
                <UserPlus className="w-4 h-4 text-[#F2B632]" />
                <span>Registrarse (+1 sello regalo)</span>
              </button>

              <button
                type="button"
                onClick={() => openModal('cliente-login')}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#DCE3DE] px-6 py-3.5 text-sm font-bold text-[#14201E] hover:bg-[#CDD7D0] active:scale-[0.99] transition whitespace-nowrap min-h-[50px]"
              >
                <KeyRound className="w-4 h-4 text-[#0F4C45]" />
                <span>Ingresar</span>
              </button>
            </div>
          </div>
        </section>

        {/* 3. BENTO COMPACTO DE 3 PASOS ANTI-SPAM */}
        <section id="como-funciona" className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
          <div className="rounded-3xl bg-white border border-black/10 p-6 sm:p-7 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#0F4C45]">01 · Registro</p>
              <h2 className="text-base font-bold text-[#14201E]">Nombre, +51 y cumpleaños</h2>
              <p className="text-xs text-[#546560]">Listo en 15 segundos con +1 sello de regalo.</p>
            </div>

            <div className="space-y-1 md:border-l md:border-black/10 md:pl-6">
              <p className="text-xs font-bold text-[#0F4C45]">02 · App & Alertas</p>
              <h2 className="text-base font-bold text-[#14201E]">Instala y activa notificaciones</h2>
              <p className="text-xs text-[#546560]">Llévate +1 sello extra y entérate de promos.</p>
            </div>

            <div className="space-y-1 md:border-l md:border-black/10 md:pl-6">
              <p className="text-xs font-bold text-[#0F4C45]">03 · Cero Spam</p>
              <h2 className="text-base font-bold text-[#14201E]">Guarda a Olivia en contactos</h2>
              <p className="text-xs text-[#546560]">Recibe tu regalo de cumpleaños directo.</p>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER CON MARCA DESARROLLADORA (4 clics en logo MarIA abre Consola Root) */}
      <MarIaDeveloperFooter
        onOpenPrivacy={() => openModal('privacy')}
        onTriggerRoot={clientOnly ? undefined : () => setRootModalOpen(true)}
      />

      {/* MODALES INTERACTIVOS */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-6 sm:p-7 shadow-2xl max-h-[92dvh] overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="w-9 h-9 rounded-full bg-[#0F4C45] flex items-center justify-center">
                    <Coffee className="w-4 h-4 text-[#F2B632]" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#546560]">
                      {negocio.nombre}
                    </p>
                    <h3 className="text-base font-bold text-[#14201E]">
                      {activeModal === 'cliente-register' &&
                        (registerStage === 'form' ? 'Registro rápido de cliente' : 'Completa tu activación')}
                      {activeModal === 'cliente-login' && 'Ingresar a mi cartilla'}
                      {activeModal === 'negocio-hub' && 'Acceso Equipo · Olivia Café'}
                      {activeModal === 'negocio-admin' && 'Ingreso Dueño / Admin'}
                      {activeModal === 'privacy' && 'Política de Privacidad · Ley N° 29733'}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="w-9 h-9 rounded-full bg-[#F3F6F4] flex items-center justify-center text-[#4A5A56] hover:text-[#14201E]"
                  aria-label="Cerrar ventana"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. MODAL REGISTRO CLIENTE */}
              {activeModal === 'cliente-register' &&
                (registerStage === 'form' ? (
                  <form onSubmit={handleRegisterSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="m-reg-nombre" className="block text-xs font-semibold text-[#14201E] mb-1.5">
                        Nombre completo
                      </label>
                      <input
                        id="m-reg-nombre"
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        placeholder="Ej. María Quispe"
                        className="w-full rounded-xl bg-[#F3F6F4] px-4 py-3 text-sm text-[#14201E] placeholder:text-[#7B8B86] focus:outline-none focus:ring-2 focus:ring-[#0F4C45] min-h-[44px]"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="m-reg-phone" className="block text-xs font-semibold text-[#14201E] mb-1.5">
                        Número de WhatsApp (Perú)
                      </label>
                      <div className="flex items-center rounded-xl bg-[#F3F6F4] px-3 focus-within:ring-2 focus-within:ring-[#0F4C45]">
                        <span className="text-sm font-bold text-[#14201E] pr-2.5 border-r border-black/10 whitespace-nowrap">
                          🇵🇪 +51
                        </span>
                        <input
                          id="m-reg-phone"
                          type="tel"
                          inputMode="numeric"
                          value={regDigits}
                          onChange={(e) => setTelefono(e.target.value)}
                          placeholder="987 654 321"
                          className="w-full bg-transparent px-3 py-3 text-sm tabular-nums text-[#14201E] placeholder:text-[#7B8B86] focus:outline-none min-h-[44px]"
                          required
                        />
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#4A5A56] leading-relaxed">
                        Tu número es tu llave: te avisamos cuando estés a 1 sello del premio y te enviamos tu regalo de cumpleaños.
                      </p>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-[#14201E] mb-1.5 flex items-center gap-1.5">
                        <Cake className="w-3.5 h-3.5 text-[#0F4C45]" /> Fecha de cumpleaños
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          aria-label="Día de nacimiento"
                          value={diaNac}
                          onChange={(e) => setDiaNac(Number(e.target.value))}
                          className="w-full rounded-xl bg-[#F3F6F4] px-3 py-3 text-sm tabular-nums text-[#14201E] focus:outline-none focus:ring-2 focus:ring-[#0F4C45] min-h-[44px]"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>Día {d}</option>
                          ))}
                        </select>
                        <select
                          aria-label="Mes de nacimiento"
                          value={mesNac}
                          onChange={(e) => setMesNac(Number(e.target.value))}
                          className="w-full rounded-xl bg-[#F3F6F4] px-3 py-3 text-sm text-[#14201E] focus:outline-none focus:ring-2 focus:ring-[#0F4C45] min-h-[44px]"
                        >
                          {MESES_PERU.map((m, idx) => (
                            <option key={m} value={idx + 1}>{m}</option>
                          ))}
                        </select>
                        <input
                          aria-label="Año de nacimiento opcional"
                          type="number"
                          min={1925}
                          max={2015}
                          value={anioNac}
                          onChange={(e) => setAnioNac(e.target.value)}
                          placeholder="Año (opc.)"
                          className="w-full rounded-xl bg-[#F3F6F4] px-3 py-3 text-sm tabular-nums text-[#14201E] placeholder:text-[#7B8B86] focus:outline-none focus:ring-2 focus:ring-[#0F4C45] min-h-[44px]"
                        />
                      </div>
                    </div>

                    <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#F3F6F4] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consentimiento}
                        onChange={(e) => setConsentimiento(e.target.checked)}
                        className="mt-0.5 w-5 h-5 rounded accent-[#0F4C45] shrink-0"
                      />
                      <span className="text-xs text-[#354440] leading-relaxed">
                        Acepto recibir avisos y promociones por WhatsApp y notificaciones.{' '}
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.preventDefault();
                            setActiveModal('privacy');
                          }}
                          className="font-bold text-[#0F4C45] underline"
                        >
                          Ver Política de Privacidad
                        </button>
                      </span>
                    </label>

                    {errorMsg && (
                      <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3.5 py-2.5 text-xs font-medium">
                        {errorMsg}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full rounded-xl bg-[#0F4C45] py-3.5 px-4 text-sm font-bold text-white flex items-center justify-center gap-2 min-h-[48px]"
                    >
                      <span>{busy ? 'Creando cartilla...' : 'Obtener mi cartilla digital'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <p className="text-center text-xs text-[#546560]">
                      ¿Ya tienes cartilla?{' '}
                      <button
                        type="button"
                        onClick={() => openModal('cliente-login')}
                        className="font-bold text-[#0F4C45] underline"
                      >
                        Ingresa aquí
                      </button>
                    </p>
                  </form>
                ) : (
                  /* PASO 2: REQUISITOS DE INSTALACIÓN, NOTIFICACIONES Y CONTACTO EN LIBRETA */
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-[#E8F1EE] p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-[#0F4C45]">
                          ¡Listo, {nombre.split(' ')[0]}! Ya tienes 1 sello de bienvenida 🎁
                        </p>
                        <p className="text-xs text-[#354440] mt-0.5">
                          Completa estos pasos para instalar tu app, recibir alertas (+1 sello) y evitar spam en WhatsApp.
                        </p>
                      </div>
                      <span className="text-xs font-bold tabular-nums px-2.5 py-1 rounded-lg bg-white text-[#0F4C45] shrink-0">
                        {stepsCompletedCount}/3
                      </span>
                    </div>

                    {/* Paso 1: Instalar PWA */}
                    <div className="rounded-2xl border border-black/10 p-4 space-y-2.5">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${pwaConfirmed ? 'bg-[#0F4C45] text-white' : 'bg-[#F3F6F4] text-[#0F4C45]'}`}>
                          {pwaConfirmed ? <Check className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#14201E]">1. Instala la PWA en tu inicio</p>
                          <p className="text-xs text-[#546560]">Accede directo a tu QR sin buscar enlaces.</p>
                        </div>
                      </div>
                      {!pwaConfirmed && (
                        <div className="flex flex-wrap gap-2 pl-12">
                          <button
                            type="button"
                            onClick={handleInstallStep}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F4C45] px-3.5 py-2 text-xs font-bold text-white min-h-[40px]"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{isIOS ? 'Cómo instalar en iPhone' : 'Instalar App'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPwaConfirmed(true)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#F3F6F4] px-3 py-2 text-xs font-semibold text-[#354440] min-h-[40px]"
                          >
                            Ya la instalé
                          </button>
                        </div>
                      )}
                      {showIosGuide && !pwaConfirmed && (
                        <p className="ml-12 rounded-xl bg-[#FEF6E0] p-3 text-[11px] text-[#6B4E08]">
                          En Safari (iPhone): toca <strong>Compartir</strong> y elige <strong>“Agregar a pantalla de inicio”</strong>. En Chrome: menú ⋮ → <strong>Instalar aplicación</strong>.
                        </p>
                      )}
                    </div>

                    {/* Paso 2: Notificaciones Web Push */}
                    <div className="rounded-2xl border border-black/10 p-4 space-y-2.5">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${pushConfirmed ? 'bg-[#0F4C45] text-white' : 'bg-[#FEF6E0] text-[#7A5600]'}`}>
                          {pushConfirmed ? <Check className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#14201E]">2. Acepta notificaciones (+1 sello extra)</p>
                          <p className="text-xs text-[#546560]">Avisos cuando te falte 1 sello y promos exclusivas.</p>
                        </div>
                      </div>
                      {!pushConfirmed && (
                        <div className="pl-12">
                          <button
                            type="button"
                            onClick={handlePushStep}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#F2B632] px-4 py-2 text-xs font-bold text-[#14201E] min-h-[40px]"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            <span>Activar alertas y ganar +1 sello</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Paso 3: Agregar contacto WhatsApp a libreta */}
                    <div className="rounded-2xl border border-black/10 p-4 space-y-2.5">
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${contactConfirmed ? 'bg-[#0F4C45] text-white' : 'bg-[#E8F1EE] text-[#0F4C45]'}`}>
                          {contactConfirmed ? <Check className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-[#14201E]">3. Agrega a {negocio.nombre} a tus contactos</p>
                          <p className="text-xs text-[#546560]">
                            Guarda nuestro número ({whatsappBusinessNumber}) para que los mensajes de cumpleaños y promociones no aparezcan como spam.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pl-12">
                        <button
                          type="button"
                          onClick={handleDownloadVCard}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F4C45] px-3.5 py-2 text-xs font-bold text-white min-h-[40px]"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Guardar contacto (.vcf)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyNumber}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#F3F6F4] px-3 py-2 text-xs font-semibold text-[#14201E] min-h-[40px]"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedPhone ? 'Copiado' : whatsappBusinessNumber}</span>
                        </button>
                        <a
                          href={`https://wa.me/${whatsappCleanDigits}?text=${encodeURIComponent(`Hola ${negocio.nombre}, acabo de crear mi cartilla digital.`)}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setContactConfirmed(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#F3F6F4] px-3 py-2 text-xs font-semibold text-[#0F4C45] min-h-[40px]"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Abrir WhatsApp</span>
                        </a>
                      </div>
                    </div>

                    {errorMsg && (
                      <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3.5 py-2.5 text-xs font-medium">
                        {errorMsg}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={handleFinishActivation}
                      className="w-full rounded-xl bg-[#0F4C45] py-3.5 px-4 text-sm font-bold text-white flex items-center justify-center gap-2 min-h-[48px]"
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#F2B632]" />
                      <span>Entrar a Mi Cartilla Digital</span>
                    </button>
                  </div>
                ))}

              {/* 2. MODAL INGRESO CLIENTE */}
              {activeModal === 'cliente-login' && (
                <form onSubmit={handleClientLoginSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="m-login-phone" className="block text-xs font-semibold text-[#14201E] mb-1.5">
                      Tu número de celular (Perú)
                    </label>
                    <div className="flex items-center rounded-xl bg-[#F3F6F4] px-3 focus-within:ring-2 focus-within:ring-[#0F4C45]">
                      <span className="text-sm font-bold text-[#14201E] pr-2.5 border-r border-black/10 whitespace-nowrap flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#0F4C45]" /> +51
                      </span>
                      <input
                        id="m-login-phone"
                        type="tel"
                        inputMode="numeric"
                        value={loginDigits}
                        onChange={(e) => setClientPhoneLogin(e.target.value)}
                        placeholder="987 654 321"
                        className="w-full bg-transparent px-3 py-3 text-sm tabular-nums text-[#14201E] focus:outline-none min-h-[44px]"
                        required
                      />
                    </div>
                  </div>

                  {negocio.otp_requerido_login && otpStep === 'code' && (
                    <div>
                      <label htmlFor="m-login-otp" className="block text-xs font-semibold text-[#14201E] mb-1.5">
                        Código SMS recibido
                      </label>
                      <input
                        id="m-login-otp"
                        type="text"
                        inputMode="numeric"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="6 dígitos"
                        className="w-full rounded-xl bg-[#F3F6F4] px-4 py-3 text-sm tabular-nums text-[#14201E] focus:outline-none focus:ring-2 focus:ring-[#0F4C45] min-h-[44px]"
                        required
                      />
                    </div>
                  )}

                  {errorMsg && (
                    <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3.5 py-2.5 text-xs font-medium">
                      {errorMsg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-xl bg-[#0F4C45] py-3.5 text-sm font-bold text-white min-h-[48px]"
                  >
                    {busy ? 'Validando...' : 'Ver Mi Cartilla'}
                  </button>

                  <p className="text-center text-xs text-[#546560]">
                    ¿Primera vez en {negocio.nombre}?{' '}
                    <button
                      type="button"
                      onClick={() => openModal('cliente-register')}
                      className="font-bold text-[#0F4C45] underline"
                    >
                      Regístrate aquí
                    </button>
                  </p>
                </form>
              )}

              {/* 3. MODAL OCULTO SOY NEGOCIO (activado con 3 clics en el logo) */}
              {activeModal === 'negocio-hub' && (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-[#F3F6F4] p-4 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-[#0F4C45] text-[#F2B632] flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#14201E]">Acceso de Equipo · {negocio.nombre}</p>
                      <p className="text-xs text-[#546560]">Elige el entorno operativo al que deseas entrar.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => window.location.assign('/caja')}
                      className="rounded-2xl bg-[#14201E] text-white p-4 text-left hover:opacity-95 transition flex flex-col gap-2 min-h-[88px]"
                    >
                      <Tablet className="w-5 h-5 text-[#F2B632]" />
                      <div>
                        <p className="text-sm font-bold">Caja POS</p>
                        <p className="text-[11px] text-white/75">Sellar visitas y canjear premios</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => openModal('negocio-admin')}
                      className="rounded-2xl bg-[#DCE3DE] text-[#14201E] p-4 text-left hover:bg-[#CDD7D0] transition flex flex-col gap-2 min-h-[88px]"
                    >
                      <Lock className="w-5 h-5 text-[#0F4C45]" />
                      <div>
                        <p className="text-sm font-bold">Panel Admin</p>
                        <p className="text-[11px] text-[#4A5A56]">Gestión de dueño y campañas</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal(null);
                        setRootModalOpen(true);
                      }}
                      className="rounded-2xl bg-[#0F4C45] text-white p-4 text-left hover:opacity-95 transition flex flex-col gap-2 min-h-[88px] sm:col-span-2"
                    >
                      <ShieldCheck className="w-5 h-5 text-[#F2B632]" />
                      <div>
                        <p className="text-sm font-bold">Consola Root (Desarrollador)</p>
                        <p className="text-[11px] text-white/75">Aprovisionar dueños con clave maestra (1982)</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* 4. MODAL LOGIN DUEÑO / ADMIN (SOLO CLAVE DE 8 DÍGITOS + OTP 1.ER INGRESO) */}
              {activeModal === 'negocio-admin' &&
                (!adminPendingOtp ? (
                  <form onSubmit={handleAdminSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="m-staff-clave8" className="block text-xs font-semibold text-[#14201E] mb-1.5">
                        Clave de Dueño (8 dígitos)
                      </label>
                      <div className="flex items-center rounded-xl bg-[#F3F6F4] px-3.5 focus-within:ring-2 focus-within:ring-[#0F4C45]">
                        <KeyRound className="w-4 h-4 text-[#0F4C45] mr-2 shrink-0" />
                        <input
                          id="m-staff-clave8"
                          type="password"
                          inputMode="numeric"
                          maxLength={8}
                          value={adminClave8}
                          onChange={(e) =>
                            setAdminClave8(e.target.value.replace(/\D/g, '').slice(0, 8))
                          }
                          placeholder="••••••••"
                          className="w-full bg-transparent py-3 text-center text-lg font-mono font-bold tracking-[0.35em] text-[#14201E] focus:outline-none min-h-[48px]"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-[#546560] mt-1.5">
                        Ingresa la clave numérica de 8 dígitos asignada por tu desarrollador. En el primer ingreso se solicitará activación por OTP.
                      </p>
                    </div>

                    {errorMsg && (
                      <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3.5 py-2.5 text-xs font-medium">
                        {errorMsg}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={busy || adminClave8.length !== 8}
                      className="w-full rounded-xl bg-[#14201E] py-3.5 text-sm font-bold text-white disabled:opacity-50 min-h-[48px]"
                    >
                      {busy ? 'Validando clave...' : 'Ingresar al Panel Admin'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleAdminConfirmOtp} className="space-y-4">
                    <div className="rounded-2xl bg-[#E8F1EE] p-3.5 text-xs text-[#0F4C45]">
                      <p className="font-bold">Activación por OTP (1.er ingreso)</p>
                      <p className="mt-0.5 text-[#354440]">
                        Enviamos un código OTP de 6 dígitos a{' '}
                        <strong>{adminPendingOtp.destinoEnmascarado}</strong>.
                      </p>
                    </div>

                    {adminPendingOtp.demoOtpCode && (
                      <div className="rounded-2xl bg-[#FEF6E0] border border-[#F2B632]/40 p-3.5 text-xs text-[#7A5600]">
                        <p className="font-bold">WhatsApp OTP simulado:</p>
                        <p className="mt-1">
                          Tu código de activación es{' '}
                          <strong className="font-mono text-sm tracking-widest text-[#14201E]">
                            {adminPendingOtp.demoOtpCode}
                          </strong>
                        </p>
                      </div>
                    )}

                    <div>
                      <label htmlFor="m-staff-otp" className="block text-xs font-semibold text-[#14201E] mb-1.5">
                        Código OTP (6 dígitos)
                      </label>
                      <input
                        id="m-staff-otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={adminOtpInput}
                        onChange={(e) =>
                          setAdminOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        placeholder="000000"
                        className="w-full rounded-xl bg-[#F3F6F4] px-4 py-3 text-center text-xl font-mono font-bold tracking-[0.35em] text-[#14201E] focus:outline-none focus:ring-2 focus:ring-[#0F4C45] min-h-[48px]"
                        required
                      />
                    </div>

                    {errorMsg && (
                      <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3.5 py-2.5 text-xs font-medium">
                        {errorMsg}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={busy || adminOtpInput.length !== 6}
                      className="w-full rounded-xl bg-[#0F4C45] py-3.5 text-sm font-bold text-white disabled:opacity-50 min-h-[48px]"
                    >
                      {busy ? 'Activando acceso...' : 'Confirmar OTP y Entrar'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAdminPendingOtp(null);
                        setErrorMsg(null);
                      }}
                      className="w-full text-xs font-semibold text-[#546560] hover:underline"
                    >
                      Volver a clave de 8 dígitos
                    </button>
                  </form>
                ))}

              {/* 5. MODAL PRIVACIDAD */}
              {activeModal === 'privacy' && (
                <div className="space-y-4">
                  <p className="text-xs text-[#4A5A56] leading-relaxed">{negocio.texto_privacidad}</p>
                  <p className="text-xs text-[#4A5A56] leading-relaxed">
                    Puedes darte de baja en cualquier momento respondiendo <strong>BAJA</strong> por WhatsApp o desde la pestaña Perfil de tu cartilla.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="w-full rounded-xl bg-[#0F4C45] py-3 text-xs font-bold text-white min-h-[44px]"
                  >
                    Entendido
                  </button>
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-black/5 flex items-center gap-2 text-[11px] text-[#546560]">
                <ShieldCheck className="w-4 h-4 text-[#0F4C45] shrink-0" />
                <span>Cada rol accede únicamente a su entorno aislado.</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <RootProvisioningModal
        open={rootModalOpen}
        negocioId={negocio.id}
        negocioNombre={negocio.nombre}
        supabaseReady={supabaseReady}
        onClose={() => setRootModalOpen(false)}
      />
    </div>
  );
};
