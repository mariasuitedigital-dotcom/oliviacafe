import React, { useState } from 'react';
import {
  Edit3,
  Image as ImageIcon,
  Megaphone,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { AdminCampana } from '@/src/apps/admin/hooks/useAdminData';
import type { CanalMensaje, Promocion } from '@/src/types/database';

interface PromocionesSectionProps {
  promociones: Promocion[];
  campanas: AdminCampana[];
  whatsappLimit: number;
  onCreatePromo: (input: {
    titulo: string;
    descripcion: string;
    precio_especial: number;
    precio_regular: number | null;
    sellos_extra: number;
    limite_por_cliente: number;
    dias_vigencia: number;
    audiencia: string;
    canal: CanalMensaje;
    imagen_url?: string;
  }) => Promise<void>;
  onUpdatePromo: (
    promoId: string,
    input: {
      titulo: string;
      descripcion: string;
      precio_especial: number;
      precio_regular: number | null;
      sellos_extra: number;
      imagen_url?: string;
    }
  ) => Promise<void>;
  onTogglePromo: (promoId: string) => Promise<void>;
  onDeletePromo: (promoId: string) => Promise<void>;
  onLaunchCampaign: (input: {
    titulo: string;
    mensaje: string;
    audiencia: 'todos' | 'inactivos_15' | 'casi_premio';
    canal: CanalMensaje;
  }) => Promise<void>;
}

export const PromocionesSection: React.FC<PromocionesSectionProps> = ({
  promociones,
  campanas,
  whatsappLimit,
  onCreatePromo,
  onUpdatePromo,
  onTogglePromo,
  onDeletePromo,
  onLaunchCampaign,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promocion | null>(null);

  // Formulario Crear / Editar
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precioEspecial, setPrecioEspecial] = useState('16.90');
  const [precioRegular, setPrecioRegular] = useState('24.00');
  const [sellosExtra, setSellosExtra] = useState(1);
  const [diasVigencia, setDiasVigencia] = useState(14);
  const [canalPromo, setCanalPromo] = useState<CanalMensaje>('push');
  const [imagenUrl, setImagenUrl] = useState('/src/assets/images/aitama_reward_cup_1794847436322.jpg');

  // Campaña segmentada rápida
  const [campTitulo, setCampTitulo] = useState('¡Nueva Promo en Olivia Café!');
  const [campMensaje, setCampMensaje] = useState(
    '¡Hola! Aprovecha nuestra promoción especial de hoy y suma sellos extra en tu cartilla.'
  );
  const [campAudiencia, setCampAudiencia] = useState<'todos' | 'inactivos_15' | 'casi_premio'>('todos');
  const [campCanal, setCampCanal] = useState<CanalMensaje>('push');
  const [sendingCamp, setSendingCamp] = useState(false);

  const handleOpenCreate = () => {
    setEditingPromo(null);
    setTitulo('');
    setDescripcion('');
    setPrecioEspecial('16.90');
    setPrecioRegular('24.00');
    setSellosExtra(1);
    setImagenUrl('/src/assets/images/aitama_reward_cup_1794847436322.jpg');
    setShowCreateForm(true);
  };

  const handleOpenEdit = (promo: Promocion) => {
    setEditingPromo(promo);
    setTitulo(promo.titulo);
    setDescripcion(promo.descripcion);
    setPrecioEspecial(promo.precio_especial.toString());
    setPrecioRegular(promo.precio_regular ? promo.precio_regular.toString() : '');
    setSellosExtra(promo.sellos_extra || 1);
    setImagenUrl(promo.imagen_url || '/src/assets/images/aitama_reward_cup_1794847436322.jpg');
    setShowCreateForm(true);
  };

  const handlePromoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    if (editingPromo) {
      await onUpdatePromo(editingPromo.id, {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || 'Promoción exclusiva.',
        precio_especial: Number(precioEspecial) || 15,
        precio_regular: precioRegular ? Number(precioRegular) : null,
        sellos_extra: sellosExtra,
        imagen_url: imagenUrl.trim(),
      });
    } else {
      await onCreatePromo({
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || 'Promoción exclusiva para miembros del club.',
        precio_especial: Number(precioEspecial) || 15,
        precio_regular: precioRegular ? Number(precioRegular) : null,
        sellos_extra: sellosExtra,
        limite_por_cliente: 2,
        dias_vigencia: diasVigencia,
        audiencia: 'todos',
        canal: canalPromo,
        imagen_url: imagenUrl.trim(),
      });
    }

    setTitulo('');
    setDescripcion('');
    setEditingPromo(null);
    setShowCreateForm(false);
  };

  const handleExecutePromoCampaign = async (promo: Promocion) => {
    await onLaunchCampaign({
      titulo: `¡Oferta imperdible: ${promo.titulo}!`,
      mensaje: `Hola, aprovecha ${promo.titulo} a solo S/ ${promo.precio_especial.toFixed(2)} y suma +${promo.sellos_extra} sellos extra hoy en Olivia Café.`,
      audiencia: 'todos',
      canal: 'push',
    });
  };

  const handleCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingCamp(true);
    try {
      await onLaunchCampaign({
        titulo: campTitulo.trim(),
        mensaje: campMensaje.trim(),
        audiencia: campAudiencia,
        canal: campCanal,
      });
    } finally {
      setSendingCamp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera Promociones */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#14201E]">Promociones y Productos con Sello</h2>
          <p className="text-xs text-[#546560]">
            Crea, edita, pausa, elimina y ejecuta campañas de tus productos promocionales.
          </p>
        </div>

        <button
          type="button"
          onClick={() => (showCreateForm ? setShowCreateForm(false) : handleOpenCreate())}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white min-h-[42px] self-start"
        >
          <Plus className="w-4 h-4 text-[#F2B632]" />
          <span>{showCreateForm ? 'Cerrar formulario' : 'Nueva Promoción / Producto'}</span>
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handlePromoSubmit}
          className="rounded-3xl bg-white p-6 border border-[#0F4C45]/20 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#14201E]">
              {editingPromo ? 'Editar Promoción / Producto' : 'Publicar Nueva Promoción / Producto'}
            </h3>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="w-8 h-8 rounded-full bg-[#F3F6F4] flex items-center justify-center text-[#546560]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#14201E] mb-1">Título del producto / promo</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej. Capuccino + Alfajor Artesanal"
                className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs text-[#14201E] min-h-[42px]"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#14201E] mb-1">Precio Club (S/)</label>
                <input
                  type="number"
                  step="0.1"
                  value={precioEspecial}
                  onChange={(e) => setPrecioEspecial(e.target.value)}
                  className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs tabular-nums min-h-[42px]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#14201E] mb-1">Regular (S/)</label>
                <input
                  type="number"
                  step="0.1"
                  value={precioRegular}
                  onChange={(e) => setPrecioRegular(e.target.value)}
                  className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs tabular-nums min-h-[42px]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#14201E] mb-1">URL de Imagen del Producto</label>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#0F4C45] shrink-0" />
              <input
                type="text"
                value={imagenUrl}
                onChange={(e) => setImagenUrl(e.target.value)}
                placeholder="/src/assets/images/... o https://..."
                className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs min-h-[42px]"
              />
            </div>
            <div className="flex gap-2 mt-1.5">
              {[
                { label: 'Café & Taza', url: '/src/assets/images/aitama_reward_cup_1794847436322.jpg' },
                { label: 'Barra & Barista', url: '/src/assets/images/aitama_cafe_hero_1794847435488.jpg' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setImagenUrl(preset.url)}
                  className="rounded-lg bg-[#F3F6F4] hover:bg-[#E8F1EE] px-2.5 py-1 text-[10px] font-semibold text-[#0F4C45]"
                >
                  Usar foto: {preset.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={2}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción breve de la promoción y horario válido..."
            className="w-full rounded-xl bg-[#F3F6F4] p-3 text-xs text-[#14201E]"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#14201E] mb-1">Sellos extra</label>
              <select
                value={sellosExtra}
                onChange={(e) => setSellosExtra(Number(e.target.value))}
                className="w-full rounded-xl bg-[#F3F6F4] px-3 py-2.5 text-xs min-h-[42px]"
              >
                <option value={1}>+1 sello</option>
                <option value={2}>+2 sellos</option>
                <option value={3}>+3 sellos</option>
              </select>
            </div>
            {!editingPromo && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#14201E] mb-1">Vigencia</label>
                  <select
                    value={diasVigencia}
                    onChange={(e) => setDiasVigencia(Number(e.target.value))}
                    className="w-full rounded-xl bg-[#F3F6F4] px-3 py-2.5 text-xs min-h-[42px]"
                  >
                    <option value={7}>7 días</option>
                    <option value={14}>14 días</option>
                    <option value={30}>30 días</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#14201E] mb-1">Difusión</label>
                  <select
                    value={canalPromo}
                    onChange={(e) => setCanalPromo(e.target.value as CanalMensaje)}
                    className="w-full rounded-xl bg-[#F3F6F4] px-3 py-2.5 text-xs min-h-[42px]"
                  >
                    <option value="push">Solo Push (gratis)</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="ambos">Push + WhatsApp</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-xl bg-[#F3F6F4] px-4 py-3 text-xs font-semibold text-[#546560] min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#0F4C45] px-5 py-3 text-xs font-bold text-white min-h-[44px]"
            >
              {editingPromo ? 'Guardar Cambios' : 'Publicar Promoción'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de Promociones con imágenes y acciones completas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {promociones.map((promo) => (
          <div
            key={promo.id}
            className="rounded-3xl bg-white border border-black/5 overflow-hidden shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="relative h-40 bg-[#0F4C45]">
                {promo.imagen_url ? (
                  <img
                    src={promo.imagen_url}
                    alt={promo.titulo}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#F2B632]">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute top-3 right-3">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold shadow-sm ${
                      promo.activa ? 'bg-[#E8F1EE] text-[#0F4C45]' : 'bg-black/60 text-white/90'
                    }`}
                  >
                    {promo.activa ? 'Activa' : 'Pausada'}
                  </span>
                </div>
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2 text-white">
                  <span className="rounded-lg bg-[#F2B632] text-[#14201E] px-2.5 py-1 text-xs font-bold inline-flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> +{promo.sellos_extra} sellos
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    S/ {promo.precio_especial.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-1.5">
                <h3 className="text-sm font-bold text-[#14201E]">{promo.titulo}</h3>
                <p className="text-xs text-[#546560] line-clamp-2">{promo.descripcion}</p>
                <p className="text-[11px] text-[#6A7B76] tabular-nums pt-1">
                  Canjes realizados: <strong>{promo.stock_usado}</strong>
                </p>
              </div>
            </div>

            {/* Barra de Acciones: Ejecutar, Editar, Pausar/Activar, Eliminar */}
            <div className="p-4 pt-0 grid grid-cols-4 gap-1.5 border-t border-black/5 mt-2 pt-3">
              <button
                type="button"
                onClick={() => void handleExecutePromoCampaign(promo)}
                title="Ejecutar / Difundir campaña"
                className="rounded-xl bg-[#E8F1EE] hover:bg-[#D5E6E0] p-2 text-[#0F4C45] flex flex-col items-center justify-center gap-1 text-[10px] font-bold"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ejecutar</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenEdit(promo)}
                title="Editar promoción"
                className="rounded-xl bg-[#F3F6F4] hover:bg-[#E4EBE7] p-2 text-[#14201E] flex flex-col items-center justify-center gap-1 text-[10px] font-bold"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>

              <button
                type="button"
                onClick={() => void onTogglePromo(promo.id)}
                title={promo.activa ? 'Pausar / Ocultar' : 'Activar'}
                className="rounded-xl bg-[#F3F6F4] hover:bg-[#E4EBE7] p-2 text-[#14201E] flex flex-col items-center justify-center gap-1 text-[10px] font-bold"
              >
                {promo.activa ? <Pause className="w-3.5 h-3.5 text-[#7A5600]" /> : <Play className="w-3.5 h-3.5 text-[#0F4C45]" />}
                <span>{promo.activa ? 'Pausar' : 'Activar'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Eliminar la promoción "${promo.titulo}"?`)) {
                    void onDeletePromo(promo.id);
                  }
                }}
                title="Eliminar"
                className="rounded-xl bg-red-50 hover:bg-red-100 p-2 text-red-700 flex flex-col items-center justify-center gap-1 text-[10px] font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Lanzar Campaña Segmentada */}
      <form
        onSubmit={handleCampaignSubmit}
        className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0F4C45] text-[#F2B632] flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#14201E]">Lanzar Campaña Segmentada General</h3>
              <p className="text-xs text-[#546560]">
                Límite anti-spam WhatsApp: máx. {whatsappLimit} envíos/día · Push ilimitado.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={campTitulo}
            onChange={(e) => setCampTitulo(e.target.value)}
            placeholder="Título de campaña"
            className="rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs min-h-[42px]"
            required
          />
          <select
            value={campAudiencia}
            onChange={(e) => setCampAudiencia(e.target.value as 'todos' | 'inactivos_15' | 'casi_premio')}
            className="rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs min-h-[42px]"
          >
            <option value="casi_premio">A 1-2 sellos del premio</option>
            <option value="inactivos_15">Inactivos (+15 días)</option>
            <option value="todos">Todos los clientes</option>
          </select>
          <select
            value={campCanal}
            onChange={(e) => setCampCanal(e.target.value as CanalMensaje)}
            className="rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs min-h-[42px]"
          >
            <option value="push">Web Push (sin límite)</option>
            <option value="whatsapp">WhatsApp (máx. {whatsappLimit}/día)</option>
            <option value="ambos">Push primero, luego WA</option>
          </select>
        </div>

        <textarea
          rows={2}
          value={campMensaje}
          onChange={(e) => setCampMensaje(e.target.value)}
          className="w-full rounded-xl bg-[#F3F6F4] p-3 text-xs text-[#14201E]"
          required
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[#546560] flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-[#0F4C45]" />
            <span>Campañas enviadas recientemente: {campanas.length}</span>
          </span>
          <button
            type="submit"
            disabled={sendingCamp}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0F4C45] px-5 py-3 text-xs font-bold text-white min-h-[44px]"
          >
            <Send className="w-3.5 h-3.5 text-[#F2B632]" />
            <span>{sendingCamp ? 'Encolando envío...' : 'Enviar Campaña General'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
