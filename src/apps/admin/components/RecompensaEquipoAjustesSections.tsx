import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  Check,
  Clock,
  Copy,
  Edit3,
  KeyRound,
  MonitorSmartphone,
  Palette,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import { generateNumericDigits } from '@/src/shared/auth/accessProvisioning';
import {
  DEFAULT_HAPPY_HOUR_CONFIG,
  evaluateHappyHour,
} from '@/src/shared/utils/loyaltyExtras';
import type {
  AdminAuditoriaRow,
  AdminCajero,
  AdminDispositivo,
  AdminEncuestaRow,
} from '@/src/apps/admin/hooks/useAdminData';
import type { HappyHourConfig, Negocio, NivelConfig, Sede } from '@/src/types/database';

/* ============================================================================
 * 1. RECOMPENSA & NIVELES
 * ==========================================================================*/
interface RecompensaSectionProps {
  negocio: Negocio;
  onSaveRecompensa: (updates: {
    sellos_para_premio: number;
    nombre_premio: string;
    intervalo_minimo_sellos_min: number;
    referidos_activo: boolean;
    referidos_sellos_invitador: number;
    referidos_sellos_invitado: number;
    happy_hour_config: HappyHourConfig;
    ticket_promedio_pen: number;
    costo_premio_pen: number;
  }) => Promise<void>;
  onUpdateNiveles: (niveles: NivelConfig[]) => Promise<void>;
}

const DIAS_SEMANA = [
  { id: 1, label: 'Lun' },
  { id: 2, label: 'Mar' },
  { id: 3, label: 'Mié' },
  { id: 4, label: 'Jue' },
  { id: 5, label: 'Vie' },
  { id: 6, label: 'Sáb' },
  { id: 0, label: 'Dom' },
];

export const RecompensaSection: React.FC<RecompensaSectionProps> = ({
  negocio,
  onSaveRecompensa,
  onUpdateNiveles,
}) => {
  const [sellosObjetivo, setSellosObjetivo] = useState(negocio.sellos_para_premio);
  const [nombrePremio, setNombrePremio] = useState(negocio.nombre_premio);
  const [intervaloMin, setIntervaloMin] = useState(negocio.intervalo_minimo_sellos_min);
  const [niveles, setNiveles] = useState<NivelConfig[]>(negocio.niveles_config);

  const [referidosActivo, setReferidosActivo] = useState<boolean>(
    negocio.referidos_activo ?? true
  );
  const [sellosInvitador, setSellosInvitador] = useState<number>(
    negocio.referidos_sellos_invitador ?? 1
  );
  const [sellosInvitado, setSellosInvitado] = useState<number>(
    negocio.referidos_sellos_invitado ?? 1
  );

  const [happyHour, setHappyHour] = useState<HappyHourConfig>(() => ({
    ...DEFAULT_HAPPY_HOUR_CONFIG,
    ...(negocio.happy_hour_config || {}),
  }));

  const [ticketProm, setTicketProm] = useState<number>(negocio.ticket_promedio_pen ?? 22);
  const [costoPremio, setCostoPremio] = useState<number>(negocio.costo_premio_pen ?? 9.5);
  const [saving, setSaving] = useState(false);

  const liveHappyHour = evaluateHappyHour(happyHour, negocio.zona_horaria);

  const toggleHappyDay = (dayId: number) => {
    setHappyHour((prev) => {
      const exists = prev.dias.includes(dayId);
      const nextDias = exists ? prev.dias.filter((d) => d !== dayId) : [...prev.dias, dayId];
      return { ...prev, dias: nextDias };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveRecompensa({
        sellos_para_premio: Math.max(4, Math.min(20, Number(sellosObjetivo) || 10)),
        nombre_premio: nombrePremio.trim() || 'Bebida de especialidad gratis',
        intervalo_minimo_sellos_min: Math.max(1, Number(intervaloMin) || 30),
        referidos_activo: referidosActivo,
        referidos_sellos_invitador: Math.max(1, Math.min(5, Number(sellosInvitador) || 1)),
        referidos_sellos_invitado: Math.max(0, Math.min(5, Number(sellosInvitado) || 0)),
        happy_hour_config: {
          ...happyHour,
          multiplicador: Math.max(2, Math.min(3, Number(happyHour.multiplicador) || 2)),
          etiqueta: happyHour.etiqueta.trim() || 'Hora Feliz 2x Sellos',
        },
        ticket_promedio_pen: Math.max(1, Number(ticketProm) || 22),
        costo_premio_pen: Math.max(0.5, Number(costoPremio) || 9.5),
      });
      await onUpdateNiveles(niveles);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <section className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <Award className="w-5 h-5 text-[#0F4C45]" />
          <div>
            <h2 className="text-base font-bold text-[#14201E]">Reglas de la Cartilla Digital</h2>
            <p className="text-xs text-[#546560]">
              Define cuántos sellos completan el premio y el candado anti-abuso entre visitas.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#14201E] mb-1">
              Sellos para premio
            </label>
            <input
              type="number"
              min={4}
              max={20}
              value={sellosObjetivo}
              onChange={(e) => setSellosObjetivo(Number(e.target.value))}
              className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-sm font-bold tabular-nums min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#14201E] mb-1">
              Nombre del premio
            </label>
            <input
              type="text"
              value={nombrePremio}
              onChange={(e) => setNombrePremio(e.target.value)}
              className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs font-semibold min-h-[44px]"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#14201E] mb-1">
              Intervalo mínimo entre sellos (min)
            </label>
            <input
              type="number"
              min={1}
              max={1440}
              value={intervaloMin}
              onChange={(e) => setIntervaloMin(Number(e.target.value))}
              className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-sm font-bold tabular-nums min-h-[44px]"
            />
          </div>
        </div>
      </section>

      {/* DOBLE SELLO EN HORAS MUERTAS (HAPPY HOUR) */}
      <section className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-[#0F4C45]" />
            <div>
              <h3 className="text-sm font-bold text-[#14201E]">
                Doble Sello en Horas Muertas (Happy Hour)
              </h3>
              <p className="text-xs text-[#546560]">
                Atrae clientes en horas de baja afluencia acreditando sellos dobles automáticamente en Caja POS.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {liveHappyHour.isActiveNow && (
              <span className="rounded-lg bg-[#0F4C45] px-2.5 py-1 text-[11px] font-bold text-[#F2B632]">
                ACTIVO AHORA ({liveHappyHour.multiplier}x)
              </span>
            )}
            <label className="inline-flex items-center gap-2 rounded-xl bg-[#F3F6F4] px-3 py-2 cursor-pointer">
              <input
                type="checkbox"
                checked={happyHour.activo}
                onChange={(e) => setHappyHour((p) => ({ ...p, activo: e.target.checked }))}
                className="w-4 h-4 accent-[#0F4C45]"
              />
              <span className="text-xs font-bold text-[#14201E]">Activar</span>
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold text-[#546560] mb-1.5">Días activos</p>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map((d) => {
                const selected = happyHour.dias.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleHappyDay(d.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? 'bg-[#0F4C45] text-white'
                        : 'bg-[#F3F6F4] text-[#4A5A56] hover:bg-[#E8F1EE]'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#546560] mb-1">
                Hora inicio (Lima)
              </label>
              <input
                type="time"
                value={happyHour.hora_inicio}
                onChange={(e) => setHappyHour((p) => ({ ...p, hora_inicio: e.target.value }))}
                className="w-full rounded-xl bg-[#F3F6F4] px-3 py-2 text-xs font-bold tabular-nums min-h-[40px]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#546560] mb-1">
                Hora fin (Lima)
              </label>
              <input
                type="time"
                value={happyHour.hora_fin}
                onChange={(e) => setHappyHour((p) => ({ ...p, hora_fin: e.target.value }))}
                className="w-full rounded-xl bg-[#F3F6F4] px-3 py-2 text-xs font-bold tabular-nums min-h-[40px]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#546560] mb-1">
                Multiplicador
              </label>
              <select
                value={happyHour.multiplicador}
                onChange={(e) =>
                  setHappyHour((p) => ({ ...p, multiplicador: Number(e.target.value) }))
                }
                className="w-full rounded-xl bg-[#F3F6F4] px-3 py-2 text-xs font-bold min-h-[40px]"
              >
                <option value={2}>2x Sellos (Doble)</option>
                <option value={3}>3x Sellos (Triple)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#546560] mb-1">
                Etiqueta en app
              </label>
              <input
                type="text"
                value={happyHour.etiqueta}
                onChange={(e) => setHappyHour((p) => ({ ...p, etiqueta: e.target.value }))}
                placeholder="Hora Feliz 2x Sellos"
                className="w-full rounded-xl bg-[#F3F6F4] px-3 py-2 text-xs font-semibold min-h-[40px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAMA REFIERE A UN AMIGO */}
      <section className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <UserPlus className="w-5 h-5 text-[#0F4C45]" />
            <div>
              <h3 className="text-sm font-bold text-[#14201E]">Programa Refiere a un Amigo</h3>
              <p className="text-xs text-[#546560]">
                Cero fraude: los sellos de referido se acreditan únicamente cuando el amigo realiza su 1.ª compra en Caja POS.
              </p>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl bg-[#F3F6F4] px-3 py-2 cursor-pointer self-start sm:self-center">
            <input
              type="checkbox"
              checked={referidosActivo}
              onChange={(e) => setReferidosActivo(e.target.checked)}
              className="w-4 h-4 accent-[#0F4C45]"
            />
            <span className="text-xs font-bold text-[#14201E]">Activo</span>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#546560] mb-1">
              Sellos para quien invita
            </label>
            <input
              type="number"
              min={1}
              max={5}
              value={sellosInvitador}
              onChange={(e) => setSellosInvitador(Number(e.target.value))}
              className="w-full rounded-xl bg-[#F3F6F4] px-3 py-2 text-sm font-bold tabular-nums min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#546560] mb-1">
              Sellos extra para el invitado
            </label>
            <input
              type="number"
              min={0}
              max={5}
              value={sellosInvitado}
              onChange={(e) => setSellosInvitado(Number(e.target.value))}
              className="w-full rounded-xl bg-[#F3F6F4] px-3 py-2 text-sm font-bold tabular-nums min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#546560] mb-1">
              Ticket promedio ROI (S/)
            </label>
            <input
              type="number"
              step="0.5"
              min={1}
              value={ticketProm}
              onChange={(e) => setTicketProm(Number(e.target.value))}
              className="w-full rounded-xl bg-[#F3F6F4] px-3 py-2 text-sm font-bold tabular-nums min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#546560] mb-1">
              Costo promedio premio (S/)
            </label>
            <input
              type="number"
              step="0.5"
              min={0.5}
              value={costoPremio}
              onChange={(e) => setCostoPremio(Number(e.target.value))}
              className="w-full rounded-xl bg-[#F3F6F4] px-3 py-2 text-sm font-bold tabular-nums min-h-[42px]"
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-[#14201E]">Niveles de Lealtad (Bambú / Plata / Oro)</h3>
          <p className="text-xs text-[#546560]">
            Se calculan automáticamente según el total de sellos históricos acumulados.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {niveles.map((nivel, idx) => (
            <div key={nivel.nombre} className="rounded-2xl bg-[#F7F9F8] p-4 border border-black/5 space-y-3">
              <span className="inline-flex rounded-lg bg-[#FEF6E0] px-2.5 py-1 text-xs font-bold text-[#7A5600]">
                Nivel {nivel.nombre}
              </span>
              <div>
                <label className="block text-[11px] font-semibold text-[#546560] mb-1">
                  Desde sellos históricos
                </label>
                <input
                  type="number"
                  min={0}
                  value={nivel.min_sellos_historicos}
                  onChange={(e) => {
                    const next = [...niveles];
                    next[idx] = { ...nivel, min_sellos_historicos: Number(e.target.value) };
                    setNiveles(next);
                  }}
                  className="w-full rounded-xl bg-white px-3 py-2 text-xs font-bold tabular-nums border border-black/10"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#546560] mb-1">
                  Beneficio visible en perfil
                </label>
                <input
                  type="text"
                  value={nivel.beneficio}
                  onChange={(e) => {
                    const next = [...niveles];
                    next[idx] = { ...nivel, beneficio: e.target.value };
                    setNiveles(next);
                  }}
                  className="w-full rounded-xl bg-white px-3 py-2 text-xs border border-black/10"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0F4C45] px-5 py-3 text-xs font-bold text-white min-h-[44px]"
          >
            <Save className="w-4 h-4 text-[#F2B632]" />
            <span>{saving ? 'Guardando...' : 'Guardar Recompensa y Estrategias'}</span>
          </button>
        </div>
      </section>
    </form>
  );
};

/* ============================================================================
 * 2. EQUIPO, TERMINALES POS Y SEDES
 * ==========================================================================*/
interface EquipoSectionProps {
  sedes: Sede[];
  dispositivos: AdminDispositivo[];
  cajeros: AdminCajero[];
  onCreateDispositivo: (nombre: string, sedeId: string) => Promise<void>;
  onCreateCajero: (input: {
    nombreCompleto: string;
    sedeId: string;
    celularOtp: string;
    clavePos: string;
  }) => Promise<void>;
  onResetCajeroOtp: (id: string) => Promise<void>;
  onToggleCajero: (id: string) => void;
  onCreateSede: (input: { nombre: string; direccion: string; telefono: string }) => Promise<void>;
  onUpdateSede: (id: string, input: { nombre: string; direccion: string; telefono: string }) => Promise<void>;
  onToggleSede: (id: string) => Promise<void>;
  onDeleteSede: (id: string) => Promise<void>;
}

export const EquipoSection: React.FC<EquipoSectionProps> = ({
  sedes,
  dispositivos,
  cajeros,
  onCreateDispositivo,
  onCreateCajero,
  onResetCajeroOtp,
  onToggleCajero,
  onCreateSede,
  onUpdateSede,
  onToggleSede,
  onDeleteSede,
}) => {
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceSede, setNewDeviceSede] = useState(sedes[0]?.id || '');
  const [newCajeroName, setNewCajeroName] = useState('');
  const [newCajeroSede, setNewCajeroSede] = useState(sedes[0]?.id || '');
  const [newCajeroPhone, setNewCajeroPhone] = useState('');
  const [newCajeroClave, setNewCajeroClave] = useState(() => generateNumericDigits(6));
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Sede creation & edit state
  const [newSedeName, setNewSedeName] = useState('');
  const [newSedeDireccion, setNewSedeDireccion] = useState('');
  const [newSedeTelefono, setNewSedeTelefono] = useState('');
  const [editingSedeId, setEditingSedeId] = useState<string | null>(null);
  const [editSedeName, setEditSedeName] = useState('');
  const [editSedeDireccion, setEditSedeDireccion] = useState('');
  const [editSedeTelefono, setEditSedeTelefono] = useState('');

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    await onCreateDispositivo(newDeviceName.trim(), newDeviceSede || sedes[0]?.id || '');
    setNewDeviceName('');
  };

  const handleAddCajero = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCajeroName.trim()) return;
    const digits9 = newCajeroPhone.replace(/\D/g, '').slice(-9);
    const formattedPhone = digits9.length === 9 ? `+51${digits9}` : newCajeroPhone.trim();
    await onCreateCajero({
      nombreCompleto: newCajeroName.trim(),
      sedeId: newCajeroSede || sedes[0]?.id || '',
      celularOtp: formattedPhone,
      clavePos: newCajeroClave.trim(),
    });
    setNewCajeroName('');
    setNewCajeroPhone('');
    setNewCajeroClave(generateNumericDigits(6));
  };

  const handleAddSede = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSedeName.trim()) return;
    await onCreateSede({
      nombre: newSedeName.trim(),
      direccion: newSedeDireccion.trim(),
      telefono: newSedeTelefono.trim(),
    });
    setNewSedeName('');
    setNewSedeDireccion('');
    setNewSedeTelefono('');
  };

  const handleStartEditSede = (s: Sede) => {
    setEditingSedeId(s.id);
    setEditSedeName(s.nombre);
    setEditSedeDireccion(s.direccion || '');
    setEditSedeTelefono(s.telefono || '');
  };

  const handleSaveEditSede = async (id: string) => {
    if (!editSedeName.trim()) return;
    await onUpdateSede(id, {
      nombre: editSedeName.trim(),
      direccion: editSedeDireccion.trim(),
      telefono: editSedeTelefono.trim(),
    });
    setEditingSedeId(null);
  };

  return (
    <div className="space-y-5">
      {/* Terminales Caja POS */}
      <section className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <MonitorSmartphone className="w-5 h-5 text-[#0F4C45]" />
          <div>
            <h2 className="text-base font-bold text-[#14201E]">Terminales Caja POS Autorizadas</h2>
            <p className="text-xs text-[#546560]">
              Cada tablet o celular de caja requiere un código único para emparejarse.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dispositivos.map((d) => (
            <div
              key={d.id}
              className="rounded-2xl bg-[#F7F9F8] p-4 border border-black/5 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm font-bold text-[#14201E]">{d.nombre}</p>
                <p className="text-[11px] text-[#546560]">{d.sede_nombre}</p>
                <div className="mt-2 inline-flex items-center gap-2">
                  <span className="rounded-lg bg-white border border-black/10 px-2.5 py-1 text-xs font-mono font-bold text-[#0F4C45]">
                    {d.codigo_emparejamiento}
                  </span>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                      d.emparejado ? 'bg-[#E8F1EE] text-[#0F4C45]' : 'bg-[#FEF6E0] text-[#7A5600]'
                    }`}
                  >
                    {d.emparejado ? 'Emparejada' : 'Pendiente'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy(d.codigo_emparejamiento)}
                className="rounded-xl bg-white border border-black/10 p-2.5 text-[#14201E] hover:bg-[#E8F1EE]"
                aria-label={`Copiar código ${d.codigo_emparejamiento}`}
              >
                {copiedCode === d.codigo_emparejamiento ? (
                  <Check className="w-4 h-4 text-[#0F4C45]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddDevice} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2">
          <input
            type="text"
            value={newDeviceName}
            onChange={(e) => setNewDeviceName(e.target.value)}
            placeholder="Ej. Caja 03 · Terraza"
            className="sm:col-span-5 rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs min-h-[42px]"
            required
          />
          <select
            value={newDeviceSede}
            onChange={(e) => setNewDeviceSede(e.target.value)}
            className="sm:col-span-4 rounded-xl bg-[#F3F6F4] px-3 py-2.5 text-xs min-h-[42px]"
          >
            {sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white min-h-[42px]"
          >
            <Plus className="w-4 h-4 text-[#F2B632]" />
            <span>Crear terminal</span>
          </button>
        </form>
      </section>

      {/* Usuarios POS / Cajeros administrados por Dueño */}
      <section className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <KeyRound className="w-5 h-5 text-[#0F4C45]" />
          <div>
            <h3 className="text-base font-bold text-[#14201E]">Usuarios POS (Cajeros y Claves)</h3>
            <p className="text-xs text-[#546560]">
              Crea usuarios POS según tu equipo. En su primer ingreso recibirán un código OTP obligatorio por WhatsApp para activarse.
            </p>
          </div>
        </div>

        <div className="divide-y divide-black/5 rounded-2xl border border-black/5 overflow-hidden">
          {cajeros.map((c) => (
            <div key={c.id} className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-[#14201E]">{c.nombre_completo}</p>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                      c.primer_ingreso_pendiente
                        ? 'bg-[#FEF6E0] text-[#7A5600]'
                        : 'bg-[#E8F1EE] text-[#0F4C45]'
                    }`}
                  >
                    {c.primer_ingreso_pendiente ? 'Pendiente OTP 1.er ingreso' : 'Activado por OTP'}
                  </span>
                </div>
                <p className="text-xs text-[#546560] mt-0.5">
                  {c.sede_nombre} {c.celular_otp ? `· OTP: ${c.celular_otp}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!c.primer_ingreso_pendiente && (
                  <button
                    type="button"
                    onClick={() => void onResetCajeroOtp(c.id)}
                    className="inline-flex items-center gap-1 rounded-xl bg-[#F3F6F4] hover:bg-[#E4EBE7] px-3 py-2 text-xs font-bold text-[#354440] min-h-[38px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Pedir OTP</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onToggleCajero(c.id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold min-h-[38px] ${
                    c.activo
                      ? 'bg-[#E8F1EE] text-[#0F4C45]'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {c.activo ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                  <span>{c.activo ? 'Activo' : 'Suspendido'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddCajero} className="rounded-2xl bg-[#F7F9F8] p-4 border border-black/5 space-y-3">
          <p className="text-xs font-bold text-[#14201E]">Nuevo usuario POS</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <input
              type="text"
              value={newCajeroName}
              onChange={(e) => setNewCajeroName(e.target.value)}
              placeholder="Nombre completo (ej. Sofía P.)"
              className="rounded-xl bg-white border border-black/10 px-3.5 py-2.5 text-xs min-h-[42px]"
              required
            />
            <select
              value={newCajeroSede}
              onChange={(e) => setNewCajeroSede(e.target.value)}
              className="rounded-xl bg-white border border-black/10 px-3 py-2.5 text-xs min-h-[42px]"
            >
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={newCajeroPhone}
              onChange={(e) => setNewCajeroPhone(e.target.value)}
              placeholder="WhatsApp OTP (ej. 987654321)"
              className="rounded-xl bg-white border border-black/10 px-3.5 py-2.5 text-xs font-mono min-h-[42px]"
              required
            />
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                pattern="[0-9]{4,8}"
                value={newCajeroClave}
                onChange={(e) => setNewCajeroClave(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="Clave 4-8 díg."
                className="flex-1 rounded-xl bg-white border border-black/10 px-3 py-2.5 text-xs font-mono font-bold tracking-widest min-h-[42px]"
                required
              />
              <button
                type="button"
                onClick={() => setNewCajeroClave(generateNumericDigits(6))}
                title="Generar nueva clave"
                className="rounded-xl bg-[#FEF6E0] px-2.5 py-2.5 text-[#7A5600] hover:bg-[#FDECB8] min-h-[42px]"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white min-h-[42px]"
            >
              <UserPlus className="w-4 h-4 text-[#F2B632]" />
              <span>Crear usuario POS</span>
            </button>
          </div>
        </form>
      </section>

      {/* Sedes (Gestión Completa: Crear, Editar, Pausar/Activar, Eliminar) */}
      <section className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Store className="w-5 h-5 text-[#0F4C45]" />
            <div>
              <h3 className="text-base font-bold text-[#14201E]">Sedes y Locales ({sedes.length})</h3>
              <p className="text-xs text-[#546560]">Administra las sucursales, direcciones, teléfonos y estado operativo.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sedes.map((s) => {
            const isEditing = editingSedeId === s.id;
            const activo = s.activo ?? true;
            return (
              <div key={s.id} className="rounded-2xl bg-[#F7F9F8] p-4 border border-black/5 space-y-3">
                {isEditing ? (
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      value={editSedeName}
                      onChange={(e) => setEditSedeName(e.target.value)}
                      placeholder="Nombre de sede"
                      className="w-full rounded-xl bg-white border border-black/10 px-3 py-2 text-xs font-bold text-[#14201E]"
                      required
                    />
                    <input
                      type="text"
                      value={editSedeDireccion}
                      onChange={(e) => setEditSedeDireccion(e.target.value)}
                      placeholder="Dirección"
                      className="w-full rounded-xl bg-white border border-black/10 px-3 py-2 text-xs text-[#14201E]"
                    />
                    <input
                      type="text"
                      value={editSedeTelefono}
                      onChange={(e) => setEditSedeTelefono(e.target.value)}
                      placeholder="Teléfono"
                      className="w-full rounded-xl bg-white border border-black/10 px-3 py-2 text-xs text-[#14201E]"
                    />
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingSedeId(null)}
                        className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#546560] border border-black/10"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEditSede(s.id)}
                        className="rounded-xl bg-[#0F4C45] px-3.5 py-1.5 text-xs font-bold text-white"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[#14201E]">{s.nombre}</p>
                          <span
                            className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                              activo ? 'bg-[#E8F1EE] text-[#0F4C45]' : 'bg-[#FEF6E0] text-[#7A5600]'
                            }`}
                          >
                            {activo ? 'Activa' : 'Pausada'}
                          </span>
                        </div>
                        <p className="text-xs text-[#546560] mt-0.5">{s.direccion || 'Lima, Perú'}</p>
                        <p className="text-xs text-[#0F4C45] font-semibold mt-1 tabular-nums">
                          {s.telefono || 'Sin teléfono'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-black/5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEditSede(s)}
                          className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#14201E] border border-black/10 hover:bg-[#E8F1EE]"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#0F4C45]" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void onToggleSede(s.id)}
                          className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold border ${
                            activo
                              ? 'bg-white text-[#7A5600] border-black/10 hover:bg-[#FEF6E0]'
                              : 'bg-white text-[#0F4C45] border-black/10 hover:bg-[#E8F1EE]'
                          }`}
                        >
                          {activo ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          <span>{activo ? 'Pausar' : 'Activar'}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => void onDeleteSede(s.id)}
                        className="rounded-xl bg-white p-2 text-red-700 border border-red-200 hover:bg-red-50"
                        title="Eliminar sede"
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

        <form onSubmit={handleAddSede} className="rounded-2xl bg-[#F7F9F8] p-4 border border-black/5 space-y-3">
          <p className="text-xs font-bold text-[#14201E]">Nueva Sede / Sucursal</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <input
              type="text"
              value={newSedeName}
              onChange={(e) => setNewSedeName(e.target.value)}
              placeholder="Nombre comercial (ej. Sede Surco)"
              className="rounded-xl bg-white border border-black/10 px-3.5 py-2.5 text-xs min-h-[42px]"
              required
            />
            <input
              type="text"
              value={newSedeDireccion}
              onChange={(e) => setNewSedeDireccion(e.target.value)}
              placeholder="Dirección (ej. Av. Primavera 450)"
              className="rounded-xl bg-white border border-black/10 px-3.5 py-2.5 text-xs min-h-[42px]"
            />
            <input
              type="text"
              value={newSedeTelefono}
              onChange={(e) => setNewSedeTelefono(e.target.value)}
              placeholder="Teléfono (ej. +51 1 223 4455)"
              className="rounded-xl bg-white border border-black/10 px-3.5 py-2.5 text-xs min-h-[42px]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white min-h-[42px]"
            >
              <Plus className="w-4 h-4 text-[#F2B632]" />
              <span>Crear nueva sede</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};

/* ============================================================================
 * 3. AJUSTES DE MARCA Y SEGURIDAD
 * ==========================================================================*/
interface AjustesSectionProps {
  negocio: Negocio;
  onSaveAjustes: (updates: {
    nombre: string;
    subtitulo: string | null;
    color_primario: string;
    color_secundario: string;
    whatsapp_contacto_numero: string | null;
    google_maps_url: string | null;
    otp_requerido_login: boolean;
    otp_requerido_canje: boolean;
    texto_privacidad: string;
  }) => Promise<void>;
}

export const AjustesSection: React.FC<AjustesSectionProps> = ({ negocio, onSaveAjustes }) => {
  const [nombre, setNombre] = useState(negocio.nombre);
  const [subtitulo, setSubtitulo] = useState(negocio.subtitulo || '');
  const [colorPrimario, setColorPrimario] = useState(negocio.color_primario);
  const [colorSecundario, setColorSecundario] = useState(negocio.color_secundario);
  const [waContacto, setWaContacto] = useState(negocio.whatsapp_contacto_numero || '');
  const [mapsUrl, setMapsUrl] = useState(negocio.google_maps_url || '');
  const [otpLogin, setOtpLogin] = useState(negocio.otp_requerido_login);
  const [otpCanje, setOtpCanje] = useState(negocio.otp_requerido_canje);
  const [privacidad, setPrivacidad] = useState(negocio.texto_privacidad);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveAjustes({
        nombre: nombre.trim() || 'Olivia Café',
        subtitulo: subtitulo.trim() || null,
        color_primario: colorPrimario,
        color_secundario: colorSecundario,
        whatsapp_contacto_numero: waContacto.trim() || null,
        google_maps_url: mapsUrl.trim() || null,
        otp_requerido_login: otpLogin,
        otp_requerido_canje: otpCanje,
        texto_privacidad: privacidad.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <Palette className="w-5 h-5 text-[#0F4C45]" />
          <div>
            <h2 className="text-base font-bold text-[#14201E]">Identidad White-Label y Marca</h2>
            <p className="text-xs text-[#546560]">
              Cualquier cambio actualiza los tokens visuales de las 3 PWAs en vivo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#14201E] mb-1">Nombre comercial</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs font-semibold min-h-[42px]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#14201E] mb-1">Subtítulo / Sedes</label>
            <input
              type="text"
              value={subtitulo}
              onChange={(e) => setSubtitulo(e.target.value)}
              className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs min-h-[42px]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#14201E] mb-1">Color primario</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorPrimario}
                onChange={(e) => setColorPrimario(e.target.value)}
                className="w-11 h-10 rounded-xl border border-black/10 cursor-pointer"
              />
              <input
                type="text"
                value={colorPrimario}
                onChange={(e) => setColorPrimario(e.target.value)}
                className="flex-1 rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#14201E] mb-1">Color acento dorado</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorSecundario}
                onChange={(e) => setColorSecundario(e.target.value)}
                className="w-11 h-10 rounded-xl border border-black/10 cursor-pointer"
              />
              <input
                type="text"
                value={colorSecundario}
                onChange={(e) => setColorSecundario(e.target.value)}
                className="flex-1 rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#14201E] mb-1">
              WhatsApp oficial del local
            </label>
            <input
              type="text"
              value={waContacto}
              onChange={(e) => setWaContacto(e.target.value)}
              placeholder="+51987111222"
              className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs font-mono min-h-[42px]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#14201E] mb-1">
              URL de reseñas Google Maps
            </label>
            <input
              type="url"
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs min-h-[42px]"
            />
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-[#14201E]">Privacidad y Verificación OTP</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F9F8] p-4 border border-black/5 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-[#14201E]">OTP por WhatsApp al iniciar sesión</p>
              <p className="text-[11px] text-[#546560]">Desactivado = acceso inmediato</p>
            </div>
            <input
              type="checkbox"
              checked={otpLogin}
              onChange={(e) => setOtpLogin(e.target.checked)}
              className="w-4 h-4 accent-[#0F4C45]"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F9F8] p-4 border border-black/5 cursor-pointer">
            <div>
              <p className="text-xs font-bold text-[#14201E]">OTP al canjear premio en caja</p>
              <p className="text-[11px] text-[#546560]">Refuerzo anti-suplantación</p>
            </div>
            <input
              type="checkbox"
              checked={otpCanje}
              onChange={(e) => setOtpCanje(e.target.checked)}
              className="w-4 h-4 accent-[#0F4C45]"
            />
          </label>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#14201E] mb-1">
            Texto breve de privacidad (Ley 29733 Perú)
          </label>
          <textarea
            rows={2}
            value={privacidad}
            onChange={(e) => setPrivacidad(e.target.value)}
            className="w-full rounded-2xl bg-[#F3F6F4] p-3 text-xs text-[#14201E]"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0F4C45] px-5 py-3 text-xs font-bold text-white min-h-[44px]"
          >
            <Save className="w-4 h-4 text-[#F2B632]" />
            <span>{saving ? 'Guardando...' : 'Guardar ajustes'}</span>
          </button>
        </div>
      </section>
    </form>
  );
};

/* ============================================================================
 * 4. AUDITORÍA DE SEGURIDAD Y ENCUESTAS PRIVADAS
 * ==========================================================================*/
interface AuditoriaSectionProps {
  auditoria: AdminAuditoriaRow[];
  encuestas: AdminEncuestaRow[];
}

export const AuditoriaSection: React.FC<AuditoriaSectionProps> = ({ auditoria, encuestas }) => {
  const [onlyAlerts, setOnlyAlerts] = useState(false);

  const visibleLogs = onlyAlerts ? auditoria.filter((a) => a.alerta_fraude) : auditoria;

  return (
    <div className="space-y-5">
      {/* Registro de Auditoría */}
      <section className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0F4C45]" />
            <div>
              <h2 className="text-base font-bold text-[#14201E]">Auditoría y Seguridad en Caja</h2>
              <p className="text-xs text-[#546560]">
                Trazabilidad inmutable de sellos, canjes, intentos de PIN y alertas preventivas.
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setOnlyAlerts(false)}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                !onlyAlerts ? 'bg-[#0F4C45] text-white' : 'bg-[#F3F6F4] text-[#4A5A56]'
              }`}
            >
              Todos ({auditoria.length})
            </button>
            <button
              type="button"
              onClick={() => setOnlyAlerts(true)}
              className={`rounded-xl px-3 py-2 text-xs font-bold ${
                onlyAlerts ? 'bg-red-700 text-white' : 'bg-red-50 text-red-700'
              }`}
            >
              Alertas ({auditoria.filter((a) => a.alerta_fraude).length})
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {visibleLogs.map((log) => (
            <div
              key={log.id}
              className={`rounded-2xl p-4 border flex items-start justify-between gap-3 ${
                log.alerta_fraude
                  ? 'bg-red-50/70 border-red-200'
                  : 'bg-[#F7F9F8] border-black/5'
              }`}
            >
              <div className="flex items-start gap-3">
                {log.alerta_fraude ? (
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-[#0F4C45] shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-xs font-bold text-[#14201E] uppercase tracking-wider">
                    {log.accion}
                  </p>
                  <p className="text-xs text-[#354440] mt-0.5">{log.detalle}</p>
                </div>
              </div>
              <span className="text-[11px] text-[#6A7B76] whitespace-nowrap">
                {new Date(log.created_at).toLocaleString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Feedback Privado de Encuestas */}
      <section className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <Star className="w-5 h-5 text-[#D99B16]" />
          <div>
            <h3 className="text-base font-bold text-[#14201E]">Encuestas Post-Visita y Detractores</h3>
            <p className="text-xs text-[#546560]">
              Las calificaciones ≤ 3 estrellas llegan aquí de forma privada sin publicarse en Google Maps.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {encuestas.map((enc) => {
            const isDetractor = enc.calificacion <= 3;
            return (
              <div
                key={enc.id}
                className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  isDetractor ? 'bg-red-50/60 border-red-200' : 'bg-[#F7F9F8] border-black/5'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#14201E]">{enc.cliente_nombre}</span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        isDetractor ? 'bg-red-100 text-red-800' : 'bg-[#E8F1EE] text-[#0F4C45]'
                      }`}
                    >
                      {enc.calificacion} ★
                    </span>
                  </div>
                  <p className="text-xs text-[#4A5A56] mt-1">
                    {enc.comentario || 'Sin comentario escrito.'}
                  </p>
                </div>
                <span className="text-[11px] text-[#6A7B76]">
                  {new Date(enc.created_at).toLocaleDateString('es-PE', {
                    day: '2-digit',
                    month: 'short',
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
