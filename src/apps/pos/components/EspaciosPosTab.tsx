import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Coffee,
  Eye,
  MessageSquareWarning,
  Phone,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { EspacioCoworking, Negocio, ReservaCoworking } from '@/src/types/database';
import { getTodayLimaDateStr } from '@/src/shared/utils/coworkingHelpers';

interface EspaciosPosTabProps {
  negocio: Negocio;
  espacios: EspacioCoworking[];
  reservas: ReservaCoworking[];
  actionBusy: boolean;
  onConfirmarYape: (reservaId: string, nota?: string) => Promise<void>;
  onObservarYape: (reservaId: string, motivo: string) => Promise<void>;
  onCheckin: (reservaId: string) => Promise<void>;
  onLiberar: (reservaId: string) => Promise<void>;
}

const ESTADO_META: Record<
  ReservaCoworking['estado'],
  { label: string; badgeClass: string }
> = {
  pendiente_pago: {
    label: 'Esperando Yape',
    badgeClass: 'bg-slate-100 text-slate-700',
  },
  yape_por_validar: {
    label: 'Yape recibido · Validar',
    badgeClass: 'bg-[#FEF6E0] text-[#7A5600] border border-[#F2B632]/40',
  },
  confirmada: {
    label: 'Mesa Separada ✓',
    badgeClass: 'bg-[#E8F1EE] text-[#0F4C45]',
  },
  checkin: {
    label: 'En mesa (Check-in)',
    badgeClass: 'bg-[#0F4C45] text-[#F2B632]',
  },
  rechazada: {
    label: 'Yape observado',
    badgeClass: 'bg-red-50 text-red-700',
  },
  cancelada: {
    label: 'Cancelada',
    badgeClass: 'bg-slate-100 text-slate-500',
  },
};

export const EspaciosPosTab: React.FC<EspaciosPosTabProps> = ({
  negocio,
  espacios,
  reservas,
  actionBusy,
  onConfirmarYape,
  onObservarYape,
  onCheckin,
  onLiberar,
}) => {
  const [filter, setFilter] = useState<'por_validar' | 'confirmadas' | 'todas'>('por_validar');
  const [previewReceipt, setPreviewReceipt] = useState<{
    src: string;
    title: string;
    codigo: string;
  } | null>(null);
  const [noteTargetId, setNoteTargetId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const todayStr = getTodayLimaDateStr(negocio.zona_horaria);
  const espacioMap = useMemo(() => new Map(espacios.map((e) => [e.id, e.nombre])), [espacios]);

  const counts = useMemo(() => {
    const porValidar = reservas.filter(
      (r) => r.estado === 'yape_por_validar' || r.estado === 'pendiente_pago'
    ).length;
    const confirmadas = reservas.filter(
      (r) => r.estado === 'confirmada' || r.estado === 'checkin'
    ).length;
    return { porValidar, confirmadas, todas: reservas.length };
  }, [reservas]);

  const visibleReservas = useMemo(() => {
    if (filter === 'por_validar') {
      return reservas.filter(
        (r) =>
          r.estado === 'yape_por_validar' ||
          r.estado === 'pendiente_pago' ||
          r.estado === 'rechazada'
      );
    }
    if (filter === 'confirmadas') {
      return reservas.filter((r) => r.estado === 'confirmada' || r.estado === 'checkin');
    }
    return reservas;
  }, [filter, reservas]);

  const handleSendNote = async (reserva: ReservaCoworking) => {
    const defaultNote = `Por favor yapea S/ ${reserva.total_pedido_pen.toFixed(2)} al ${negocio.yape_numero || '987111222'} (${negocio.yape_titular || negocio.nombre}) y adjunta tu captura aquí para separar tu mesa.`;
    await onObservarYape(reserva.id, noteText.trim() || defaultNote);
    setNoteTargetId(null);
    setNoteText('');
  };

  return (
    <div className="space-y-4">
      {/* Cabecera Caja Coworking */}
      <section className="rounded-3xl bg-white p-5 border border-black/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E8F1EE] text-[#0F4C45] flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#14201E]">
              Reservas Cowork y Validación Yape
            </h2>
            <p className="text-xs text-[#546560]">
              Yape del local: <strong className="font-mono text-[#0F4C45]">{negocio.yape_numero || '987111222'}</strong> ({negocio.yape_titular || negocio.nombre})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilter('por_validar')}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
              filter === 'por_validar'
                ? 'bg-[#0F4C45] text-white'
                : 'bg-[#F3F6F4] text-[#4A5A56]'
            }`}
          >
            Por validar ({counts.porValidar})
          </button>
          <button
            type="button"
            onClick={() => setFilter('confirmadas')}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
              filter === 'confirmadas'
                ? 'bg-[#0F4C45] text-white'
                : 'bg-[#F3F6F4] text-[#4A5A56]'
            }`}
          >
            Separadas ({counts.confirmadas})
          </button>
          <button
            type="button"
            onClick={() => setFilter('todas')}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
              filter === 'todas'
                ? 'bg-[#0F4C45] text-white'
                : 'bg-[#F3F6F4] text-[#4A5A56]'
            }`}
          >
            Todas ({counts.todas})
          </button>
        </div>
      </section>

      {visibleReservas.length === 0 ? (
        <section className="rounded-3xl bg-white p-8 border border-black/5 text-center space-y-2">
          <CalendarClock className="w-8 h-8 text-[#6A7B76] mx-auto" />
          <p className="text-sm font-bold text-[#14201E]">Sin solicitudes en esta vista</p>
          <p className="text-xs text-[#546560]">
            Cuando un cliente separe una mesa cowork con su consumo mínimo desde la app, sonará una alerta aquí.
          </p>
        </section>
      ) : (
        <div className="space-y-3.5">
          {visibleReservas.map((r) => {
            const meta = ESTADO_META[r.estado];
            const espacioNombre = r.espacio_nombre || espacioMap.get(r.espacio_id) || 'Mesa Cowork';
            const isToday = r.fecha === todayStr;

            return (
              <article
                key={r.id}
                className="rounded-3xl bg-white p-5 border border-black/5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-[#F3F6F4] text-[#0F4C45] px-2 py-0.5 rounded-lg">
                        {r.codigo_reserva}
                      </span>
                      <h3 className="text-base font-bold text-[#14201E]">
                        {r.cliente_nombre || 'Cliente del Club'}
                      </h3>
                      <span className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                      {isToday && (
                        <span className="rounded-lg bg-[#0F4C45] text-white px-2 py-0.5 text-[10px] font-bold">
                          HOY
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#4A5A56]">
                      <span className="font-semibold text-[#0F4C45]">{espacioNombre}</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        {r.fecha} · {r.hora_inicio}–{r.hora_fin}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {r.personas} pers.
                      </span>
                      {r.cliente_celular && (
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3" />
                          {r.cliente_celular}
                        </span>
                      )}
                    </div>

                    {r.motivo_reunion && (
                      <p className="text-xs text-[#546560]">
                        Motivo: <strong className="text-[#14201E]">{r.motivo_reunion}</strong>
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl bg-[#FEF6E0] px-4 py-2.5 text-right shrink-0">
                    <p className="text-[10px] font-bold uppercase text-[#7A5600]">Consumo Mínimo</p>
                    <p className="text-lg font-bold tabular-nums text-[#14201E]">
                      S/ {r.total_pedido_pen.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Detalle del pedido mínimo para ir preparando en barra */}
                <div className="rounded-2xl bg-[#F7F9F8] p-3.5 border border-black/5 space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F4C45] flex items-center gap-1.5">
                    <Coffee className="w-3.5 h-3.5" />
                    Pedido mínimo pre-ordenado:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {r.items_pedido.map((item) => (
                      <span
                        key={item.item_id}
                        className="rounded-xl bg-white border border-black/10 px-2.5 py-1 text-xs font-semibold text-[#14201E]"
                      >
                        {item.cantidad}x {item.nombre} ·{' '}
                        <span className="tabular-nums text-[#0F4C45]">
                          S/ {(item.precio * item.cantidad).toFixed(2)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Comprobante Yape adjunto */}
                {(r.yape_comprobante_base64 || r.yape_codigo_operacion) && (
                  <div className="rounded-2xl bg-[#E8F1EE]/70 p-3.5 border border-[#0F4C45]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {r.yape_comprobante_base64 && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewReceipt({
                              src: r.yape_comprobante_base64!,
                              title: `${r.cliente_nombre || 'Cliente'} · S/ ${r.total_pedido_pen.toFixed(2)}`,
                              codigo: r.codigo_reserva,
                            })
                          }
                          className="relative w-14 h-14 rounded-xl overflow-hidden border border-black/10 shrink-0 group"
                        >
                          <img
                            src={r.yape_comprobante_base64}
                            alt={`Comprobante Yape ${r.codigo_reserva}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" />
                          </span>
                        </button>
                      )}
                      <div>
                        <p className="text-xs font-bold text-[#0F4C45]">
                          Comprobante Yape adjuntado en app
                        </p>
                        {r.yape_codigo_operacion && (
                          <p className="text-xs text-[#14201E] font-mono mt-0.5">
                            N.º operación: <strong>{r.yape_codigo_operacion}</strong>
                          </p>
                        )}
                      </div>
                    </div>

                    {r.yape_comprobante_base64 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewReceipt({
                            src: r.yape_comprobante_base64!,
                            title: `${r.cliente_nombre || 'Cliente'} · S/ ${r.total_pedido_pen.toFixed(2)}`,
                            codigo: r.codigo_reserva,
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#0F4C45] border border-[#0F4C45]/20 self-start sm:self-center"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ampliar captura Yape</span>
                      </button>
                    )}
                  </div>
                )}

                {r.mensaje_pos && (
                  <div className="rounded-xl bg-[#FEF6E0] px-3.5 py-2 text-xs text-[#7A5600]">
                    <strong>Mensaje enviado al cliente:</strong> {r.mensaje_pos}
                  </div>
                )}

                {/* Nota / Instrucción de pago Yape desde POS */}
                {noteTargetId === r.id && (
                  <div className="rounded-2xl bg-[#F7F9F8] p-3.5 border border-black/10 space-y-2.5">
                    <label className="block text-xs font-bold text-[#14201E]">
                      Enviar aviso / info Yape dentro de la app del cliente:
                    </label>
                    <input
                      type="text"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder={`Ej. Yapea S/ ${r.total_pedido_pen.toFixed(2)} al ${negocio.yape_numero || '987111222'} y adjunta tu captura legible.`}
                      className="w-full rounded-xl bg-white border border-black/10 px-3 py-2.5 text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNoteTargetId(null);
                          setNoteText('');
                        }}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#546560] border border-black/10"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => void handleSendNote(r)}
                        className="rounded-xl bg-[#7A5600] px-4 py-2 text-xs font-bold text-white"
                      >
                        Enviar mensaje al cliente
                      </button>
                    </div>
                  </div>
                )}

                {/* Acciones POS */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/5">
                  <div className="flex flex-wrap items-center gap-2">
                    {(r.estado === 'yape_por_validar' ||
                      r.estado === 'pendiente_pago' ||
                      r.estado === 'rechazada') && (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => void onConfirmarYape(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white min-h-[40px] hover:opacity-95"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#F2B632]" />
                        <span>Confirmar Yape y Separar Mesa</span>
                      </button>
                    )}

                    {r.estado === 'confirmada' && (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => void onCheckin(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#F2B632] px-4 py-2.5 text-xs font-bold text-[#14201E] min-h-[40px] hover:brightness-95"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Check-in (Cliente llegó · +Sellos)</span>
                      </button>
                    )}

                    {r.estado === 'checkin' && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#E8F1EE] px-3.5 py-2 text-xs font-bold text-[#0F4C45]">
                        <Sparkles className="w-4 h-4" />
                        <span>Cliente atendido y sello(s) acreditado(s)</span>
                      </span>
                    )}

                    {(r.estado === 'pendiente_pago' ||
                      r.estado === 'yape_por_validar' ||
                      r.estado === 'rechazada') && (
                      <button
                        type="button"
                        onClick={() => {
                          setNoteTargetId(r.id);
                          setNoteText(
                            `Por favor yapea S/ ${r.total_pedido_pen.toFixed(2)} al ${negocio.yape_numero || '987111222'} (${negocio.yape_titular || negocio.nombre}) y adjunta tu captura aquí.`
                          );
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#FEF6E0] px-3.5 py-2.5 text-xs font-bold text-[#7A5600] min-h-[40px]"
                      >
                        <MessageSquareWarning className="w-4 h-4" />
                        <span>Enviar info / Observar Yape</span>
                      </button>
                    )}
                  </div>

                  {r.estado !== 'cancelada' && r.estado !== 'checkin' && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void onLiberar(r.id)}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#F3F6F4] hover:bg-red-50 hover:text-red-700 px-3 py-2 text-xs font-bold text-[#546560] min-h-[38px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Liberar mesa</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal visor de captura Yape */}
      {previewReceipt && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Comprobante Yape"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase text-[#0F4C45]">
                  Comprobante Yape · {previewReceipt.codigo}
                </p>
                <p className="text-sm font-bold text-[#14201E]">{previewReceipt.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReceipt(null)}
                className="w-8 h-8 rounded-full bg-[#F3F6F4] flex items-center justify-center"
                aria-label="Cerrar visor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-[#F7F9F8] border border-black/10 max-h-[65vh] flex items-center justify-center">
              <img
                src={previewReceipt.src}
                alt="Captura de Yape"
                className="max-h-[62vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
