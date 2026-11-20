import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  Copy,
  ImagePlus,
  Laptop,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Wifi,
} from 'lucide-react';
import type {
  CartaItem,
  EspacioCoworking,
  Negocio,
  ReservaCoworking,
  ReservaPedidoItem,
  Sede,
} from '@/src/types/database';
import {
  buildSpaceTimeSlots,
  compressReceiptImage,
  formatMinutesRemainingToMeeting,
  getTodayLimaDateStr,
} from '@/src/shared/utils/coworkingHelpers';

interface EspaciosClientTabProps {
  negocio: Negocio;
  sedes: Sede[];
  espacios: EspacioCoworking[];
  cartaItems: CartaItem[];
  reservasCliente: ReservaCoworking[];
  reservasOcupacion: ReservaCoworking[];
  onCrearReserva: (input: {
    sede_id: string;
    espacio: EspacioCoworking;
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    personas: number;
    motivo_reunion: string;
    items_pedido: ReservaPedidoItem[];
    total_pedido_pen: number;
  }) => Promise<{ reserva?: ReservaCoworking; error?: string }>;
  onAdjuntarYape: (
    reservaId: string,
    comprobanteBase64: string,
    codigoOperacion?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onCancelarReserva: (reservaId: string) => Promise<void>;
}

const ESTADO_CLIENTE_META: Record<
  ReservaCoworking['estado'],
  { label: string; badgeClass: string; helper: string }
> = {
  pendiente_pago: {
    label: 'Falta adjuntar Yape',
    badgeClass: 'bg-[#FEF6E0] text-[#7A5600]',
    helper: 'Yapea el consumo mínimo y sube tu captura aquí abajo para que Caja confirme tu mesa.',
  },
  yape_por_validar: {
    label: 'Validando Yape en Caja',
    badgeClass: 'bg-[#E8F1EE] text-[#0F4C45]',
    helper: 'Caja POS recibió tu captura y la está validando en este momento.',
  },
  confirmada: {
    label: 'Mesa Confirmada ✅',
    badgeClass: 'bg-[#0F4C45] text-[#F2B632]',
    helper: '¡Todo listo! Tu mesa y tu café estarán esperándote. ¡Muchos éxitos en tu reunión!',
  },
  checkin: {
    label: 'Check-in Realizado ☕',
    badgeClass: 'bg-[#0F4C45] text-white',
    helper: '¡Disfruta tu reunión y tus sellos sumados en Olivia Café!',
  },
  rechazada: {
    label: 'Revisar pago Yape',
    badgeClass: 'bg-red-50 text-red-700',
    helper: 'Caja dejó una nota sobre tu Yape. Puedes volver a subir una captura legible aquí.',
  },
  cancelada: {
    label: 'Cancelada',
    badgeClass: 'bg-slate-100 text-slate-500',
    helper: 'Esta reserva fue liberada.',
  },
};

function addDaysLima(baseDateStr: string, days: number): string {
  const [y, m, d] = baseDateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + days));
  return dt.toISOString().slice(0, 10);
}

export const EspaciosClientTab: React.FC<EspaciosClientTabProps> = ({
  negocio,
  sedes,
  espacios,
  cartaItems,
  reservasCliente,
  reservasOcupacion,
  onCrearReserva,
  onAdjuntarYape,
  onCancelarReserva,
}) => {
  const activeEspacios = useMemo(() => espacios.filter((e) => e.activo), [espacios]);
  const todayStr = getTodayLimaDateStr(negocio.zona_horaria);
  const tomorrowStr = addDaysLima(todayStr, 1);

  const [selectedSedeId, setSelectedSedeId] = useState<string>(
    () => activeEspacios[0]?.sede_id || sedes[0]?.id || ''
  );
  const spacesInSede = useMemo(
    () =>
      activeEspacios.filter((e) => !selectedSedeId || e.sede_id === selectedSedeId),
    [activeEspacios, selectedSedeId]
  );

  const [selectedEspacioId, setSelectedEspacioId] = useState<string>(
    () => spacesInSede[0]?.id || activeEspacios[0]?.id || ''
  );
  const selectedEspacio = useMemo(
    () =>
      spacesInSede.find((e) => e.id === selectedEspacioId) ||
      spacesInSede[0] ||
      activeEspacios[0] ||
      null,
    [activeEspacios, selectedEspacioId, spacesInSede]
  );

  const [fecha, setFecha] = useState<string>(todayStr);
  const [selectedSlot, setSelectedSlot] = useState<{ hora_inicio: string; hora_fin: string } | null>(
    null
  );
  const [personas, setPersonas] = useState<number>(2);
  const [motivo, setMotivo] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Yape upload state per reservation
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({});
  const [opCodeMap, setOpCodeMap] = useState<Record<string, string>>({});
  const [yapeError, setYapeError] = useState<string | null>(null);
  const [copiedYape, setCopiedYape] = useState(false);

  const timeSlots = useMemo(() => {
    if (!selectedEspacio) return [];
    return buildSpaceTimeSlots({
      espacio: selectedEspacio,
      fecha,
      reservasExistentes: reservasOcupacion,
      timezone: negocio.zona_horaria,
    });
  }, [fecha, negocio.zona_horaria, reservasOcupacion, selectedEspacio]);

  const orderSummary = useMemo(() => {
    const items: ReservaPedidoItem[] = [];
    let total = 0;
    for (const c of cartaItems) {
      const qty = quantities[c.id] || 0;
      if (qty > 0) {
        items.push({ item_id: c.id, nombre: c.nombre, cantidad: qty, precio: c.precio });
        total += c.precio * qty;
      }
    }
    const minSpend = selectedEspacio?.consumo_minimo_pen ?? negocio.coworking_consumo_minimo_pen ?? 18;
    const missing = Math.max(0, minSpend - total);
    const pct = Math.min(100, Math.round((total / Math.max(1, minSpend)) * 100));
    return { items, total, minSpend, missing, pct, meetsMin: total + 0.001 >= minSpend };
  }, [cartaItems, negocio.coworking_consumo_minimo_pen, quantities, selectedEspacio?.consumo_minimo_pen]);

  const adjustQty = (itemId: string, delta: number) => {
    setQuantities((prev) => {
      const next = Math.max(0, Math.min(10, (prev[itemId] || 0) + delta));
      return { ...prev, [itemId]: next };
    });
  };

  const handleCopyYape = async () => {
    try {
      await navigator.clipboard.writeText(negocio.yape_numero || '987111222');
      setCopiedYape(true);
      window.setTimeout(() => setCopiedYape(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleCreateReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedEspacio) {
      setFormError('No hay mesas cowork habilitadas en este momento.');
      return;
    }
    if (!selectedSlot) {
      setFormError('Selecciona un bloque horario disponible.');
      return;
    }
    if (!orderSummary.meetsMin) {
      setFormError(
        `Completa el consumo mínimo de S/ ${orderSummary.minSpend.toFixed(2)} eligiendo tu café o combo de la carta.`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await onCrearReserva({
        sede_id: selectedEspacio.sede_id,
        espacio: selectedEspacio,
        fecha,
        hora_inicio: selectedSlot.hora_inicio,
        hora_fin: selectedSlot.hora_fin,
        personas: Math.min(selectedEspacio.capacidad, Math.max(1, personas)),
        motivo_reunion: motivo.trim() || 'Reunión / Trabajo remoto',
        items_pedido: orderSummary.items,
        total_pedido_pen: Number(orderSummary.total.toFixed(2)),
      });
      if (res.error) {
        setFormError(res.error);
        return;
      }
      setSelectedSlot(null);
      setMotivo('');
      setQuantities({});
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = async (reservaId: string, file: File | null) => {
    if (!file) return;
    setYapeError(null);
    try {
      const compressed = await compressReceiptImage(file);
      setPreviewMap((prev) => ({ ...prev, [reservaId]: compressed }));
    } catch (err) {
      setYapeError(err instanceof Error ? err.message : 'No se pudo procesar la captura.');
    }
  };

  const handleSubmitYape = async (reservaId: string) => {
    const img = previewMap[reservaId];
    if (!img) {
      setYapeError('Primero adjunta la captura de pantalla de tu Yape.');
      return;
    }
    setYapeError(null);
    setUploadingId(reservaId);
    try {
      const res = await onAdjuntarYape(reservaId, img, opCodeMap[reservaId]);
      if (!res.ok && res.error) {
        setYapeError(res.error);
      }
    } finally {
      setUploadingId(null);
    }
  };

  const yapeNum = negocio.yape_numero || '987111222';
  const yapeTitular = negocio.yape_titular || `${negocio.nombre} S.A.C.`;

  const activeReservas = reservasCliente.filter((r) => r.estado !== 'cancelada');

  if (negocio.coworking_activo === false) {
    return (
      <section className="rounded-3xl bg-white p-8 border border-black/5 text-center space-y-2">
        <Laptop className="w-8 h-8 text-[#546560] mx-auto" />
        <h2 className="text-base font-bold text-[#14201E]">
          Reservas de Mesas Coworking en pausa temporal
        </h2>
        <p className="text-xs text-[#546560]">
          Pronto volveremos a habilitar nuestros espacios de reunión.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {/* Banner Coworking */}
      <section className="rounded-3xl bg-[#0F4C45] text-white p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-bold text-[#F2B632]">
            <Laptop className="w-3.5 h-3.5" />
            Reserva tu mesa de reunión 100% en la app
          </span>
          <h1 className="text-xl sm:text-2xl font-bold">
            Espacios Coworking · {negocio.nombre}
          </h1>
          <p className="text-xs text-white/80 max-w-xl">
            Separa tu mesa por horario eligiendo tu café o combo mínimo, paga por Yape aquí mismo y recibe la confirmación de Caja con recordatorio previo a tu reunión.
          </p>
        </div>

        <div className="rounded-2xl bg-white/10 border border-white/15 px-4 py-3 text-xs shrink-0">
          <p className="text-[11px] text-white/75">Mesas activas hoy:</p>
          <p className="text-base font-bold text-[#F2B632] tabular-nums">
            {activeEspacios.length} espacios disponibles
          </p>
        </div>
      </section>

      {/* MIS RESERVAS ACTIVAS + FLUJO YAPE IN-APP */}
      {activeReservas.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#14201E]">Mis Mesas Reservadas</h2>
            <span className="text-[11px] font-semibold text-[#546560]">
              Sin salir a WhatsApp · Estado en vivo
            </span>
          </div>

          {activeReservas.map((r) => {
            const meta = ESTADO_CLIENTE_META[r.estado];
            const needsYape = r.estado === 'pendiente_pago' || r.estado === 'rechazada';
            const minsLeft =
              r.estado === 'confirmada'
                ? formatMinutesRemainingToMeeting(r.fecha, r.hora_inicio, negocio.zona_horaria)
                : null;
            const previewSrc = previewMap[r.id] || r.yape_comprobante_base64 || null;

            return (
              <article
                key={r.id}
                className="rounded-3xl bg-white p-5 border border-black/5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-[#F3F6F4] text-[#0F4C45] px-2 py-0.5 rounded-lg">
                        {r.codigo_reserva}
                      </span>
                      <span className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#14201E] mt-1">
                      {r.espacio_nombre || 'Mesa Cowork'}
                    </h3>
                    <p className="text-xs text-[#4A5A56] mt-0.5 tabular-nums">
                      {r.fecha} · {r.hora_inicio}–{r.hora_fin} · {r.personas} pers. · {r.motivo_reunion}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#FEF6E0] px-4 py-2 text-right self-start shrink-0">
                    <p className="text-[10px] font-bold uppercase text-[#7A5600]">Total Pedido</p>
                    <p className="text-base font-bold tabular-nums text-[#14201E]">
                      S/ {r.total_pedido_pen.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Recordatorio motivador si la reunión es hoy */}
                {r.estado === 'confirmada' && minsLeft !== null && minsLeft >= -15 && minsLeft <= 180 && (
                  <div className="rounded-2xl bg-[#E8F1EE] border border-[#0F4C45]/20 p-3.5 flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-[#0F4C45] shrink-0" />
                    <p className="text-xs font-semibold text-[#0F4C45]">
                      {minsLeft > 0
                        ? `¡Tu reunión empieza en ${minsLeft} min! Tu mesa y café estarán listos. ¡Muchos éxitos en tu negociación!`
                        : '¡Ya es hora de tu reunión! Acércate a Caja para tu Check-in y suma sellos. ¡Muchos éxitos!'}
                    </p>
                  </div>
                )}

                {r.mensaje_pos && (
                  <div
                    className={`rounded-2xl p-3 text-xs font-medium flex items-start gap-2 ${
                      r.estado === 'rechazada'
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-[#F3F6F4] text-[#14201E]'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Mensaje de Caja:</p>
                      <p>{r.mensaje_pos}</p>
                    </div>
                  </div>
                )}

                <p className="text-xs text-[#546560]">{meta.helper}</p>

                {/* Paso Yape directo dentro de la app */}
                {needsYape && (
                  <div className="rounded-2xl bg-[#F7F9F8] p-4 border border-[#0F4C45]/15 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <span className="inline-flex rounded-lg bg-[#742384] text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Pago con Yape · En App
                        </span>
                        <p className="text-sm font-bold text-[#14201E]">
                          Yapea S/ {r.total_pedido_pen.toFixed(2)} al{' '}
                          <span className="font-mono text-[#0F4C45]">{yapeNum}</span>
                        </p>
                        <p className="text-xs text-[#546560]">Titular: {yapeTitular}</p>
                        <button
                          type="button"
                          onClick={() => void handleCopyYape()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-black/10 px-3 py-1.5 text-xs font-bold text-[#0F4C45]"
                        >
                          {copiedYape ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Número copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar número Yape</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="p-2.5 rounded-2xl bg-white border border-black/10 self-start sm:self-center text-center">
                        <QRCodeSVG
                          value={`yape:${yapeNum}?amount=${r.total_pedido_pen.toFixed(2)}&ref=${r.codigo_reserva}`}
                          size={88}
                          fgColor="#0F4C45"
                        />
                        <p className="text-[9px] font-bold text-[#546560] mt-1">Ref. {r.codigo_reserva}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-black/5">
                      <div>
                        <label className="block text-xs font-bold text-[#14201E] mb-1.5">
                          1. Adjunta captura de tu Yape
                        </label>
                        <label className="flex items-center justify-center gap-2 rounded-xl bg-white border border-dashed border-[#0F4C45]/40 px-3 py-3 text-xs font-bold text-[#0F4C45] cursor-pointer hover:bg-[#E8F1EE] min-h-[44px]">
                          <ImagePlus className="w-4 h-4" />
                          <span>{previewSrc ? 'Cambiar captura Yape' : 'Subir captura de Yape'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              void handleFileChange(r.id, e.target.files?.[0] || null)
                            }
                          />
                        </label>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#14201E] mb-1.5">
                          2. Código de operación (opcional)
                        </label>
                        <input
                          type="text"
                          value={opCodeMap[r.id] || ''}
                          onChange={(e) =>
                            setOpCodeMap((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          placeholder="Ej. 0492817"
                          className="w-full rounded-xl bg-white border border-black/10 px-3 py-2.5 text-xs font-mono min-h-[44px]"
                        />
                      </div>
                    </div>

                    {previewSrc && (
                      <div className="flex items-center gap-3 rounded-xl bg-white p-2.5 border border-black/10">
                        <img
                          src={previewSrc}
                          alt="Vista previa Yape"
                          className="w-12 h-12 rounded-lg object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#0F4C45]">Captura lista para enviar</p>
                          <p className="text-[11px] text-[#546560]">
                            Se enviará directo a la pantalla de Caja POS.
                          </p>
                        </div>
                      </div>
                    )}

                    {yapeError && (
                      <p role="alert" className="text-xs font-medium text-red-700">
                        {yapeError}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void onCancelarReserva(r.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#6A7B76] hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Cancelar solicitud</span>
                      </button>

                      <button
                        type="button"
                        disabled={uploadingId === r.id || !previewSrc}
                        onClick={() => void handleSubmitYape(r.id)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#0F4C45] px-5 py-3 text-xs font-bold text-white disabled:opacity-50 min-h-[44px]"
                      >
                        <Upload className="w-4 h-4 text-[#F2B632]" />
                        <span>
                          {uploadingId === r.id ? 'Enviando a Caja...' : 'Enviar comprobante Yape'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {r.estado === 'yape_por_validar' && (
                  <div className="flex items-center justify-between pt-2 border-t border-black/5 text-xs text-[#0F4C45] font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Caja recibió tu Yape · Te avisaremos en segundos
                    </span>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {/* FORMULARIO PARA SEPARAR NUEVA MESA */}
      <form onSubmit={handleCreateReserva} className="space-y-5">
        {/* PASO 1: SEDE, MESA Y HORARIO */}
        <section className="rounded-3xl bg-white p-5 sm:p-6 border border-black/5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F4C45]">
                Paso 1 de 2
              </p>
              <h2 className="text-base font-bold text-[#14201E]">Elige Sede, Mesa y Horario</h2>
            </div>
            {sedes.length > 1 && (
              <select
                aria-label="Seleccionar sede"
                value={selectedSedeId}
                onChange={(e) => {
                  const nextSede = e.target.value;
                  setSelectedSedeId(nextSede);
                  const firstInSede = activeEspacios.find((sp) => sp.sede_id === nextSede);
                  if (firstInSede) setSelectedEspacioId(firstInSede.id);
                  setSelectedSlot(null);
                }}
                className="rounded-xl bg-[#F3F6F4] px-3 py-2 text-xs font-bold text-[#14201E]"
              >
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {spacesInSede.map((esp) => {
              const selected = selectedEspacio?.id === esp.id;
              return (
                <button
                  key={esp.id}
                  type="button"
                  onClick={() => {
                    setSelectedEspacioId(esp.id);
                    setSelectedSlot(null);
                  }}
                  className={`rounded-2xl p-4 text-left border transition space-y-2 ${
                    selected
                      ? 'bg-[#E8F1EE] border-[#0F4C45] shadow-sm'
                      : 'bg-[#F7F9F8] border-black/5 hover:bg-[#F3F6F4]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-[#14201E]">{esp.nombre}</p>
                    <span className="rounded-lg bg-[#FEF6E0] text-[#7A5600] px-2 py-0.5 text-[11px] font-bold tabular-nums shrink-0">
                      Mín. S/ {esp.consumo_minimo_pen.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-[#4A5A56]">{esp.descripcion}</p>
                  <div className="flex flex-wrap gap-2 text-[11px] text-[#354440]">
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Users className="w-3.5 h-3.5 text-[#0F4C45]" />
                      Hasta {esp.capacidad} pers.
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <Wifi className="w-3.5 h-3.5 text-[#0F4C45]" />
                      {esp.equipamiento}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selector fecha + slots */}
          <div className="space-y-3 pt-2 border-t border-black/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFecha(todayStr);
                    setSelectedSlot(null);
                  }}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold ${
                    fecha === todayStr
                      ? 'bg-[#0F4C45] text-white'
                      : 'bg-[#F3F6F4] text-[#4A5A56]'
                  }`}
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFecha(tomorrowStr);
                    setSelectedSlot(null);
                  }}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold ${
                    fecha === tomorrowStr
                      ? 'bg-[#0F4C45] text-white'
                      : 'bg-[#F3F6F4] text-[#4A5A56]'
                  }`}
                >
                  Mañana
                </button>
                <input
                  type="date"
                  min={todayStr}
                  value={fecha}
                  onChange={(e) => {
                    setFecha(e.target.value);
                    setSelectedSlot(null);
                  }}
                  className="rounded-xl bg-[#F3F6F4] px-3 py-2 text-xs font-bold tabular-nums"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[#546560]">Personas:</label>
                <select
                  value={personas}
                  onChange={(e) => setPersonas(Number(e.target.value))}
                  className="rounded-xl bg-[#F3F6F4] px-2.5 py-1.5 text-xs font-bold"
                >
                  {Array.from(
                    { length: selectedEspacio?.capacidad || 4 },
                    (_, i) => i + 1
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'persona' : 'personas'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {timeSlots.length === 0 ? (
              <p className="rounded-xl bg-[#F7F9F8] p-3.5 text-xs text-[#546560]">
                No quedan horarios disponibles para hoy en esta mesa. Prueba seleccionando Mañana.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {timeSlots.map((slot) => {
                  const isPicked =
                    selectedSlot?.hora_inicio === slot.hora_inicio &&
                    selectedSlot?.hora_fin === slot.hora_fin;
                  return (
                    <button
                      key={slot.hora_inicio}
                      type="button"
                      disabled={slot.ocupado}
                      onClick={() =>
                        setSelectedSlot({ hora_inicio: slot.hora_inicio, hora_fin: slot.hora_fin })
                      }
                      className={`rounded-xl px-3 py-2.5 text-xs font-bold tabular-nums border transition min-h-[42px] ${
                        slot.ocupado
                          ? 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed line-through'
                          : isPicked
                          ? 'bg-[#0F4C45] text-white border-[#0F4C45]'
                          : 'bg-[#F3F6F4] text-[#14201E] border-transparent hover:bg-[#E8F1EE]'
                      }`}
                    >
                      {slot.hora_inicio} – {slot.hora_fin}
                    </button>
                  );
                })}
              </div>
            )}

            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo opcional (Ej. Reunión con cliente / Firma de propuesta)"
              className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs text-[#14201E]"
            />
          </div>
        </section>

        {/* PASO 2: PEDIDO MÍNIMO OBLIGATORIO DE LA CARTA */}
        <section className="rounded-3xl bg-white p-5 sm:p-6 border border-black/5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F4C45]">
                Paso 2 de 2 · Consumo mínimo obligatorio
              </p>
              <h2 className="text-base font-bold text-[#14201E]">
                Elige tu café o combo (mínimo S/ {orderSummary.minSpend.toFixed(2)})
              </h2>
            </div>

            <div className="rounded-2xl bg-[#F7F9F8] px-3.5 py-2 border border-black/5 min-w-[180px]">
              <div className="flex items-center justify-between text-xs font-bold mb-1">
                <span className={orderSummary.meetsMin ? 'text-[#0F4C45]' : 'text-[#7A5600]'}>
                  {orderSummary.meetsMin
                    ? '✓ Mínimo cubierto'
                    : `Faltan S/ ${orderSummary.missing.toFixed(2)}`}
                </span>
                <span className="tabular-nums text-[#14201E]">
                  S/ {orderSummary.total.toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    orderSummary.meetsMin ? 'bg-[#0F4C45]' : 'bg-[#F2B632]'
                  }`}
                  style={{ width: `${orderSummary.pct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {cartaItems.map((item) => {
              const qty = quantities[item.id] || 0;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl p-3.5 border flex items-center justify-between gap-3 transition ${
                    qty > 0
                      ? 'bg-[#E8F1EE]/60 border-[#0F4C45]/30'
                      : 'bg-[#F7F9F8] border-black/5'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Coffee className="w-3.5 h-3.5 text-[#0F4C45] shrink-0" />
                      <p className="text-xs font-bold text-[#14201E] truncate">{item.nombre}</p>
                    </div>
                    <p className="text-[11px] text-[#546560] truncate mt-0.5">
                      {item.categoria} ·{' '}
                      <strong className="text-[#0F4C45] tabular-nums">
                        S/ {item.precio.toFixed(2)}
                      </strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {qty > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => adjustQty(item.id, -1)}
                          className="w-8 h-8 rounded-xl bg-white border border-black/10 flex items-center justify-center text-[#14201E]"
                          aria-label={`Quitar ${item.nombre}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-5 text-center text-xs font-bold tabular-nums">
                          {qty}
                        </span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => adjustQty(item.id, 1)}
                      className="w-8 h-8 rounded-xl bg-[#0F4C45] text-white flex items-center justify-center"
                      aria-label={`Agregar ${item.nombre}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {formError && (
            <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3.5 py-2.5 text-xs font-medium">
              {formError}
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-black/5">
            <div className="text-xs text-[#4A5A56]">
              {selectedSlot ? (
                <span>
                  Horario: <strong className="text-[#14201E]">{fecha} · {selectedSlot.hora_inicio}–{selectedSlot.hora_fin}</strong>
                </span>
              ) : (
                <span>Elige un horario arriba y arma tu pedido mínimo para continuar.</span>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedSlot || !orderSummary.meetsMin}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F4C45] px-5 py-3.5 text-xs font-bold text-white disabled:opacity-45 min-h-[46px]"
            >
              <CheckCircle2 className="w-4 h-4 text-[#F2B632]" />
              <span>
                {submitting
                  ? 'Separando horario...'
                  : `Separar Mesa e ir a Yape (S/ ${orderSummary.total.toFixed(2)})`}
              </span>
            </button>
          </div>
        </section>
      </form>
    </div>
  );
};
