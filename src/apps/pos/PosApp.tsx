import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import {
  CalendarClock,
  CloudOff,
  Delete,
  Gift,
  KeyRound,
  ListChecks,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Tablet,
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/src/shared/auth/AuthContext';
import { ThemeProvider, useTheme } from '@/src/shared/theme/ThemeProvider';
import { AppHeader } from '@/src/shared/components/AppHeader';
import { OfflineIndicator } from '@/src/shared/pwa/OfflineIndicator';
import { getSupabaseClient } from '@/src/shared/lib/supabase';
import {
  confirmarOtpPrimerIngreso,
  validarAccesoClaveConOtp,
} from '@/src/shared/auth/accessProvisioning';
import { usePosWorkspace } from '@/src/apps/pos/hooks/usePosWorkspace';
import { QrScannerModal } from '@/src/apps/pos/components/QrScannerModal';
import { SellarTab } from '@/src/apps/pos/components/SellarTab';
import { ColaTab } from '@/src/apps/pos/components/ColaTab';
import { CanjesTab } from '@/src/apps/pos/components/CanjesTab';
import { EspaciosPosTab } from '@/src/apps/pos/components/EspaciosPosTab';
import { AppSplashScreen } from '@/src/shared/components/AppSplashScreen';
import { MarIaDeveloperFooter } from '@/src/shared/components/MarIaDeveloperFooter';
import { RootProvisioningModal } from '@/src/apps/admin/components/RootProvisioningModal';
import { unlockAudioContext } from '@/src/shared/pwa/welcomeSound';

interface PairedDevice {
  id: string;
  nombre: string;
  sede_id: string;
  negocio_id: string;
  codigo: string;
}

const DEVICE_STORAGE_KEY = 'aitama_pos_paired_device';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // Cierre automático 5 minutos

type PosTab = 'sellar' | 'espacios' | 'cola' | 'canjes';

const PosWorkspace: React.FC = () => {
  const { negocio } = useTheme();
  const { posSession, setPosCashierSession, supabaseReady } = useAuth();

  const [pairedDevice, setPairedDevice] = useState<PairedDevice | null>(() => {
    try {
      const raw = localStorage.getItem(DEVICE_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PairedDevice) : null;
    } catch {
      return null;
    }
  });

  const [pairingCode, setPairingCode] = useState('OLIVIA-CAJA-01');
  const [pin, setPin] = useState('');
  const [pendingPosOtp, setPendingPosOtp] = useState<{
    perfilId: string;
    nombre: string;
    destinoEnmascarado: string;
    demoOtpCode?: string;
  } | null>(null);
  const [posOtpInput, setPosOtpInput] = useState('');
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<PosTab>('sellar');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [rootModalOpen, setRootModalOpen] = useState(false);

  const {
    isOnline,
    selectedCustomer,
    scannedCoupon,
    activePromos,
    happyHourStatus,
    espaciosCoworking,
    reservasCoworking,
    searching,
    actionBusy,
    syncing,
    feedbackMsg,
    errorMsg,
    pendingOps,
    recentActivity,
    readyRedeemList,
    searchByQueryOrQr,
    darSello,
    canjearPremio,
    canjearCupon,
    aplicarPromoDirecta,
    confirmarReservaYape,
    rechazarReservaYape,
    checkinReservaCoworking,
    liberarReservaCoworking,
    syncOfflineQueue,
    clearSelection,
  } = usePosWorkspace(posSession, supabaseReady);

  const pendingYapeOrConfirmCount = reservasCoworking.filter(
    (r) => r.estado === 'yape_por_validar' || r.estado === 'pendiente_pago' || r.estado === 'confirmada'
  ).length;

  useEffect(() => {
    const handleUnlock = () => {
      void unlockAudioContext();
    };
    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock);
    };
  }, []);

  // Auto-cierre por inactividad cuando hay un cajero activo
  useEffect(() => {
    if (!posSession) return;
    let timer = window.setTimeout(() => {
      setPosCashierSession(null);
    }, INACTIVITY_TIMEOUT_MS);

    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setPosCashierSession(null);
      }, INACTIVITY_TIMEOUT_MS);
    };

    window.addEventListener('pointerdown', resetTimer);
    window.addEventListener('keydown', resetTimer);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [posSession, setPosCashierSession]);

  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorMsg(null);
    const code = pairingCode.trim().toUpperCase();
    if (!code) {
      setAuthErrorMsg('Ingresa el código de emparejamiento generado por el dueño.');
      return;
    }

    setBusy(true);
    try {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        const { data, error } = await supabase
          .from('dispositivos')
          .select('id, nombre, sede_id, negocio_id, codigo_emparejamiento')
          .eq('codigo_emparejamiento', code)
          .eq('activo', true)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Código de terminal no encontrado o inactivo.');
        const device: PairedDevice = {
          id: data.id,
          nombre: data.nombre,
          sede_id: data.sede_id,
          negocio_id: data.negocio_id,
          codigo: data.codigo_emparejamiento,
        };
        localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(device));
        setPairedDevice(device);
      } else {
        const demoDevice: PairedDevice = {
          id: '33333333-3333-4333-8333-333333333331',
          nombre: code === 'OLIVIA-CAJA-02' ? 'Caja 02 · San Isidro' : 'Caja 01 · Barra Miraflores',
          sede_id:
            code === 'OLIVIA-CAJA-02'
              ? '22222222-2222-4222-8222-222222222222'
              : '22222222-2222-4222-8222-222222222221',
          negocio_id: negocio.id,
          codigo: code,
        };
        localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(demoDevice));
        setPairedDevice(demoDevice);
      }
    } catch (err) {
      setAuthErrorMsg(err instanceof Error ? err.message : 'No se pudo vincular el dispositivo.');
    } finally {
      setBusy(false);
    }
  };

  const handleDigit = (d: string) => {
    if (pin.length < 8) {
      setAuthErrorMsg(null);
      setPin((prev) => prev + d);
    }
  };

  const handleValidatePin = async () => {
    if (!pairedDevice) return;
    if (pin.length < 4 || pin.length > 8) {
      setAuthErrorMsg('La clave POS debe tener entre 4 y 8 dígitos.');
      return;
    }

    setBusy(true);
    setAuthErrorMsg(null);
    try {
      const res = await validarAccesoClaveConOtp({
        supabaseReady,
        negocioId: pairedDevice.negocio_id,
        rolObjetivo: 'cashier',
        clave: pin,
        sedeId: pairedDevice.sede_id,
        dispositivoId: pairedDevice.id,
      });

      if (!res.valido) {
        throw new Error(res.mensaje || 'Clave POS incorrecta o usuario inactivo.');
      }

      if (res.requiereOtp && res.perfilId) {
        setPendingPosOtp({
          perfilId: res.perfilId,
          nombre: res.nombreCompleto || 'Usuario POS',
          destinoEnmascarado: res.destinoEnmascarado || 'WhatsApp registrado',
          demoOtpCode: res.demoOtpCode,
        });
        setPosOtpInput('');
        setPin('');
        return;
      }

      setPosCashierSession({
        id: res.perfilId || 'pos-user',
        nombre_completo: res.nombreCompleto || 'Cajero',
        rol: res.rol || 'cashier',
        sede_id: res.sedeId || pairedDevice.sede_id,
        dispositivo_id: pairedDevice.id,
        dispositivo_nombre: pairedDevice.nombre,
        negocio_id: pairedDevice.negocio_id,
        autenticado_at: Date.now(),
      });
      setPin('');
    } catch (err) {
      setAuthErrorMsg(err instanceof Error ? err.message : 'Error validando clave POS.');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmPosFirstOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPosOtp || !pairedDevice) return;
    setAuthErrorMsg(null);
    setBusy(true);
    try {
      const res = await confirmarOtpPrimerIngreso({
        supabaseReady,
        perfilId: pendingPosOtp.perfilId,
        codigoOtp: posOtpInput.trim(),
      });
      if (!res.autorizado || !res.perfil) {
        throw new Error(res.mensaje || 'Código OTP incorrecto.');
      }
      setPosCashierSession({
        id: res.perfil.id,
        nombre_completo: res.perfil.nombre_completo,
        rol: res.perfil.rol,
        sede_id: res.perfil.sede_id || pairedDevice.sede_id,
        dispositivo_id: pairedDevice.id,
        dispositivo_nombre: pairedDevice.nombre,
        negocio_id: pairedDevice.negocio_id,
        autenticado_at: Date.now(),
      });
      setPendingPosOtp(null);
      setPosOtpInput('');
    } catch (err) {
      setAuthErrorMsg(err instanceof Error ? err.message : 'No se pudo activar el usuario POS.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnpairDevice = () => {
    localStorage.removeItem(DEVICE_STORAGE_KEY);
    setPairedDevice(null);
    setPosCashierSession(null);
  };

  const handleDecodedQr = (rawText: string) => {
    setScannerOpen(false);
    setActiveTab('sellar');
    void searchByQueryOrQr(rawText);
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--brand-tertiary)]">
      <AppHeader
        identity="Caja"
        appShortTitle="Caja POS"
        userLabel={posSession ? posSession.nombre_completo : null}
        onSignOut={posSession ? () => setPosCashierSession(null) : undefined}
        rightSlot={
          posSession ? (
            <button
              type="button"
              onClick={() => setPosCashierSession(null)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#FEF6E0] px-3 py-2 text-xs font-bold text-[#7A5600] min-h-[40px] whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Cambiar cajero</span>
            </button>
          ) : null
        }
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 pb-24">
        {!pairedDevice ? (
          <section className="max-w-lg mx-auto rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-black/5">
            <div className="w-12 h-12 rounded-2xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center mb-4">
              <Tablet className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-[var(--brand-neutral)]">
              Vincular terminal Caja POS
            </h1>
            <p className="text-xs text-[#546560] mt-1 leading-relaxed">
              Ingresa el código de emparejamiento generado desde Olivia Admin → Equipo y Dispositivos.
            </p>

            <form onSubmit={handlePairDevice} className="mt-5 space-y-4">
              <div>
                <label htmlFor="pairing-code" className="block text-xs font-semibold text-[var(--brand-neutral)] mb-1.5">
                  Código de emparejamiento
                </label>
                <input
                  id="pairing-code"
                  type="text"
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value)}
                  placeholder="Ej. OLIVIA-CAJA-01"
                  className="w-full rounded-xl bg-[#F3F6F4] px-4 py-3 text-sm font-mono uppercase text-[var(--brand-neutral)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] min-h-[48px]"
                  required
                />
              </div>

              {authErrorMsg && (
                <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3.5 py-2.5 text-xs font-medium">
                  {authErrorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[var(--brand-primary)] py-3.5 text-sm font-bold text-white min-h-[48px]"
              >
                {busy ? 'Vinculando...' : 'Vincular este dispositivo'}
              </button>
            </form>
          </section>
        ) : !posSession && pendingPosOtp ? (
          <section className="max-w-md mx-auto rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-black/5 space-y-5">
            <div className="text-center">
              <div className="w-11 h-11 rounded-2xl bg-[#FEF6E0] text-[#7A5600] flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold text-[var(--brand-neutral)]">
                Activación POS por OTP (1.er ingreso)
              </h1>
              <p className="text-xs text-[#546560] mt-1">
                Hola <strong>{pendingPosOtp.nombre}</strong>. Ingresa el código de 6 dígitos enviado a{' '}
                {pendingPosOtp.destinoEnmascarado} para activar tu turno.
              </p>
            </div>

            {pendingPosOtp.demoOtpCode && (
              <div className="rounded-2xl bg-[#FEF6E0] border border-[#F2B632]/40 p-3.5 text-xs text-[#7A5600]">
                <p className="font-bold">WhatsApp OTP simulado ({pendingPosOtp.destinoEnmascarado}):</p>
                <p className="mt-1">
                  Código de activación POS:{' '}
                  <strong className="font-mono text-sm tracking-widest text-[#14201E]">
                    {pendingPosOtp.demoOtpCode}
                  </strong>
                </p>
              </div>
            )}

            <form onSubmit={handleConfirmPosFirstOtp} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={posOtpInput}
                onChange={(e) => setPosOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full rounded-xl bg-[#F3F6F4] px-4 py-3 text-center text-xl font-mono font-bold tracking-[0.35em] text-[var(--brand-neutral)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] min-h-[48px]"
                required
              />

              {authErrorMsg && (
                <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3 py-2 text-xs font-medium">
                  {authErrorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || posOtpInput.length !== 6}
                className="w-full rounded-xl bg-[var(--brand-primary)] py-3.5 text-sm font-bold text-white disabled:opacity-50 min-h-[48px]"
              >
                {busy ? 'Activando usuario POS...' : 'Confirmar OTP y Abrir Turno'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPendingPosOtp(null);
                  setAuthErrorMsg(null);
                }}
                className="w-full text-xs font-semibold text-[#546560] hover:underline"
              >
                Volver al teclado de clave POS
              </button>
            </form>
          </section>
        ) : !posSession ? (
          <section className="max-w-md mx-auto rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-black/5 pwa-ui-noselect">
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-black/5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#546560]">
                  Terminal vinculada
                </p>
                <p className="text-sm font-bold text-[var(--brand-neutral)]">{pairedDevice.nombre}</p>
              </div>
              <button
                type="button"
                onClick={handleUnpairDevice}
                className="text-xs font-semibold text-[#546560] underline hover:text-[var(--brand-neutral)]"
              >
                Desvincular
              </button>
            </div>

            <div className="mt-5 text-center">
              <div className="w-11 h-11 rounded-2xl bg-[#FEF6E0] text-[#7A5600] flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-bold text-[var(--brand-neutral)]">Ingresa tu clave de usuario POS</h1>
              <p className="text-xs text-[#546560] mt-0.5">
                4 a 8 dígitos · {supabaseReady ? 'Activación OTP en 1.er ingreso' : 'Demo: 1234 (pide OTP) o 5678'}
              </p>

              <div
                className="flex items-center justify-center gap-2.5 my-5"
                aria-label={`Clave ingresada de ${pin.length} dígitos`}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
                  <span
                    key={idx}
                    className={`w-3 h-3 rounded-full transition ${
                      idx < pin.length ? 'bg-[var(--brand-primary)] scale-110' : 'bg-[#DCE3DE]'
                    }`}
                  />
                ))}
              </div>

              {authErrorMsg && (
                <p role="alert" className="mb-4 rounded-xl bg-red-50 text-red-700 px-3 py-2 text-xs font-medium">
                  {authErrorMsg}
                </p>
              )}

              <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleDigit(digit)}
                    className="h-14 rounded-2xl bg-[#F3F6F4] hover:bg-[#E4EBE7] active:scale-[0.97] text-xl font-bold text-[var(--brand-neutral)] tabular-nums transition"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPin('')}
                  className="h-14 rounded-2xl bg-[#F3F6F4] text-xs font-bold text-[#546560] hover:bg-[#E4EBE7]"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('0')}
                  className="h-14 rounded-2xl bg-[#F3F6F4] hover:bg-[#E4EBE7] active:scale-[0.97] text-xl font-bold text-[var(--brand-neutral)] tabular-nums transition"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPin((p) => p.slice(0, -1))}
                  aria-label="Borrar último dígito"
                  className="h-14 rounded-2xl bg-[#F3F6F4] hover:bg-[#E4EBE7] flex items-center justify-center text-[var(--brand-neutral)]"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              <button
                type="button"
                disabled={busy || pin.length < 4}
                onClick={handleValidatePin}
                className="mt-5 w-full max-w-xs mx-auto rounded-xl bg-[var(--brand-primary)] py-3.5 text-sm font-bold text-white disabled:opacity-45 min-h-[48px]"
              >
                {busy ? 'Validando clave...' : 'Abrir turno en Caja'}
              </button>
            </div>
          </section>
        ) : (
          <div className="space-y-5">
            {/* Barra de turno activo */}
            <section className="rounded-2xl bg-white px-4 py-3.5 shadow-sm border border-black/5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F4C45]">
                  Terminal activa · {posSession.dispositivo_nombre}
                </p>
                <p className="text-sm font-bold text-[#14201E]">
                  Turno · {posSession.nombre_completo}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {pendingOps.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('cola')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#FEF6E0] px-3 py-1.5 text-xs font-bold text-[#7A5600]"
                  >
                    <CloudOff className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{pendingOps.length} en cola offline</span>
                  </button>
                )}

                <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#E8F1EE] px-3 py-1.5 text-xs font-bold text-[#0F4C45]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Auto-bloqueo 5m</span>
                </div>
              </div>
            </section>

            {activeTab === 'sellar' && (
              <SellarTab
                supabaseReady={supabaseReady}
                isOnline={isOnline}
                searching={searching}
                actionBusy={actionBusy}
                selectedCustomer={selectedCustomer}
                scannedCoupon={scannedCoupon}
                activePromos={activePromos}
                happyHourStatus={happyHourStatus}
                feedbackMsg={feedbackMsg}
                errorMsg={errorMsg}
                onOpenScanner={() => setScannerOpen(true)}
                onSearch={searchByQueryOrQr}
                onClear={clearSelection}
                onAddStamp={darSello}
                onRedeemReward={canjearPremio}
                onRedeemCoupon={canjearCupon}
                onApplyPromo={aplicarPromoDirecta}
              />
            )}

            {activeTab === 'espacios' && (
              <EspaciosPosTab
                negocio={negocio}
                espacios={espaciosCoworking}
                reservas={reservasCoworking}
                actionBusy={actionBusy}
                onConfirmarYape={confirmarReservaYape}
                onObservarYape={rechazarReservaYape}
                onCheckin={checkinReservaCoworking}
                onLiberar={liberarReservaCoworking}
              />
            )}

            {activeTab === 'cola' && (
              <ColaTab
                isOnline={isOnline}
                syncing={syncing}
                pendingOps={pendingOps}
                recentActivity={recentActivity}
                onSyncNow={syncOfflineQueue}
              />
            )}

            {activeTab === 'canjes' && (
              <CanjesTab
                readyRedeemList={readyRedeemList}
                recentActivity={recentActivity}
                actionBusy={actionBusy}
                onOpenScanner={() => setScannerOpen(true)}
                onRedeemReward={canjearPremio}
              />
            )}
          </div>
        )}
      </main>

      {posSession && (
        <nav
          aria-label="Navegación de caja POS"
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-black/10 pwa-safe-bottom pwa-ui-noselect"
        >
          <div className="max-w-lg mx-auto grid grid-cols-4 h-16">
            {[
              { id: 'sellar' as const, label: 'Sellar', icon: QrCode, badge: 0 },
              {
                id: 'espacios' as const,
                label: 'Cowork',
                icon: CalendarClock,
                badge: pendingYapeOrConfirmCount,
              },
              {
                id: 'cola' as const,
                label: 'Cola',
                icon: ListChecks,
                badge: pendingOps.length,
              },
              {
                id: 'canjes' as const,
                label: 'Canjes',
                icon: Gift,
                badge: readyRedeemList.length,
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
                    active ? 'text-[var(--brand-primary)]' : 'text-[#6A7B76]'
                  }`}
                >
                  <span className="relative">
                    <Icon className="w-5 h-5" />
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#F2B632] text-[#14201E] text-[9px] font-bold flex items-center justify-center tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </span>
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDecoded={handleDecodedQr}
      />

      <div className={posSession ? 'pb-16' : ''}>
        <MarIaDeveloperFooter onTriggerRoot={() => setRootModalOpen(true)} />
      </div>

      <RootProvisioningModal
        open={rootModalOpen}
        negocioId={negocio.id}
        negocioNombre={negocio.nombre}
        supabaseReady={supabaseReady}
        onClose={() => setRootModalOpen(false)}
      />

      <OfflineIndicator message="Caja sin conexión — los sellos se guardarán en IndexedDB al reconectar." />
    </div>
  );
};

export interface PosAppProps {
  withAuthProvider?: boolean;
}

export default function PosApp({ withAuthProvider = true }: PosAppProps) {
  const router = (
    <ThemeProvider negocioSlug="olivia">
      {withAuthProvider && <AppSplashScreen appRole="pos" />}
      <BrowserRouter>
        <Routes>
          <Route path="/caja/*" element={<PosWorkspace />} />
          <Route path="*" element={<Navigate to="/caja" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );

  if (!withAuthProvider) {
    return router;
  }

  return <AuthProvider>{router}</AuthProvider>;
}
