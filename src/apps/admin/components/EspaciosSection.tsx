import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  Laptop,
  Pause,
  Play,
  Plus,
  Trash2,
  Users,
  Wifi,
} from 'lucide-react';
import type { EspacioCoworking, Negocio, ReservaCoworking, Sede } from '@/src/types/database';

interface EspaciosSectionProps {
  negocio: Negocio;
  sedes: Sede[];
  espacios: EspacioCoworking[];
  reservas: ReservaCoworking[];
  onCreateEspacio: (input: {
    sede_id: string;
    nombre: string;
    capacidad: number;
    descripcion: string;
    equipamiento: string;
    consumo_minimo_pen: number;
    duracion_bloque_min: number;
    hora_apertura: string;
    hora_cierre: string;
  }) => Promise<void>;
  onUpdateEspacio: (
    id: string,
    input: {
      sede_id: string;
      nombre: string;
      capacidad: number;
      descripcion: string;
      equipamiento: string;
      consumo_minimo_pen: number;
      duracion_bloque_min: number;
      hora_apertura: string;
      hora_cierre: string;
    }
  ) => Promise<void>;
  onToggleEspacio: (id: string) => Promise<void>;
  onDeleteEspacio: (id: string) => Promise<void>;
  onNavigateAjustes: () => void;
}

const ESTADO_LABELS: Record<
  ReservaCoworking['estado'],
  { label: string; badgeClass: string }
> = {
  pendiente_pago: {
    label: 'Esperando Yape',
    badgeClass: 'bg-slate-100 text-slate-700',
  },
  yape_por_validar: {
    label: 'Yape por validar',
    badgeClass: 'bg-[#FEF6E0] text-[#7A5600]',
  },
  confirmada: {
    label: 'Confirmada',
    badgeClass: 'bg-[#E8F1EE] text-[#0F4C45]',
  },
  checkin: {
    label: 'Check-in OK',
    badgeClass: 'bg-[#0F4C45] text-[#F2B632]',
  },
  rechazada: {
    label: 'Observada',
    badgeClass: 'bg-red-50 text-red-700',
  },
  cancelada: {
    label: 'Cancelada',
    badgeClass: 'bg-slate-100 text-slate-500',
  },
};

export const EspaciosSection: React.FC<EspaciosSectionProps> = ({
  negocio,
  sedes,
  espacios,
  reservas,
  onCreateEspacio,
  onUpdateEspacio,
  onToggleEspacio,
  onDeleteEspacio,
  onNavigateAjustes,
}) => {
  const [nombre, setNombre] = useState('');
  const [sedeId, setSedeId] = useState(sedes[0]?.id || '');
  const [capacidad, setCapacidad] = useState(4);
  const [consumoMin, setConsumoMin] = useState(negocio.coworking_consumo_minimo_pen ?? 18);
  const [duracionMin, setDuracionMin] = useState(120);
  const [horaApertura, setHoraApertura] = useState('08:00');
  const [horaCierre, setHoraCierre] = useState('20:00');
  const [equipamiento, setEquipamiento] = useState('Wi-Fi Fibra 300Mbps · Enchufes · Zona tranquila');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    sede_id: string;
    nombre: string;
    capacidad: number;
    descripcion: string;
    equipamiento: string;
    consumo_minimo_pen: number;
    duracion_bloque_min: number;
    hora_apertura: string;
    hora_cierre: string;
  } | null>(null);

  const sedeMap = useMemo(() => new Map(sedes.map((s) => [s.id, s.nombre])), [sedes]);

  const metrics = useMemo(() => {
    const confirmadas = reservas.filter(
      (r) => r.estado === 'confirmada' || r.estado === 'checkin'
    );
    const ingresos = confirmadas.reduce((acc, r) => acc + (r.total_pedido_pen || 0), 0);
    const porValidar = reservas.filter((r) => r.estado === 'yape_por_validar').length;
    const activas = espacios.filter((e) => e.activo).length;
    return {
      totalConfirmadas: confirmadas.length,
      ingresos,
      porValidar,
      activas,
    };
  }, [espacios, reservas]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      await onCreateEspacio({
        sede_id: sedeId || sedes[0]?.id || '',
        nombre: nombre.trim(),
        capacidad: Math.max(1, Number(capacidad) || 2),
        descripcion:
          descripcion.trim() ||
          'Mesa reservable para reuniones, trabajo remoto o estudio con consumo mínimo en café.',
        equipamiento: equipamiento.trim() || 'Wi-Fi Fibra · Enchufes',
        consumo_minimo_pen: Math.max(5, Number(consumoMin) || 15),
        duracion_bloque_min: Math.max(60, Number(duracionMin) || 120),
        hora_apertura: horaApertura || '08:00',
        hora_cierre: horaCierre || '20:00',
      });
      setNombre('');
      setDescripcion('');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (esp: EspacioCoworking) => {
    setEditingId(esp.id);
    setEditDraft({
      sede_id: esp.sede_id,
      nombre: esp.nombre,
      capacidad: esp.capacidad,
      descripcion: esp.descripcion,
      equipamiento: esp.equipamiento,
      consumo_minimo_pen: esp.consumo_minimo_pen,
      duracion_bloque_min: esp.duracion_bloque_min,
      hora_apertura: esp.hora_apertura,
      hora_cierre: esp.hora_cierre,
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editDraft || !editDraft.nombre.trim()) return;
    await onUpdateEspacio(id, editDraft);
    setEditingId(null);
    setEditDraft(null);
  };

  return (
    <div className="space-y-5">
      {/* Cabecera estado Coworking + Yape */}
      <section className="rounded-3xl bg-[#0F4C45] text-white p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-white/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#F2B632]">
              Coworking & Reuniones
            </span>
            <span className="rounded-lg bg-white/10 px-2.5 py-0.5 text-[11px] font-bold">
              {metrics.activas} mesa(s) habilitada(s)
            </span>
          </div>
          <h2 className="text-xl font-bold">Espacios Reservables con Consumo Mínimo</h2>
          <p className="text-xs text-white/80 max-w-2xl">
            Habilita solo 2 o 3 mesas al inicio y escala según demanda. Todo el flujo —elección de hora, pedido mínimo y pago Yape— ocurre dentro de la app sin salir a WhatsApp.
          </p>
        </div>

        <div className="rounded-2xl bg-white/10 border border-white/15 p-3.5 text-xs space-y-1.5 shrink-0">
          <p className="text-[11px] text-white/75 font-semibold">Yape configurado para reservas:</p>
          <p className="font-mono font-bold text-sm text-[#F2B632]">
            {negocio.yape_numero || '987 111 222'} · {negocio.yape_titular || negocio.nombre}
          </p>
          <button
            type="button"
            onClick={onNavigateAjustes}
            className="text-[11px] font-bold underline text-white/90 hover:text-white"
          >
            Editar número Yape y tolerancia en Ajustes →
          </button>
        </div>
      </section>

      {/* KPIs rápidos Cowork */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-white p-4 border border-black/5 shadow-sm">
          <p className="text-[11px] font-semibold text-[#546560]">Mesas Activas</p>
          <p className="text-2xl font-bold tabular-nums text-[#0F4C45] mt-1">
            {metrics.activas} / {espacios.length}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-black/5 shadow-sm">
          <p className="text-[11px] font-semibold text-[#546560]">Yapes por Validar</p>
          <p className="text-2xl font-bold tabular-nums text-[#7A5600] mt-1">
            {metrics.porValidar}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-black/5 shadow-sm">
          <p className="text-[11px] font-semibold text-[#546560]">Mesas Separadas</p>
          <p className="text-2xl font-bold tabular-nums text-[#14201E] mt-1">
            {metrics.totalConfirmadas}
          </p>
        </div>
        <div className="rounded-2xl bg-[#E8F1EE] p-4 border border-[#0F4C45]/10 shadow-sm">
          <p className="text-[11px] font-semibold text-[#0F4C45]">Consumo Asegurado</p>
          <p className="text-2xl font-bold tabular-nums text-[#0F4C45] mt-1">
            S/ {metrics.ingresos.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Lista de Mesas / Espacios */}
      <section className="rounded-3xl bg-white p-5 sm:p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <Laptop className="w-5 h-5 text-[#0F4C45]" />
          <div>
            <h3 className="text-base font-bold text-[#14201E]">
              Mesas y Espacios Disponibles ({espacios.length})
            </h3>
            <p className="text-xs text-[#546560]">
              Activa o pausa mesas en cualquier momento y ajusta el consumo mínimo por bloque horario.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {espacios.map((esp) => {
            const isEditing = editingId === esp.id && editDraft;
            return (
              <div
                key={esp.id}
                className={`rounded-2xl p-4 border space-y-3 ${
                  esp.activo
                    ? 'bg-[#F7F9F8] border-black/5'
                    : 'bg-slate-50 border-slate-200 opacity-80'
                }`}
              >
                {isEditing && editDraft ? (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={editDraft.nombre}
                      onChange={(e) => setEditDraft({ ...editDraft, nombre: e.target.value })}
                      className="w-full rounded-xl bg-white border border-black/10 px-3 py-2 text-xs font-bold"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={editDraft.sede_id}
                        onChange={(e) => setEditDraft({ ...editDraft, sede_id: e.target.value })}
                        className="rounded-xl bg-white border border-black/10 px-2.5 py-2 text-xs"
                      >
                        {sedes.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={editDraft.capacidad}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, capacidad: Number(e.target.value) })
                        }
                        placeholder="Personas"
                        className="rounded-xl bg-white border border-black/10 px-2.5 py-2 text-xs font-bold tabular-nums"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-[#546560] mb-0.5">
                          Consumo mín (S/)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min={5}
                          value={editDraft.consumo_minimo_pen}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              consumo_minimo_pen: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-xl bg-white border border-black/10 px-2.5 py-1.5 text-xs font-bold tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#546560] mb-0.5">
                          Bloque (min)
                        </label>
                        <input
                          type="number"
                          step={30}
                          min={60}
                          max={240}
                          value={editDraft.duracion_bloque_min}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              duracion_bloque_min: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-xl bg-white border border-black/10 px-2.5 py-1.5 text-xs font-bold tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#546560] mb-0.5">
                          Abre
                        </label>
                        <input
                          type="time"
                          value={editDraft.hora_apertura}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, hora_apertura: e.target.value })
                          }
                          className="w-full rounded-xl bg-white border border-black/10 px-2 py-1.5 text-xs font-bold tabular-nums"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#546560] mb-0.5">
                          Cierra
                        </label>
                        <input
                          type="time"
                          value={editDraft.hora_cierre}
                          onChange={(e) =>
                            setEditDraft({ ...editDraft, hora_cierre: e.target.value })
                          }
                          className="w-full rounded-xl bg-white border border-black/10 px-2 py-1.5 text-xs font-bold tabular-nums"
                        />
                      </div>
                    </div>
                    <input
                      type="text"
                      value={editDraft.equipamiento}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, equipamiento: e.target.value })
                      }
                      placeholder="Equipamiento"
                      className="w-full rounded-xl bg-white border border-black/10 px-3 py-2 text-xs"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft(null);
                        }}
                        className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#546560] border border-black/10"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(esp.id)}
                        className="rounded-xl bg-[#0F4C45] px-3.5 py-1.5 text-xs font-bold text-white"
                      >
                        Guardar cambios
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-[#14201E]">{esp.nombre}</h4>
                          <span
                            className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                              esp.activo
                                ? 'bg-[#E8F1EE] text-[#0F4C45]'
                                : 'bg-[#FEF6E0] text-[#7A5600]'
                            }`}
                          >
                            {esp.activo ? 'Habilitada' : 'Pausada'}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-[#0F4C45] mt-0.5">
                          {sedeMap.get(esp.sede_id) || 'Sede Principal'}
                        </p>
                      </div>

                      <span className="rounded-xl bg-[#FEF6E0] text-[#7A5600] px-2.5 py-1 text-xs font-bold tabular-nums shrink-0">
                        Mín. S/ {esp.consumo_minimo_pen.toFixed(2)}
                      </span>
                    </div>

                    <p className="text-xs text-[#4A5A56] leading-relaxed">{esp.descripcion}</p>

                    <div className="flex flex-wrap gap-2 text-[11px] text-[#354440]">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 border border-black/5 font-semibold">
                        <Users className="w-3.5 h-3.5 text-[#0F4C45]" />
                        Hasta {esp.capacidad} pers.
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 border border-black/5 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-[#0F4C45]" />
                        Bloques {esp.duracion_bloque_min}m ({esp.hora_apertura}–{esp.hora_cierre})
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 border border-black/5 font-semibold">
                        <Wifi className="w-3.5 h-3.5 text-[#0F4C45]" />
                        {esp.equipamiento}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-black/5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(esp)}
                          className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#14201E] border border-black/10 hover:bg-[#E8F1EE]"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#0F4C45]" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void onToggleEspacio(esp.id)}
                          className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#14201E] border border-black/10 hover:bg-[#FEF6E0]"
                        >
                          {esp.activo ? (
                            <Pause className="w-3.5 h-3.5 text-[#7A5600]" />
                          ) : (
                            <Play className="w-3.5 h-3.5 text-[#0F4C45]" />
                          )}
                          <span>{esp.activo ? 'Pausar' : 'Activar'}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => void onDeleteEspacio(esp.id)}
                        className="rounded-xl bg-white p-2 text-red-700 border border-red-200 hover:bg-red-50"
                        title="Eliminar espacio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Agregar nuevo espacio según demanda */}
        <form
          onSubmit={handleCreate}
          className="rounded-2xl bg-[#F7F9F8] p-4 border border-black/5 space-y-3"
        >
          <p className="text-xs font-bold text-[#14201E]">
            Habilitar nueva mesa o cabina coworking
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Mesa Terraza 03"
              className="rounded-xl bg-white border border-black/10 px-3 py-2.5 text-xs min-h-[42px]"
              required
            />
            <select
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
              className="rounded-xl bg-white border border-black/10 px-3 py-2.5 text-xs min-h-[42px]"
            >
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                max={20}
                value={capacidad}
                onChange={(e) => setCapacidad(Number(e.target.value))}
                placeholder="Pers."
                title="Capacidad máxima de personas"
                className="rounded-xl bg-white border border-black/10 px-3 py-2.5 text-xs font-bold tabular-nums min-h-[42px]"
              />
              <input
                type="number"
                step="0.5"
                min={5}
                value={consumoMin}
                onChange={(e) => setConsumoMin(Number(e.target.value))}
                placeholder="S/ mín."
                title="Consumo mínimo en soles"
                className="rounded-xl bg-white border border-black/10 px-3 py-2.5 text-xs font-bold tabular-nums min-h-[42px]"
              />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <select
                value={duracionMin}
                onChange={(e) => setDuracionMin(Number(e.target.value))}
                title="Duración del bloque"
                className="rounded-xl bg-white border border-black/10 px-2 py-2.5 text-xs font-bold min-h-[42px]"
              >
                <option value={60}>60m</option>
                <option value={90}>90m</option>
                <option value={120}>2h</option>
                <option value={180}>3h</option>
              </select>
              <input
                type="time"
                value={horaApertura}
                onChange={(e) => setHoraApertura(e.target.value)}
                className="rounded-xl bg-white border border-black/10 px-1.5 py-2 text-[11px] font-bold tabular-nums min-h-[42px]"
              />
              <input
                type="time"
                value={horaCierre}
                onChange={(e) => setHoraCierre(e.target.value)}
                className="rounded-xl bg-white border border-black/10 px-1.5 py-2 text-[11px] font-bold tabular-nums min-h-[42px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              value={equipamiento}
              onChange={(e) => setEquipamiento(e.target.value)}
              placeholder="Equipamiento (Ej. Wi-Fi Fibra · 4 Enchufes)"
              className="rounded-xl bg-white border border-black/10 px-3 py-2.5 text-xs min-h-[42px]"
            />
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción breve para tu cliente (opcional)"
              className="rounded-xl bg-white border border-black/10 px-3 py-2.5 text-xs min-h-[42px]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white min-h-[42px]"
            >
              <Plus className="w-4 h-4 text-[#F2B632]" />
              <span>{saving ? 'Creando...' : 'Agregar mesa cowork'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Historial de Reservas Recientes */}
      <section className="rounded-3xl bg-white p-5 sm:p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarClock className="w-5 h-5 text-[#0F4C45]" />
            <div>
              <h3 className="text-base font-bold text-[#14201E]">
                Reservas de Reuniones ({reservas.length})
              </h3>
              <p className="text-xs text-[#546560]">
                La validación de Yape y el Check-in se operan en vivo desde Caja POS → Mesas.
              </p>
            </div>
          </div>
        </div>

        {reservas.length === 0 ? (
          <div className="rounded-2xl bg-[#F7F9F8] p-6 text-center text-xs text-[#546560]">
            Aún no hay reservas registradas. Cuando un cliente separe mesa desde su app, aparecerá aquí y en Caja POS.
          </div>
        ) : (
          <div className="space-y-2.5">
            {reservas.slice(0, 15).map((r) => {
              const badge = ESTADO_LABELS[r.estado];
              return (
                <div
                  key={r.id}
                  className="rounded-2xl bg-[#F7F9F8] p-4 border border-black/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#0F4C45]">
                        {r.codigo_reserva}
                      </span>
                      <p className="text-sm font-bold text-[#14201E]">
                        {r.cliente_nombre || 'Cliente'}
                      </p>
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${badge.badgeClass}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#4A5A56] mt-0.5">
                      {r.espacio_nombre || 'Mesa Cowork'} · {r.fecha} · {r.hora_inicio}–{r.hora_fin} ({r.personas} pers.)
                    </p>
                    {r.motivo_reunion && (
                      <p className="text-[11px] text-[#546560] mt-0.5">
                        Motivo: {r.motivo_reunion}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-center">
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-[#0F4C45]">
                        S/ {r.total_pedido_pen.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-[#6A7B76]">
                        {r.items_pedido.reduce((a, i) => a + i.cantidad, 0)} prod.
                      </p>
                    </div>
                    {r.estado === 'confirmada' || r.estado === 'checkin' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#0F4C45] shrink-0" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
