import React, { useMemo, useState } from 'react';
import {
  Check,
  Coffee,
  Edit3,
  Pause,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { CartaItem } from '@/src/types/database';

interface CartaSectionProps {
  items: CartaItem[];
  onCreateItem: (input: {
    categoria: string;
    nombre: string;
    descripcion: string;
    precio: number;
    maridaje: string;
    recomendado: boolean;
    imagen_url?: string;
  }) => Promise<void>;
  onUpdateItem: (
    id: string,
    input: {
      categoria: string;
      nombre: string;
      descripcion: string;
      precio: number;
      maridaje: string;
      recomendado: boolean;
      imagen_url?: string;
    }
  ) => Promise<void>;
  onToggleItem: (id: string) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
}

const CATEGORIAS_SUGERIDAS = [
  'Café de Especialidad',
  'Cold Brew & Fríos',
  'Pastelería Artesanal',
  'Combos & Brunch',
  'Métodos Filtrados',
];

export const CartaSection: React.FC<CartaSectionProps> = ({
  items,
  onCreateItem,
  onUpdateItem,
  onToggleItem,
  onDeleteItem,
}) => {
  const [selectedCat, setSelectedCat] = useState<string>('Todas');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [categoria, setCategoria] = useState(CATEGORIAS_SUGERIDAS[0]);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('14.00');
  const [maridaje, setMaridaje] = useState('');
  const [recomendado, setRecomendado] = useState(false);
  const [imagenUrl, setImagenUrl] = useState('/src/assets/images/aitama_reward_cup_1794847436322.jpg');

  const categorias = useMemo(() => {
    const set = new Set(items.map((i) => i.categoria));
    return ['Todas', ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    if (selectedCat === 'Todas') return items;
    return items.filter((i) => i.categoria === selectedCat);
  }, [items, selectedCat]);

  const openCreateModal = () => {
    setEditingId(null);
    setCategoria(CATEGORIAS_SUGERIDAS[0]);
    setNombre('');
    setDescripcion('');
    setPrecio('14.00');
    setMaridaje('');
    setRecomendado(false);
    setImagenUrl('/src/assets/images/aitama_reward_cup_1794847436322.jpg');
    setModalOpen(true);
  };

  const openEditModal = (item: CartaItem) => {
    setEditingId(item.id);
    setCategoria(item.categoria);
    setNombre(item.nombre);
    setDescripcion(item.descripcion || '');
    setPrecio(item.precio.toFixed(2));
    setMaridaje(item.maridaje || '');
    setRecomendado(item.recomendado);
    setImagenUrl(item.imagen_url || '/src/assets/images/aitama_reward_cup_1794847436322.jpg');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const payload = {
        categoria: categoria.trim() || 'Café de Especialidad',
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        precio: Math.max(0.5, Number(precio) || 10),
        maridaje: maridaje.trim(),
        recomendado,
        imagen_url: imagenUrl.trim() || undefined,
      };
      if (editingId) {
        await onUpdateItem(editingId, payload);
      } else {
        await onCreateItem(payload);
      }
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const disponiblesCount = items.filter((i) => i.disponible).length;

  return (
    <div className="space-y-5">
      {/* Cabecera de Carta Digital */}
      <section className="rounded-3xl bg-white p-5 sm:p-6 border border-black/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Coffee className="w-5 h-5 text-[#0F4C45]" />
            <h2 className="text-base font-bold text-[#14201E]">Carta Digital del Cliente</h2>
          </div>
          <p className="text-xs text-[#546560] mt-1">
            {disponiblesCount} de {items.length} productos visibles ahora en la pestaña{' '}
            <strong>Carta</strong> del cliente con pedido rápido por WhatsApp.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white min-h-[42px] whitespace-nowrap"
        >
          <Plus className="w-4 h-4 text-[#F2B632]" />
          <span>Nuevo producto</span>
        </button>
      </section>

      {/* Filtro de categorías */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {categorias.map((cat) => {
          const active = selectedCat === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCat(cat)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition ${
                active
                  ? 'bg-[#0F4C45] text-white'
                  : 'bg-white text-[#4A5A56] border border-black/10 hover:bg-[#F3F6F4]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Grilla de productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <article
            key={item.id}
            className={`rounded-3xl bg-white border p-5 shadow-sm flex flex-col justify-between gap-4 transition ${
              item.disponible ? 'border-black/5' : 'border-black/10 opacity-70'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-lg bg-[#F3F6F4] px-2 py-0.5 text-[10px] font-bold text-[#0F4C45]">
                    {item.categoria}
                  </span>
                  {item.recomendado && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#FEF6E0] px-2 py-0.5 text-[10px] font-bold text-[#7A5600]">
                      <Sparkles className="w-3 h-3" /> Favorito
                    </span>
                  )}
                </div>

                <span className="text-base font-bold tabular-nums text-[#0F4C45] whitespace-nowrap">
                  S/ {item.precio.toFixed(2)}
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#14201E]">{item.nombre}</h3>
                {item.descripcion && (
                  <p className="text-xs text-[#546560] mt-1 leading-relaxed">{item.descripcion}</p>
                )}
              </div>

              {item.maridaje && (
                <div className="rounded-xl bg-[#F7F9F8] px-3 py-2 text-[11px] font-medium text-[#354440] border border-black/5">
                  ☕ {item.maridaje}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-black/5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void onToggleItem(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold ${
                  item.disponible
                    ? 'bg-[#E8F1EE] text-[#0F4C45]'
                    : 'bg-[#F3F6F4] text-[#546560]'
                }`}
              >
                {item.disponible ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{item.disponible ? 'Visible' : 'Agotado'}</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEditModal(item)}
                  aria-label={`Editar ${item.nombre}`}
                  className="w-8 h-8 rounded-xl bg-[#F3F6F4] text-[#14201E] flex items-center justify-center hover:bg-[#E8F1EE]"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteItem(item.id)}
                  aria-label={`Eliminar ${item.nombre}`}
                  className="w-8 h-8 rounded-xl bg-red-50 text-red-700 flex items-center justify-center hover:bg-red-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Modal Crear / Editar producto */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Producto de Carta Digital"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#14201E]">
                {editingId ? 'Editar producto de carta' : 'Agregar producto a la Carta'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F3F6F4] flex items-center justify-center"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#14201E] mb-1">Categoría</label>
                <input
                  type="text"
                  list="carta-categorias-list"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs font-semibold min-h-[42px]"
                  required
                />
                <datalist id="carta-categorias-list">
                  {CATEGORIAS_SUGERIDAS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14201E] mb-1">
                  Precio (S/)
                </label>
                <input
                  type="number"
                  step="0.50"
                  min={0.5}
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-sm font-bold tabular-nums min-h-[42px]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14201E] mb-1">
                Nombre del producto
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Flat White Doble Origen"
                className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs font-semibold min-h-[42px]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14201E] mb-1">
                Descripción corta
              </label>
              <textarea
                rows={2}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Notas de cata, origen del grano o ingredientes clave..."
                className="w-full rounded-xl bg-[#F3F6F4] p-3 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14201E] mb-1">
                Sugerencia de maridaje (opcional, aumenta el ticket promedio)
              </label>
              <input
                type="text"
                value={maridaje}
                onChange={(e) => setMaridaje(e.target.value)}
                placeholder="Ej. Ideal con Croissant de Mantequilla"
                className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs min-h-[42px]"
              />
            </div>

            <label className="flex items-center gap-2.5 rounded-2xl bg-[#FEF6E0] px-3.5 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={recomendado}
                onChange={(e) => setRecomendado(e.target.checked)}
                className="w-4 h-4 accent-[#0F4C45]"
              />
              <span className="text-xs font-bold text-[#7A5600]">
                Destacar como &ldquo;Favorito del Barista&rdquo; en la app cliente
              </span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-[#0F4C45] py-3 text-xs font-bold text-white flex items-center justify-center gap-2 min-h-[46px]"
            >
              <Check className="w-4 h-4 text-[#F2B632]" />
              <span>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Publicar en Carta Digital'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
