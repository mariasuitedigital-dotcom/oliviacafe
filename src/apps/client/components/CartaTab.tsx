import React, { useMemo, useState } from 'react';
import {
  Clock,
  Coffee,
  ExternalLink,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import type { CartaItem } from '@/src/types/database';
import type { HappyHourEvaluation } from '@/src/shared/utils/loyaltyExtras';

interface CartaTabProps {
  items: CartaItem[];
  happyHourStatus: HappyHourEvaluation;
  whatsappNumber: string;
  negocioNombre: string;
}

export const CartaTab: React.FC<CartaTabProps> = ({
  items,
  happyHourStatus,
  whatsappNumber,
  negocioNombre,
}) => {
  const [selectedCat, setSelectedCat] = useState<string>('Todas');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});

  const categorias = useMemo(() => {
    const set = new Set(items.map((i) => i.categoria));
    return ['Todas', ...Array.from(set)];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (!item.disponible) return false;
      if (selectedCat !== 'Todas' && item.categoria !== selectedCat) return false;
      if (!q) return true;
      return (
        item.nombre.toLowerCase().includes(q) ||
        (item.descripcion || '').toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q)
      );
    });
  }, [items, query, selectedCat]);

  const adjustQty = (id: string, delta: number) => {
    setCart((prev) => {
      const nextQty = (prev[id] || 0) + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: nextQty };
    });
  };

  const cartSummary = useMemo(() => {
    let totalItems = 0;
    let totalPen = 0;
    const lines: string[] = [];

    items.forEach((item) => {
      const qty = cart[item.id] || 0;
      if (qty > 0) {
        totalItems += qty;
        totalPen += qty * item.precio;
        lines.push(`${qty}x ${item.nombre} (S/ ${(qty * item.precio).toFixed(2)})`);
      }
    });

    return { totalItems, totalPen, lines };
  }, [cart, items]);

  const cleanWaDigits = whatsappNumber.replace(/\D/g, '') || '51987111222';
  const waText = encodeURIComponent(
    `Hola ${negocioNombre} ☕ Quisiera hacer un pedido para recoger:\n\n${cartSummary.lines.join(
      '\n'
    )}\n\nTotal estimado: S/ ${cartSummary.totalPen.toFixed(2)}\n(Sumo sello en mi cartilla al recoger)`
  );
  const waUrl = `https://wa.me/${cleanWaDigits}?text=${waText}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#14201E]">Carta Digital</h1>
          <p className="text-xs text-[#4A5A56] mt-0.5">
            Explora nuestras bebidas y pastelería artesanal, o arma tu pedido para recoger sin cola.
          </p>
        </div>

        {happyHourStatus.enabled && (
          <div
            className={`inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold self-start ${
              happyHourStatus.isActiveNow
                ? 'bg-[#0F4C45] text-[#F2B632]'
                : 'bg-[#FEF6E0] text-[#7A5600]'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              {happyHourStatus.isActiveNow
                ? `${happyHourStatus.label} ACTIVA (${happyHourStatus.multiplier}x)`
                : `${happyHourStatus.label}: ${happyHourStatus.scheduleSummary}`}
            </span>
          </div>
        )}
      </div>

      {/* Buscador y categorías */}
      <div className="space-y-3">
        <div className="flex items-center rounded-2xl bg-white px-4 border border-black/10 focus-within:ring-2 focus-within:ring-[#0F4C45]">
          <Search className="w-4 h-4 text-[#546560] mr-2.5 shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar espresso, V60, cold brew o croissant..."
            className="w-full bg-transparent py-3 text-xs font-medium text-[#14201E] placeholder:text-[#7B8B86] focus:outline-none min-h-[44px]"
          />
        </div>

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
      </div>

      {/* Productos */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center border border-black/5 space-y-2">
          <Coffee className="w-8 h-8 text-[#0F4C45] mx-auto" />
          <p className="text-sm font-bold text-[#14201E]">No encontramos productos con ese filtro</p>
          <p className="text-xs text-[#546560]">Prueba otra categoría o limpia la búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const qty = cart[item.id] || 0;
            return (
              <article
                key={item.id}
                className="rounded-3xl bg-white border border-black/5 p-5 shadow-sm flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
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
                    <h2 className="text-base font-bold text-[#14201E]">{item.nombre}</h2>
                    {item.descripcion && (
                      <p className="text-xs text-[#546560] mt-1 leading-relaxed">
                        {item.descripcion}
                      </p>
                    )}
                  </div>

                  {item.maridaje && (
                    <p className="rounded-xl bg-[#F7F9F8] px-3 py-2 text-[11px] font-medium text-[#354440]">
                      ☕ {item.maridaje}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-black/5 flex items-center justify-between gap-2">
                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => adjustQty(item.id, 1)}
                      className="w-full rounded-xl bg-[#E8F1EE] hover:bg-[#DCE7E3] py-2.5 px-3 text-xs font-bold text-[#0F4C45] inline-flex items-center justify-center gap-1.5 min-h-[40px] transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar al pedido</span>
                    </button>
                  ) : (
                    <div className="w-full flex items-center justify-between gap-2 rounded-xl bg-[#0F4C45] p-1 text-white">
                      <button
                        type="button"
                        onClick={() => adjustQty(item.id, -1)}
                        aria-label={`Quitar ${item.nombre}`}
                        className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center hover:bg-white/25"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-bold tabular-nums">
                        {qty} en pedido · S/ {(qty * item.precio).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => adjustQty(item.id, 1)}
                        aria-label={`Agregar otro ${item.nombre}`}
                        className="w-9 h-9 rounded-lg bg-[#F2B632] text-[#14201E] flex items-center justify-center"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Barra resumen para pedido rápido por WhatsApp Pick-up */}
      {cartSummary.totalItems > 0 && (
        <section className="sticky bottom-20 z-30 rounded-3xl bg-[#14201E] text-white p-4 sm:p-5 shadow-xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F2B632] text-[#14201E] flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#F2B632]">
                Tu pedido ({cartSummary.totalItems}{' '}
                {cartSummary.totalItems === 1 ? 'producto' : 'productos'})
              </p>
              <p className="text-base font-bold tabular-nums">
                Total estimado: S/ {cartSummary.totalPen.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCart({})}
              className="rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/20 min-h-[42px]"
            >
              Limpiar
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-[#F2B632] px-4 py-2.5 text-xs font-bold text-[#14201E] min-h-[42px] whitespace-nowrap"
            >
              <span>Pedir por WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>
      )}
    </div>
  );
};
