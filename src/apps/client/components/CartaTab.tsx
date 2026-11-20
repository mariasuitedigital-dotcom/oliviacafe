import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Coffee,
  Croissant,
  CupSoda,
  ExternalLink,
  Heart,
  Layers,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Utensils,
} from 'lucide-react';
import type { CartaItem } from '@/src/types/database';
import type { HappyHourEvaluation } from '@/src/shared/utils/loyaltyExtras';

interface CartaTabProps {
  items: CartaItem[];
  happyHourStatus: HappyHourEvaluation;
  whatsappNumber: string;
  negocioNombre: string;
}

const FAVS_STORAGE_KEY = 'olivia_carta_favoritos_v1';

const CATEGORY_VISUALS: Record<
  string,
  {
    image: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  'Café de Especialidad': {
    image: '/src/assets/images/olivia_v60_pour_1795156675193.jpg',
    icon: Coffee,
  },
  'Cold Brew & Fríos': {
    image: '/src/assets/images/olivia_cold_brew_1795156673696.jpg',
    icon: CupSoda,
  },
  'Pastelería Artesanal': {
    image: '/src/assets/images/olivia_croissant_pastry_1795156674006.jpg',
    icon: Croissant,
  },
  'Combos & Brunch': {
    image: '/src/assets/images/olivia_brunch_combo_1795156674325.jpg',
    icon: Utensils,
  },
};

function resolveCategoryVisual(categoryName: string, fallbackItemImg?: string | null) {
  const exact = CATEGORY_VISUALS[categoryName];
  if (exact) return exact;

  const lower = categoryName.toLowerCase();
  if (lower.includes('frí') || lower.includes('frio') || lower.includes('cold') || lower.includes('iced')) {
    return {
      image: fallbackItemImg || '/src/assets/images/olivia_cold_brew_1795156673696.jpg',
      icon: CupSoda,
    };
  }
  if (lower.includes('pastel') || lower.includes('postre') || lower.includes('pan') || lower.includes('dulce')) {
    return {
      image: fallbackItemImg || '/src/assets/images/olivia_croissant_pastry_1795156674006.jpg',
      icon: Croissant,
    };
  }
  if (lower.includes('combo') || lower.includes('brunch') || lower.includes('pack')) {
    return {
      image: fallbackItemImg || '/src/assets/images/olivia_brunch_combo_1795156674325.jpg',
      icon: Utensils,
    };
  }

  return {
    image: fallbackItemImg || '/src/assets/images/olivia_v60_pour_1795156675193.jpg',
    icon: Coffee,
  };
}

function resolveItemImage(item: CartaItem): string {
  if (item.imagen_url && !item.imagen_url.includes('aitama_cafe_hero') && !item.imagen_url.includes('aitama_reward_cup')) {
    return item.imagen_url;
  }
  const byId: Record<string, string> = {
    'carta-1': '/src/assets/images/aitama_reward_cup_1794847436322.jpg',
    'carta-2': '/src/assets/images/olivia_v60_pour_1795156675193.jpg',
    'carta-3': '/src/assets/images/olivia_cold_brew_1795156673696.jpg',
    'carta-4': '/src/assets/images/aitama_cafe_hero_1794847435488.jpg',
    'carta-5': '/src/assets/images/olivia_croissant_pastry_1795156674006.jpg',
    'carta-6': '/src/assets/images/olivia_brunch_combo_1795156674325.jpg',
  };
  return byId[item.id] || item.imagen_url || resolveCategoryVisual(item.categoria).image;
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
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(FAVS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      localStorage.setItem(FAVS_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // Ignore storage errors
    }
  }, [favorites]);

  const availableItems = useMemo(
    () => items.filter((item) => item.disponible),
    [items]
  );

  const categoryCards = useMemo(() => {
    const grouped = new Map<string, { count: number; firstImg?: string | null }>();
    availableItems.forEach((item) => {
      const prev = grouped.get(item.categoria);
      if (prev) {
        prev.count += 1;
      } else {
        grouped.set(item.categoria, { count: 1, firstImg: item.imagen_url });
      }
    });

    return Array.from(grouped.entries()).map(([name, info]) => {
      const visual = resolveCategoryVisual(name, info.firstImg);
      return {
        name,
        count: info.count,
        image: visual.image,
        icon: visual.icon,
      };
    });
  }, [availableItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return availableItems.filter((item) => {
      if (selectedCat !== 'Todas' && item.categoria !== selectedCat) return false;
      if (!q) return true;
      return (
        item.nombre.toLowerCase().includes(q) ||
        (item.descripcion || '').toLowerCase().includes(q) ||
        item.categoria.toLowerCase().includes(q)
      );
    });
  }, [availableItems, query, selectedCat]);

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

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
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
    <div className="space-y-6">
      {/* Encabezado + Happy Hour */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#14201E]">Catálogo</h1>
          <p className="text-xs text-[#4A5A56] mt-0.5">
            Elige tu categoría favorita o explora toda la carta para pedir sin cola.
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

      {/* Buscador */}
      <div className="flex items-center rounded-2xl bg-white px-4 border border-black/10 shadow-xs focus-within:ring-2 focus-within:ring-[#0F4C45]">
        <Search className="w-4 h-4 text-[#546560] mr-2.5 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar espresso, V60, cold brew o croissant..."
          className="w-full bg-transparent py-3 text-xs font-medium text-[#14201E] placeholder:text-[#7B8B86] focus:outline-none min-h-[44px]"
        />
      </div>

      {/* Bloque 1: Categorías visuales (estructura 2 columnas con foto full-bleed) */}
      {categoryCards.length > 0 && (
        <section className="space-y-3" aria-label="Categorías del catálogo">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-[#E8F1EE] text-[#0F4C45] flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-extrabold text-[#14201E]">Categorías</h2>
            </div>

            {selectedCat !== 'Todas' && (
              <button
                type="button"
                onClick={() => setSelectedCat('Todas')}
                className="rounded-xl bg-[#E8F1EE] hover:bg-[#DCE7E3] px-3 py-1.5 text-xs font-bold text-[#0F4C45] transition min-h-[34px]"
              >
                Ver todas
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categoryCards.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCat === cat.name;
              const catImgKey = `cat-${cat.name}`;
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setSelectedCat(isActive ? 'Todas' : cat.name)}
                  aria-pressed={isActive}
                  className={`group relative aspect-[4/3] w-full rounded-2xl sm:rounded-3xl overflow-hidden text-left shadow-sm transition-all active:scale-[0.98] ${
                    isActive
                      ? 'ring-2 ring-[#0F4C45] ring-offset-2 ring-offset-[var(--brand-tertiary)]'
                      : 'border border-black/5 hover:shadow-md'
                  }`}
                >
                  {imgErrors[catImgKey] ? (
                    <div className="absolute inset-0 bg-[#0F4C45] flex items-center justify-center">
                      <Icon className="w-10 h-10 text-white/25" />
                    </div>
                  ) : (
                    <img
                      src={cat.image}
                      alt={cat.name}
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setImgErrors((prev) => ({ ...prev, [catImgKey]: true }))
                      }
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}

                  {/* Gradiente oscuro inferior para legibilidad */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

                  {/* Badge icono superior izquierdo */}
                  <span className="absolute top-2.5 left-2.5 inline-flex items-center justify-center w-8 h-7 rounded-xl bg-white/95 backdrop-blur-xs text-[#0F4C45] shadow-sm">
                    <Icon className="w-4 h-4" />
                  </span>

                  {/* Indicador de categoría seleccionada */}
                  {isActive && (
                    <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-xl bg-[#0F4C45] text-[#F2B632] px-2 py-1 text-[10px] font-bold shadow-sm">
                      <Check className="w-3 h-3" />
                      Activo
                    </span>
                  )}

                  {/* Texto inferior */}
                  <div className="absolute inset-x-0 bottom-0 p-3 sm:p-3.5">
                    <p className="text-white font-extrabold text-sm sm:text-base leading-tight drop-shadow-xs line-clamp-1">
                      {cat.name}
                    </p>
                    <p className="text-[11px] font-medium text-white/85 flex items-center gap-1 mt-0.5">
                      <span className="tabular-nums">
                        {cat.count} {cat.count === 1 ? 'producto' : 'productos'}
                      </span>
                      <span>•</span>
                      <span className="font-bold text-[#F2B632]">Ver →</span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Bloque 2: Barra de título de productos + grid 2 columnas */}
      <section className="space-y-3.5" aria-label="Lista de productos">
        <div className="flex items-center justify-between gap-2 pt-1">
          <h2 className="text-sm sm:text-base font-extrabold tracking-wide uppercase text-[#14201E] truncate">
            {selectedCat === 'Todas' ? 'TODOS LOS PRODUCTOS' : selectedCat.toUpperCase()}
          </h2>
          <span className="rounded-xl bg-[#E8F1EE] px-3 py-1 text-xs font-bold text-[#0F4C45] tabular-nums whitespace-nowrap shrink-0">
            {filtered.length} {filtered.length === 1 ? 'producto' : 'productos'}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center border border-black/5 space-y-2">
            <Coffee className="w-8 h-8 text-[#0F4C45] mx-auto" />
            <p className="text-sm font-bold text-[#14201E]">
              No encontramos productos con ese filtro
            </p>
            <p className="text-xs text-[#546560]">
              Prueba seleccionando otra categoría o limpia el buscador.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map((item) => {
              const qty = cart[item.id] || 0;
              const isFav = Boolean(favorites[item.id]);
              const imageUrl = resolveItemImage(item);
              const badgeLabel = item.recomendado
                ? 'Recomendado'
                : item.maridaje
                  ? 'Con maridaje'
                  : null;

              return (
                <article
                  key={item.id}
                  className="rounded-2xl sm:rounded-3xl bg-white border border-black/8 shadow-sm overflow-hidden flex flex-col justify-between transition hover:shadow-md"
                >
                  {/* Fotografía superior edge-to-edge */}
                  <div className="relative aspect-[4/3] w-full bg-[#F3F6F4] overflow-hidden">
                    {imgErrors[item.id] ? (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#E8F1EE] to-[#DCE7E3]">
                        <Coffee className="w-9 h-9 text-[#0F4C45]/50" />
                      </div>
                    ) : (
                      <img
                        src={imageUrl}
                        alt={item.nombre}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setImgErrors((prev) => ({ ...prev, [item.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    )}

                    {/* Etiqueta única superior izquierda */}
                    {badgeLabel && (
                      <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-xl bg-[#14201E]/75 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-1 shadow-xs max-w-[calc(100%-3.5rem)] truncate">
                        <Sparkles className="w-3 h-3 text-[#F2B632] shrink-0" />
                        <span className="truncate">{badgeLabel}</span>
                      </span>
                    )}

                    {/* Botón corazón favorito superior derecho */}
                    <button
                      type="button"
                      onClick={() => toggleFavorite(item.id)}
                      aria-label={
                        isFav
                          ? `Quitar ${item.nombre} de favoritos`
                          : `Guardar ${item.nombre} en favoritos`
                      }
                      aria-pressed={isFav}
                      className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/95 backdrop-blur-xs shadow-sm flex items-center justify-center transition active:scale-90"
                    >
                      <Heart
                        className={`w-4 h-4 transition-colors ${
                          isFav
                            ? 'text-rose-500 fill-rose-500'
                            : 'text-[#546560]'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Contenido inferior: título, 2 líneas de descripción, precio + CTA */}
                  <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
                    <div>
                      <h3
                        title={item.nombre}
                        className="text-xs sm:text-sm font-extrabold text-[#14201E] line-clamp-1"
                      >
                        {item.nombre}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-[#546560] line-clamp-2 leading-snug mt-1">
                        {item.descripcion ||
                          item.maridaje ||
                          'Preparado al momento con café de especialidad.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-1.5 pt-1">
                      <span className="text-sm sm:text-base font-extrabold tabular-nums text-[#0F4C45] whitespace-nowrap">
                        S/ {item.precio.toFixed(2)}
                      </span>

                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => adjustQty(item.id, 1)}
                          className="rounded-xl bg-[#0F4C45] hover:bg-[#0B3A34] text-white px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold inline-flex items-center gap-1 shrink-0 min-h-[34px] transition active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar</span>
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1 rounded-xl bg-[#0F4C45] p-0.5 text-white shrink-0 min-h-[34px]">
                          <button
                            type="button"
                            onClick={() => adjustQty(item.id, -1)}
                            aria-label={`Quitar ${item.nombre}`}
                            className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center hover:bg-white/25"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="min-w-[18px] text-center text-xs font-bold tabular-nums">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => adjustQty(item.id, 1)}
                            aria-label={`Agregar otro ${item.nombre}`}
                            className="w-7 h-7 rounded-lg bg-[#F2B632] text-[#14201E] flex items-center justify-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

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
