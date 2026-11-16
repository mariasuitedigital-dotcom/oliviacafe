import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  Coffee,
  Gift,
  MessageSquare,
  Phone,
  PlusCircle,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Tag,
  WifiOff,
  X,
} from 'lucide-react';
import type { PosCustomerView, PosScannedCoupon } from '@/src/apps/pos/hooks/usePosWorkspace';
import type { Promocion } from '@/src/types/database';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

interface SellarTabProps {
  supabaseReady: boolean;
  isOnline: boolean;
  searching: boolean;
  actionBusy: boolean;
  selectedCustomer: PosCustomerView | null;
  scannedCoupon: PosScannedCoupon | null;
  activePromos: Promocion[];
  feedbackMsg: { title: string; subtitle: string; offlineQueued?: boolean } | null;
  errorMsg: string | null;
  onOpenScanner: () => void;
  onSearch: (query: string) => Promise<void>;
  onClear: () => void;
  onAddStamp: (detalle: string) => Promise<void>;
  onRedeemReward: (customer: PosCustomerView, verificadoOtp: boolean) => Promise<void>;
  onRedeemCoupon: (coupon: PosScannedCoupon) => Promise<void>;
  onApplyPromo: (promo: Promocion) => Promise<void>;
}

const DETALLE_OPCIONES = ['Café / Bebida', 'Combo Mañana', 'Pastelería Artesanal', 'Para Llevar'];

export const SellarTab: React.FC<SellarTabProps> = ({
  supabaseReady,
  isOnline,
  searching,
  actionBusy,
  selectedCustomer,
  scannedCoupon,
  activePromos,
  feedbackMsg,
  errorMsg,
  onOpenScanner,
  onSearch,
  onClear,
  onAddStamp,
  onRedeemReward,
  onRedeemCoupon,
  onApplyPromo,
}) => {
  const { negocio } = useTheme();
  const [queryInput, setQueryInput] = useState('');
  const [detalle, setDetalle] = useState(DETALLE_OPCIONES[0]);
  const [otpModalCustomer, setOtpModalCustomer] = useState<PosCustomerView | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleInputChange = (raw: string) => {
    setQueryInput(raw);
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 9 && digits.startsWith('9') && !raw.toUpperCase().startsWith('CUP-')) {
      void onSearch(digits);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryInput.trim()) return;
    void onSearch(queryInput.trim());
  };

  const handleClearAll = () => {
    setQueryInput('');
    onClear();
  };

  const handleRedeemClick = (customer: PosCustomerView) => {
    if (negocio.otp_requerido_canje) {
      setOtpCode('');
      setOtpError(null);
      setOtpModalCustomer(customer);
    } else {
      void onRedeemReward(customer, false);
    }
  };

  const handleConfirmOtpRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpModalCustomer) return;
    if (otpCode.trim().length < 4) {
      setOtpError('Ingresa el código de confirmación de 4 a 6 dígitos del cliente.');
      return;
    }
    const target = otpModalCustomer;
    setOtpModalCustomer(null);
    await onRedeemReward(target, true);
  };

  const initials = selectedCustomer
    ? selectedCustomer.nombre
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || '')
        .join('')
    : '';

  const canRedeemSelected = selectedCustomer
    ? selectedCustomer.cartilla.sellos_actuales >= selectedCustomer.cartilla.sellos_objetivo
    : false;

  return (
    <div className="space-y-5">
      {/* BUSCADOR DE CLIENTE / CUPÓN + ESCÁNER QR */}
      <section className="rounded-3xl bg-white p-5 shadow-sm border border-black/5 space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-[#14201E] flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-[#0F4C45]" />
            <span>Buscar Cliente, Cupón o QR</span>
          </span>
          <span className="text-[11px] font-semibold text-[#546560]">Acción en &lt; 5s</span>
        </div>

        <form onSubmit={handleManualSubmit} className="flex items-stretch gap-2.5">
          <div className="flex-1 flex items-center rounded-2xl bg-[#F3F6F4] px-3.5 focus-within:ring-2 focus-within:ring-[#0F4C45]">
            <Smartphone className="w-4 h-4 text-[#546560] shrink-0 mr-2.5" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Celular 9 dígitos (987654321), #OL-8942 o CUP-..."
              className="w-full bg-transparent py-3.5 text-base font-bold text-[#14201E] placeholder:text-xs placeholder:font-normal placeholder:text-[#7B8B86] focus:outline-none tabular-nums min-h-[52px]"
            />
          </div>

          <button
            type="button"
            onClick={onOpenScanner}
            aria-label="Abrir cámara para escanear QR"
            className="w-14 sm:w-auto sm:px-5 rounded-2xl bg-[#0F4C45] text-white flex items-center justify-center gap-2 font-bold text-xs hover:opacity-95 active:scale-[0.98] transition shrink-0 min-h-[52px]"
          >
            <QrCode className="w-5 h-5 text-[#F2B632]" />
            <span className="hidden sm:inline">Escanear QR</span>
          </button>
        </form>

        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-[#546560] font-medium">
            Búsqueda automática al ingresar 9 dígitos
          </span>
          <button
            type="button"
            onClick={handleClearAll}
            className="font-bold text-[#7A5600] underline hover:opacity-80"
          >
            Limpiar
          </button>
        </div>

        {/* Accesos rápidos de prueba en modo local sin backend */}
        {!supabaseReady && (
          <div className="pt-2 border-t border-black/5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#6A7B76] mr-1">Prueba rápida:</span>
            {[
              { label: 'María (6/10)', q: '987654321' },
              { label: 'Lucía (10/10)', q: '984112304' },
              { label: 'Rodrigo (9/10)', q: '972554819' },
              { label: 'Cupón CUP-DEMO10', q: 'CUP-DEMO10' },
            ].map((chip) => (
              <button
                key={chip.q}
                type="button"
                onClick={() => {
                  setQueryInput(chip.q);
                  void onSearch(chip.q);
                }}
                className="rounded-lg bg-[#F3F6F4] hover:bg-[#E8F1EE] px-2.5 py-1 text-[11px] font-semibold text-[#14201E] transition"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
      </section>

      {errorMsg && (
        <p role="alert" className="rounded-2xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-xs font-semibold">
          {errorMsg}
        </p>
      )}

      {searching && (
        <div className="rounded-3xl bg-white p-6 border border-black/5 animate-pulse space-y-3">
          <div className="h-6 bg-[#DCE3DE] rounded-lg w-1/3" />
          <div className="h-32 bg-[#0F4C45]/15 rounded-2xl" />
        </div>
      )}

      {/* TARJETA DE CLIENTE EN CAJA (VERDE PROFUNDO) */}
      {!searching && selectedCustomer && (
        <section className="rounded-3xl bg-[#0F4C45] text-white p-5 sm:p-6 shadow-sm space-y-5">
          {/* Encabezado cliente + celular enmascarado */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-base font-bold shrink-0">
                {initials || 'CL'}
              </div>
              <div>
                <h2 className="text-xl font-bold leading-tight">{selectedCustomer.nombre}</h2>
                <p className="text-xs text-white/80 tabular-nums mt-0.5 flex items-center gap-1.5">
                  <span>+51 {selectedCustomer.celular_enmascarado}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{selectedCustomer.cartilla.codigo_corto}</span>
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#F2B632] text-[#14201E] px-3 py-1.5 text-xs font-bold">
              <Award className="w-3.5 h-3.5" />
              <span>Nivel {selectedCustomer.cartilla.nivel}</span>
            </div>
          </div>

          {/* Grid de 10 sellos */}
          <div className="rounded-2xl bg-black/15 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">Cartilla de Sellos</p>
                <p className="text-[11px] text-white/75">1 visita = 1 sello</p>
              </div>
              <p className="text-lg font-bold tabular-nums text-[#F2B632]">
                {selectedCustomer.cartilla.sellos_actuales} de{' '}
                {selectedCustomer.cartilla.sellos_objetivo} Sellos
              </p>
            </div>

            <div className="grid grid-cols-5 gap-2.5 sm:gap-3">
              {Array.from(
                { length: selectedCustomer.cartilla.sellos_objetivo },
                (_, idx) => {
                  const num = idx + 1;
                  const filled = num <= selectedCustomer.cartilla.sellos_actuales;
                  const isReward = num === selectedCustomer.cartilla.sellos_objetivo;
                  return (
                    <div
                      key={num}
                      className={`h-12 sm:h-14 rounded-full flex items-center justify-center transition ${
                        filled
                          ? 'bg-[#F2B632] text-[#14201E] font-bold shadow-sm'
                          : isReward
                          ? 'bg-white/10 border border-dashed border-[#F2B632]/70 text-[#F2B632]'
                          : 'bg-white/10 text-white/45 font-semibold text-xs'
                      }`}
                    >
                      {isReward ? (
                        <Star className="w-5 h-5" />
                      ) : filled ? (
                        <Coffee className="w-5 h-5" />
                      ) : (
                        <span className="tabular-nums">{num}</span>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Selector rápido de consumo */}
          <div className="flex flex-wrap items-center gap-2">
            {DETALLE_OPCIONES.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setDetalle(opt)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  detalle === opt
                    ? 'bg-white text-[#14201E]'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Botones táctiles grandes (tablet & móvil) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void onAddStamp(detalle)}
              className="w-full rounded-2xl bg-[#F2B632] text-[#14201E] px-5 py-4 text-base font-bold flex items-center justify-center gap-2 shadow-md hover:brightness-95 active:scale-[0.98] transition min-h-[60px] disabled:opacity-50"
            >
              <PlusCircle className="w-5 h-5" />
              <span>{actionBusy ? 'Registrando...' : '+1 Punto / Sello Hoy'}</span>
            </button>

            <button
              type="button"
              disabled={actionBusy || !canRedeemSelected}
              onClick={() => handleRedeemClick(selectedCustomer)}
              className={`w-full rounded-2xl px-5 py-4 text-sm font-bold flex items-center justify-center gap-2 transition min-h-[60px] ${
                canRedeemSelected
                  ? 'bg-white text-[#0F4C45] hover:bg-[#FEF6E0] active:scale-[0.98]'
                  : 'bg-white/15 text-white/60 cursor-not-allowed'
              }`}
            >
              <Gift className="w-5 h-5" />
              <span>
                {canRedeemSelected
                  ? 'Canjear Premio Gratis'
                  : `Canjear (${selectedCustomer.cartilla.sellos_objetivo} Sellos)`}
              </span>
            </button>
          </div>

          {/* Promociones activas aplicables directo desde Caja POS */}
          {activePromos.length > 0 && (
            <div className="pt-4 border-t border-white/15 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#F2B632] flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Registrar / Aplicar Promoción en Caja</span>
                </p>
                <span className="text-[11px] text-white/75">Sin cupón previo</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activePromos.map((promo) => (
                  <div
                    key={promo.id}
                    className="rounded-2xl bg-white/10 border border-white/15 p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{promo.titulo}</p>
                      <p className="text-[11px] text-white/80 tabular-nums mt-0.5">
                        S/ {promo.precio_especial.toFixed(2)}
                        {promo.sellos_extra > 0 ? ` · +${promo.sellos_extra} sellos` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void onApplyPromo(promo)}
                      className="rounded-xl bg-white text-[#0F4C45] hover:bg-[#FEF6E0] px-3 py-2 text-xs font-bold whitespace-nowrap shrink-0 min-h-[38px] disabled:opacity-50"
                    >
                      Aplicar Promo
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* CUPÓN PROMOCIONAL ESCANEADO */}
      {!searching && scannedCoupon && (
        <section className="rounded-3xl bg-white p-6 border-2 border-[#0F4C45] shadow-sm space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#FEF6E0] text-[#7A5600] flex items-center justify-center shrink-0">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F4C45]">
                  Cupón Promocional · {scannedCoupon.cupon.codigo_qr}
                </span>
                <h2 className="text-lg font-bold text-[#14201E]">
                  {scannedCoupon.promocion.titulo}
                </h2>
                <p className="text-xs text-[#546560]">
                  Cliente: {scannedCoupon.cliente_nombre} ({scannedCoupon.celular_enmascarado})
                </p>
              </div>
            </div>

            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                scannedCoupon.cupon.estado === 'activo'
                  ? 'bg-[#E8F1EE] text-[#0F4C45]'
                  : 'bg-[#F3F6F4] text-[#6A7B76]'
              }`}
            >
              {scannedCoupon.cupon.estado === 'activo' ? 'Válido' : 'Ya canjeado'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#F3F6F4] p-4">
            <div>
              <p className="text-[11px] text-[#546560] font-semibold">Precio Especial en Caja</p>
              <p className="text-xl font-bold tabular-nums text-[#0F4C45]">
                S/ {scannedCoupon.promocion.precio_especial.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-[#546560] font-semibold">Bonificación</p>
              <p className="text-xl font-bold tabular-nums text-[#14201E] flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-[#F2B632]" />+
                {scannedCoupon.promocion.sellos_extra} sellos
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={actionBusy || scannedCoupon.cupon.estado !== 'activo'}
            onClick={() => void onRedeemCoupon(scannedCoupon)}
            className="w-full rounded-2xl bg-[#0F4C45] text-white py-4 px-5 text-sm font-bold min-h-[54px] disabled:opacity-45"
          >
            {scannedCoupon.cupon.estado === 'activo'
              ? 'Aplicar Cupón y Acreditar Sellos'
              : 'Cupón ya utilizado'}
          </button>
        </section>
      )}

      {/* ESTADO VACÍO CUANDO NO HAY CLIENTE SELECCIONADO */}
      {!searching && !selectedCustomer && !scannedCoupon && (
        <section className="rounded-3xl bg-white p-8 text-center border border-black/5 space-y-2">
          <QrCode className="w-10 h-10 text-[#0F4C45] mx-auto" />
          <h2 className="text-base font-bold text-[#14201E]">Terminal lista para atender</h2>
          <p className="text-xs text-[#546560] max-w-md mx-auto leading-relaxed">
            Escanea el QR del cliente o ingresa sus 9 dígitos de celular para sumar un sello, aplicar un cupón o entregar un premio en menos de 5 segundos.
          </p>
        </section>
      )}

      {/* ÚLTIMO REGISTRO CONFIRMADO */}
      {feedbackMsg && (
        <section className="rounded-3xl bg-white p-4 sm:p-5 border border-black/5 shadow-sm space-y-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                feedbackMsg.offlineQueued
                  ? 'bg-[#FEF6E0] text-[#7A5600]'
                  : 'bg-[#E8F1EE] text-[#0F4C45]'
              }`}
            >
              {feedbackMsg.offlineQueued ? (
                <WifiOff className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#546560]">
                Último registro
              </p>
              <p className="text-sm font-bold text-[#14201E]">{feedbackMsg.title}</p>
              <p className="text-xs text-[#4A5A56] mt-0.5">{feedbackMsg.subtitle}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#FEF6E0] px-3.5 py-2.5 text-xs font-semibold text-[#6B4E08] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span>
              {isOnline && !feedbackMsg.offlineQueued
                ? 'Aviso automático programado en segundo plano (Push / WhatsApp).'
                : 'Guardado localmente en IndexedDB. Se sincronizará automáticamente al volver internet.'}
            </span>
          </div>
        </section>
      )}

      {/* MODAL VERIFICACIÓN OTP AL CANJEAR PREMIO (SI ESTÁ ACTIVO EN EL NEGOCIO) */}
      {otpModalCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Verificación de canje de premio"
        >
          <form
            onSubmit={handleConfirmOtpRedeem}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0F4C45]" />
                <h3 className="text-base font-bold text-[#14201E]">Verificar canje</h3>
              </div>
              <button
                type="button"
                onClick={() => setOtpModalCustomer(null)}
                className="w-8 h-8 rounded-full bg-[#F3F6F4] flex items-center justify-center"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#4A5A56] leading-relaxed">
              Pide a <strong>{otpModalCustomer.nombre}</strong> el código de seguridad de canje para entregar:{' '}
              <strong>{negocio.nombre_premio}</strong>.
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Código 4 a 6 dígitos"
              className="w-full rounded-xl bg-[#F3F6F4] px-4 py-3 text-center text-lg font-bold tracking-widest tabular-nums text-[#14201E] focus:outline-none focus:ring-2 focus:ring-[#0F4C45] min-h-[48px]"
              autoFocus
            />

            {otpError && (
              <p role="alert" className="text-xs font-semibold text-red-700">
                {otpError}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-[#0F4C45] py-3.5 text-sm font-bold text-white min-h-[48px]"
            >
              Confirmar Canje y Reiniciar Cartilla
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
