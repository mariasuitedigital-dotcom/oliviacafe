import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Award,
  Check,
  Clock,
  Coffee,
  Copy,
  ExternalLink,
  Gift,
  History,
  Laptop,
  MapPin,
  MessageCircle,
  RefreshCw,
  Share2,
  Sparkles,
  Star,
  Sun,
  UserPlus,
  X,
} from 'lucide-react';
import type { Cartilla, Cliente } from '@/src/types/database';
import type { QrTokenState } from '@/src/apps/client/hooks/useClientData';
import {
  buildReferralShareUrl,
  type HappyHourEvaluation,
} from '@/src/shared/utils/loyaltyExtras';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

interface CartillaTabProps {
  cliente: Cliente;
  cartilla: Cartilla;
  qrState: QrTokenState;
  happyHourStatus: HappyHourEvaluation;
  ratedToday: number | null;
  mapsBonusClaimed: boolean;
  onRefreshQr: () => void;
  onRate: (stars: number, comment?: string) => Promise<void>;
  onClaimMapsBonus: () => Promise<void>;
  onOpenEspacios?: () => void;
  onOpenHistorial?: () => void;
}

export const CartillaTab: React.FC<CartillaTabProps> = ({
  cliente,
  cartilla,
  qrState,
  happyHourStatus,
  ratedToday,
  mapsBonusClaimed,
  onRefreshQr,
  onRate,
  onClaimMapsBonus,
  onOpenEspacios,
  onOpenHistorial,
}) => {
  const { negocio } = useTheme();
  const [highBrightness, setHighBrightness] = useState(true);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [hoverStar, setHoverStar] = useState<number>(0);
  const [detractorComment, setDetractorComment] = useState('');
  const [detractorSent, setDetractorSent] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  const referralUrl = buildReferralShareUrl(negocio.slug, cartilla.codigo_corto);
  const sellosInvitador = negocio.referidos_sellos_invitador ?? 1;
  const sellosInvitado = negocio.referidos_sellos_invitado ?? 1;
  const waShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `¡Te invito al club de ${negocio.nombre}! ☕ Regístrate con mi enlace y ganamos sellos extra en tu 1.ª visita: ${referralUrl}`
  )}`;

  const handleCopyReferral = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopiedRef(true);
      window.setTimeout(() => setCopiedRef(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const faltan = Math.max(0, cartilla.sellos_objetivo - cartilla.sellos_actuales);
  const progresoPct = Math.min(
    100,
    Math.round((cartilla.sellos_actuales / cartilla.sellos_objetivo) * 100)
  );
  const firstName = cliente.nombre.split(' ')[0];

  const qrPayload = JSON.stringify({
    v: 1,
    slug: negocio.slug,
    cid: cliente.id,
    t: qrState.token,
  });

  const handleStarClick = async (stars: number) => {
    if (stars >= 4) {
      await onRate(stars);
    } else {
      await onRate(stars);
    }
  };

  const handleDetractorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onRate(ratedToday || 2, detractorComment.trim());
    setDetractorSent(true);
  };

  return (
    <div className="space-y-5">
      {/* Saludo y nivel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#14201E]">¡Hola, {firstName}!</h1>
          <p className="text-xs text-[#4A5A56] mt-0.5">
            {negocio.subtitulo || 'Tu café de especialidad te espera'}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-xl bg-[#F2B632] px-3.5 py-2 text-xs font-bold text-[#14201E]">
          <Award className="w-4 h-4" />
          <span>Nivel {cartilla.nivel}</span>
          {cartilla.puntos_bonus > 0 && (
            <span className="tabular-nums opacity-80">· {cartilla.puntos_bonus} pts</span>
          )}
        </div>
      </div>

      {/* BANNER HORA FELIZ (DOBLE SELLO EN HORAS MUERTAS) */}
      {happyHourStatus.enabled && (
        <section
          className={`rounded-2xl px-4 py-3 flex items-center justify-between gap-3 border ${
            happyHourStatus.isActiveNow
              ? 'bg-[#FEF6E0] border-[#F2B632] text-[#14201E]'
              : 'bg-white border-black/10 text-[#354440]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Clock
              className={`w-4 h-4 shrink-0 ${
                happyHourStatus.isActiveNow ? 'text-[#0F4C45]' : 'text-[#7A5600]'
              }`}
            />
            <div>
              <p className="text-xs font-bold">
                {happyHourStatus.isActiveNow
                  ? `¡${happyHourStatus.label} ACTIVA AHORA!`
                  : happyHourStatus.label}
              </p>
              <p className="text-[11px] opacity-85">
                {happyHourStatus.isActiveNow
                  ? `Ven hoy y cada consumo suma ${happyHourStatus.multiplier}x sellos en tu cartilla.`
                  : `Horario activo: ${happyHourStatus.scheduleSummary}`}
              </p>
            </div>
          </div>
          <span
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold shrink-0 ${
              happyHourStatus.isActiveNow
                ? 'bg-[#0F4C45] text-[#F2B632]'
                : 'bg-[#F3F6F4] text-[#0F4C45]'
            }`}
          >
            {happyHourStatus.multiplier}x Sellos
          </span>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* TARJETA PRINCIPAL DE SELLOS (7 cols desktop) */}
        <section className="lg:col-span-7 rounded-3xl bg-[#0F4C45] text-white p-6 shadow-sm space-y-5">
          <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/15">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 border border-[#F2B632]/70 flex items-center justify-center shrink-0">
                <Coffee className="w-5 h-5 text-[#F2B632]" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/75">
                  Cartilla Oficial
                </p>
                <h2 className="text-lg font-bold leading-tight">Café de Especialidad</h2>
              </div>
            </div>

            <div className="rounded-xl bg-[#F7E5BA] text-[#14201E] px-3 py-1.5 text-center shrink-0">
              <p className="text-sm font-bold tabular-nums leading-none">
                {cartilla.sellos_actuales} / {cartilla.sellos_objetivo}
              </p>
              <p className="text-[10px] font-semibold mt-0.5">sellos</p>
            </div>
          </div>

          {/* Grid de 10 sellos */}
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: cartilla.sellos_objetivo }, (_, idx) => {
              const num = idx + 1;
              const filled = num <= cartilla.sellos_actuales;
              const isReward = num === cartilla.sellos_objetivo;
              const isLatest = num === cartilla.sellos_actuales;

              return (
                <div key={num} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition ${
                      filled
                        ? 'bg-[#F2B632] text-[#14201E] shadow-sm'
                        : isReward
                        ? 'bg-[#F2B632]/25 border border-dashed border-[#F2B632] text-[#F2B632]'
                        : 'bg-white/10 border border-dashed border-white/25 text-white/55'
                    }`}
                  >
                    {isReward ? (
                      <Gift className="w-5 h-5" />
                    ) : isLatest ? (
                      <Check className="w-5 h-5 stroke-[2.5]" />
                    ) : (
                      <Coffee className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-bold tabular-nums ${
                      isReward ? 'text-[#F2B632]' : filled ? 'text-white' : 'text-white/60'
                    }`}
                  >
                    {isReward ? 'GRATIS' : num}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progreso */}
          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#F2B632]">
                {faltan === 0
                  ? '¡Cartilla completa! Ya puedes canjear tu premio'
                  : faltan === 1
                  ? '¡Solo te falta 1 visita para tu premio gratis!'
                  : `¡Te faltan ${faltan} visitas para tu premio gratis!`}
              </span>
              <span className="tabular-nums text-white/80 font-semibold">{progresoPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#F2B632] transition-all duration-300"
                style={{ width: `${progresoPct}%` }}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={faltan > 0}
            onClick={() => setShowRedeemModal(true)}
            className={`w-full rounded-2xl py-3.5 px-4 text-sm font-bold flex items-center justify-center gap-2 transition min-h-[48px] ${
              faltan === 0
                ? 'bg-[#F2B632] text-[#14201E] hover:brightness-95 active:scale-[0.99]'
                : 'bg-white/15 text-white/75 cursor-not-allowed'
            }`}
          >
            <Gift className="w-4 h-4" />
            <span>
              {faltan === 0
                ? 'Canjear Recompensa Ahora'
                : `Canjear Recompensa (Faltan ${faltan} sellos)`}
            </span>
          </button>
        </section>

        {/* PASE RÁPIDO QR ROTATIVO 30s (5 cols desktop) */}
        <section
          className={`lg:col-span-5 rounded-3xl p-6 shadow-sm border border-black/8 transition ${
            highBrightness ? 'bg-white' : 'bg-[#F7F9F8]'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#14201E] tracking-tight">
                Pase Rápido de Caja
              </h2>
              <p className="text-xs text-[#44524E] font-medium">Muestra este código al barista para sellar</p>
            </div>
            <span className="text-xs font-mono font-black bg-[#E8F1EE] text-[#0F4C45] px-3 py-1.5 rounded-xl border border-[#0F4C45]/20 shadow-xs tabular-nums">
              {cartilla.codigo_corto}
            </span>
          </div>

          <div className="my-4 p-4 sm:p-5 rounded-3xl bg-[#F7F9F8] border border-black/10 flex flex-col items-center justify-center shadow-inner">
            <QRCodeSVG
              value={qrPayload}
              size={184}
              bgColor="#F7F9F8"
              fgColor="#0F4C45"
              level="M"
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[#354440] font-semibold tabular-nums">
              Código seguro: <strong className="text-sm font-mono font-black text-[#0F4C45]">{qrState.secondsLeft}s</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setHighBrightness((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#F3F6F4] hover:bg-[#E8F1EE] px-3 py-2 text-xs font-bold text-[#14201E] min-h-[38px] transition active:scale-95 cursor-pointer"
              >
                <Sun className="w-4 h-4 text-[#F2B632]" />
                <span>{highBrightness ? 'Brillo máx.' : 'Normal'}</span>
              </button>
              <button
                type="button"
                onClick={onRefreshQr}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#F3F6F4] hover:bg-[#E8F1EE] px-3 py-2 text-xs font-bold text-[#0F4C45] min-h-[38px] transition active:scale-95 cursor-pointer"
                aria-label="Actualizar código QR"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Rotar</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* ACCESOS RÁPIDOS: RESERVAR MESA COWORK + VER HISTORIAL */}
      {(onOpenEspacios || onOpenHistorial) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {onOpenEspacios && negocio.coworking_activo !== false && (
            <button
              type="button"
              onClick={onOpenEspacios}
              className="rounded-2xl bg-white p-4 border border-black/5 shadow-sm flex items-center justify-between gap-3 text-left hover:bg-[#F7F9F8] transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#E8F1EE] text-[#0F4C45] flex items-center justify-center shrink-0">
                  <Laptop className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#14201E]">Coworking · ¿Reunión hoy?</p>
                  <p className="text-[11px] text-[#546560]">
                    Separa tu mesa de trabajo con consumo mínimo desde la app
                  </p>
                </div>
              </div>
              <span className="rounded-lg bg-[#0F4C45] text-[#F2B632] px-2.5 py-1 text-[11px] font-bold shrink-0">
                Reservar →
              </span>
            </button>
          )}

          {onOpenHistorial && (
            <button
              type="button"
              onClick={onOpenHistorial}
              className="rounded-2xl bg-white p-4 border border-black/5 shadow-sm flex items-center justify-between gap-3 text-left hover:bg-[#F7F9F8] transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#FEF6E0] text-[#7A5600] flex items-center justify-center shrink-0">
                  <History className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#14201E]">Historial de Sellos y Canjes</p>
                  <p className="text-[11px] text-[#546560]">
                    Revisa tus {cartilla.sellos_historicos} sellos acumulados
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#0F4C45] shrink-0">Ver →</span>
            </button>
          )}
        </div>
      )}

      {/* REFIERE A UN AMIGO Y GANAN AMBOS (ESTILO GOLDEN TICKET / CUPÓN VIRAL) */}
      {negocio.referidos_activo !== false && (
        <section className="rounded-3xl p-5 sm:p-6 shadow-md border-2 border-[#F2B632]/50 bg-gradient-to-br from-[#FFFDF7] via-[#FFF9EE] to-[#FDF1D5] relative overflow-hidden space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#14201E] text-[#F2B632] px-3.5 py-1 text-xs font-black tracking-wide uppercase shadow-xs">
              <Gift className="w-3.5 h-3.5 text-[#F2B632]" />
              <span>Gana +{sellosInvitador} {sellosInvitador === 1 ? 'Sello Gratis' : 'Sellos Gratis'}</span>
            </div>

            {(cliente.total_referidos_exitosos || 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F2B632] text-[#14201E] px-3 py-1 text-xs font-black tabular-nums shadow-xs">
                <Sparkles className="w-3 h-3" />
                <span>
                  {cliente.total_referidos_exitosos}{' '}
                  {cliente.total_referidos_exitosos === 1 ? 'amigo invitado' : 'amigos invitados'}
                </span>
              </span>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-black text-[#14201E] tracking-tight">
              Regala sellos a tus amigos y gana café gratis
            </h2>
            <p className="text-xs sm:text-sm text-[#44524E] font-medium leading-relaxed max-w-2xl">
              Comparte tu enlace de invitación: cuando tu amigo visite Olivia Café por primera vez, él recibe{' '}
              <strong className="text-[#0F4C45]">+{sellosInvitado} extra</strong> en su cartilla y tú ganas{' '}
              <strong className="text-[#0F4C45]">+{sellosInvitador} {sellosInvitador === 1 ? 'sello de regalo' : 'sellos de regalo'}</strong> automáticamente.
            </p>
          </div>

          {/* Bloque Cupón / Voucher con código grande y botones notorios */}
          <div className="rounded-2xl bg-white/95 backdrop-blur-xs border-2 border-dashed border-[#F2B632] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="space-y-0.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#7A5600]">
                Tu código de embajador
              </span>
              <p className="font-mono text-2xl sm:text-3xl font-black tracking-wider text-[#0F4C45] tabular-nums">
                {cartilla.codigo_corto}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                onClick={() => void handleCopyReferral()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F3F6F4] hover:bg-[#E8F1EE] border border-black/10 px-4 py-3 text-xs sm:text-sm font-extrabold text-[#14201E] min-h-[46px] transition active:scale-95 shadow-xs cursor-pointer"
              >
                {copiedRef ? (
                  <>
                    <Check className="w-4 h-4 text-[#0F4C45]" />
                    <span className="text-[#0F4C45]">¡Enlace copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#0F4C45]" />
                    <span>Copiar enlace</span>
                  </>
                )}
              </button>

              <a
                href={waShareUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20BD5A] px-5 py-3 text-xs sm:text-sm font-black text-white min-h-[46px] transition active:scale-95 shadow-md shadow-[#25D366]/25 whitespace-nowrap cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-white" />
                <span>Invitar por WhatsApp</span>
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ENCUESTA DE SATISFACCIÓN + RESEÑA GOOGLE MAPS (MISIÓN CON RECOMPENSA) */}
      <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-sm border border-black/8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-black/5">
          <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#FEF6E0] border border-[#F2B632]/50 px-3 py-1 text-xs font-black text-[#7A5600]">
            <Sparkles className="w-3.5 h-3.5 text-[#F2B632]" />
            <span>Misión de Lealtad · +10 Puntos de Regalo</span>
          </div>

          {mapsBonusClaimed && (
            <span className="inline-flex items-center gap-1 rounded-xl bg-[#E8F1EE] text-[#0F4C45] px-2.5 py-1 text-xs font-black">
              <Check className="w-3.5 h-3.5" />
              <span>Bono reclamado ✓</span>
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#14201E]">
              ¿Cómo estuvo tu café hoy?
            </h2>
            <p className="text-xs sm:text-sm text-[#4A5A56] font-medium mt-0.5">
              Tu opinión nos ayuda a mantener la mejor taza. Califica con estrellas:
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = star <= (hoverStar || ratedToday || 0);
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverStar(star)}
                  onMouseLeave={() => setHoverStar(0)}
                  onClick={() => void handleStarClick(star)}
                  aria-label={`Calificar ${star} de 5 estrellas`}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition active:scale-90 hover:bg-[#FEF6E0] cursor-pointer"
                >
                  <Star
                    className={`w-7 h-7 transition ${
                      active
                        ? 'fill-[#F2B632] text-[#F2B632] drop-shadow-xs'
                        : 'text-[#D0DCD6]'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Si calificó 1 a 3 estrellas: feedback privado de atención directa */}
        {ratedToday !== null && ratedToday <= 3 && !detractorSent && (
          <form
            onSubmit={handleDetractorSubmit}
            className="p-4 rounded-2xl bg-[#FFF6F5] border border-red-200 space-y-3"
          >
            <p className="text-xs sm:text-sm font-bold text-[#8A1C14]">
              Lamentamos que tu visita no haya sido perfecta. Cuéntanos qué pasó (va directo y privado al dueño para solucionarlo):
            </p>
            <textarea
              rows={2}
              value={detractorComment}
              onChange={(e) => setDetractorComment(e.target.value)}
              placeholder="Ej. El café demoró un poco o la temperatura no era la esperada..."
              className="w-full rounded-xl bg-white p-3 text-xs sm:text-sm text-[#14201E] border border-black/10 focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
              required
            />
            <button
              type="submit"
              className="rounded-xl bg-[#0F4C45] px-5 py-2.5 text-xs sm:text-sm font-bold text-white min-h-[42px] cursor-pointer"
            >
              Enviar mensaje privado al dueño
            </button>
          </form>
        )}

        {detractorSent && (
          <p className="rounded-2xl bg-[#E8F1EE] p-3 text-xs sm:text-sm font-bold text-[#0F4C45] flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>Gracias por tu franqueza. El dueño ha recibido tu mensaje privado para corregirlo.</span>
          </p>
        )}

        {/* TARJETA MISIÓN GOOGLE MAPS DESTACADA CON DISTINTIVO Y RECOMPENSA */}
        <div className="rounded-2xl p-4 sm:p-5 border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#F0F8F5] via-[#F7FAF9] to-[#E8F1EE] border-[#0F4C45]/25 shadow-xs">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#0F4C45] text-[#F2B632] flex items-center justify-center shrink-0 shadow-sm">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm sm:text-base font-black text-[#14201E]">
                  Compartir reseña en Google Maps
                </p>
                <span className="rounded-md bg-[#F2B632] px-2 py-0.5 text-[10px] font-black text-[#14201E] uppercase">
                  +10 Puntos
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#44524E] font-medium mt-0.5 leading-snug">
                {mapsBonusClaimed
                  ? '¡Puntos ya acreditados! Gracias por recomendar a Olivia Café ante toda la comunidad.'
                  : 'Regálanos 5 estrellas en Google Maps y sumas +10 puntos de bonificación al instante en tu cartilla.'}
              </p>
            </div>
          </div>

          <a
            href={negocio.google_maps_url || 'https://maps.google.com'}
            target="_blank"
            rel="noreferrer"
            onClick={() => void onClaimMapsBonus()}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs sm:text-sm font-black transition active:scale-95 whitespace-nowrap min-h-[46px] shadow-sm ${
              mapsBonusClaimed
                ? 'bg-white border border-[#0F4C45]/30 text-[#0F4C45] hover:bg-[#E8F1EE]'
                : 'bg-[#0F4C45] text-white hover:bg-[#0B3A34] shadow-md shadow-[#0F4C45]/20 cursor-pointer'
            }`}
          >
            <span>{mapsBonusClaimed ? 'Ver mi reseña' : 'Dejar reseña y ganar +10 pts'}</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* MODAL CANJE DE PREMIO EN BARRA */}
      {showRedeemModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Canjear premio"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl space-y-4 text-center">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowRedeemModal(false)}
                className="w-8 h-8 rounded-full bg-[#F3F6F4] flex items-center justify-center"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <Gift className="w-10 h-10 text-[#F2B632] mx-auto" />
            <h3 className="text-lg font-bold text-[#14201E]">¡Premio listo para canjear!</h3>
            <p className="text-xs text-[#4A5A56] leading-relaxed">
              Muestra tu <strong>Pase Rápido QR</strong> al barista en caja para reclamar: <strong>{negocio.nombre_premio}</strong>.
            </p>
            <div className="p-3 rounded-2xl bg-[#F3F6F4] flex justify-center">
              <QRCodeSVG value={qrPayload} size={160} bgColor="#F3F6F4" fgColor="#0F4C45" />
            </div>
            <button
              type="button"
              onClick={() => setShowRedeemModal(false)}
              className="w-full rounded-xl bg-[#0F4C45] py-3 text-xs font-bold text-white min-h-[44px]"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
