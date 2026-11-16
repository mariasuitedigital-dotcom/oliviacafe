import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Clock, Coffee, Sparkles, Tag, X } from 'lucide-react';
import type { Cupon, Promocion } from '@/src/types/database';

interface PromosTabProps {
  promos: Promocion[];
  cupones: Cupon[];
  onActivatePromo: (promoId: string) => Promise<{ cupon?: Cupon; error?: string }>;
}

export const PromosTab: React.FC<PromosTabProps> = ({
  promos,
  cupones,
  onActivatePromo,
}) => {
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [selectedCupon, setSelectedCupon] = useState<{ cupon: Cupon; promoTitle: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleActivate = async (promo: Promocion) => {
    setErrorMsg(null);
    setActivatingId(promo.id);
    try {
      const res = await onActivatePromo(promo.id);
      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.cupon) {
        setSelectedCupon({ cupon: res.cupon, promoTitle: promo.titulo });
      }
    } finally {
      setActivatingId(null);
    }
  };

  const activeCupones = cupones.filter((c) => c.estado === 'activo');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#14201E]">Promociones Exclusivas</h1>
        <p className="text-xs text-[#4A5A56] mt-0.5">
          Activa tu cupón y muéstralo en caja para aplicar el precio especial y sumar sellos extra.
        </p>
      </div>

      {errorMsg && (
        <p role="alert" className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-xs font-medium">
          {errorMsg}
        </p>
      )}

      {/* Cupones activos listos para usar */}
      {activeCupones.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F4C45]">
            Tus Cupones Activos ({activeCupones.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeCupones.map((cupon) => {
              const linkedPromo = promos.find((p) => p.id === cupon.promocion_id);
              return (
                <button
                  key={cupon.id}
                  type="button"
                  onClick={() =>
                    setSelectedCupon({
                      cupon,
                      promoTitle: linkedPromo?.titulo || 'Promoción Olivia Café',
                    })
                  }
                  className="rounded-2xl bg-[#0F4C45] text-white p-4 text-left flex items-center justify-between gap-3 hover:opacity-95 transition"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#F2B632] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Cupón listo para caja
                    </p>
                    <p className="text-sm font-bold truncate mt-0.5">
                      {linkedPromo?.titulo || 'Cupón promocional'}
                    </p>
                    <p className="text-[11px] font-mono text-white/80 mt-1">{cupon.codigo_qr}</p>
                  </div>
                  <span className="rounded-xl bg-white text-[#0F4C45] px-3 py-2 text-xs font-bold whitespace-nowrap shrink-0">
                    Ver QR
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Catálogo de Promociones */}
      {promos.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center border border-black/5">
          <Tag className="w-8 h-8 text-[#6A7B76] mx-auto mb-2" />
          <p className="text-sm font-bold text-[#14201E]">No hay promociones activas hoy</p>
          <p className="text-xs text-[#546560] mt-1">
            Activa tus notificaciones en Perfil para enterarte apenas lancemos nuevas promos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {promos.map((promo) => {
            const usados = cupones.filter((c) => c.promocion_id === promo.id).length;
            const reachedLimit = usados >= promo.limite_por_cliente;
            const daysLeft = Math.max(
              1,
              Math.ceil((new Date(promo.vigencia_fin).getTime() - Date.now()) / 86400000)
            );

            return (
              <article
                key={promo.id}
                className="rounded-3xl bg-white overflow-hidden shadow-sm border border-black/5 flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 bg-[#0F4C45]">
                    {promo.imagen_url ? (
                      <img
                        src={promo.imagen_url}
                        alt={promo.titulo}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#F2B632]">
                        <Coffee className="w-10 h-10" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-2">
                      <span className="rounded-xl bg-[#F2B632] text-[#14201E] px-2.5 py-1 text-xs font-bold inline-flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        Ganarías +{promo.sellos_extra} {promo.sellos_extra === 1 ? 'sello' : 'sellos'}
                      </span>
                      <span className="text-[11px] font-semibold text-white bg-black/50 px-2.5 py-1 rounded-lg inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {daysLeft}d restantes
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="text-base font-bold text-[#14201E]">{promo.titulo}</h3>
                    <p className="text-xs text-[#4A5A56] mt-1.5 leading-relaxed">
                      {promo.descripcion}
                    </p>

                    <div className="mt-4 flex items-baseline gap-2.5">
                      <span className="text-xl font-bold tabular-nums text-[#0F4C45]">
                        S/ {promo.precio_especial.toFixed(2)}
                      </span>
                      {promo.precio_regular && (
                        <span className="text-xs tabular-nums text-[#7B8B86] line-through">
                          S/ {promo.precio_regular.toFixed(2)}
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-[#546560] tabular-nums">
                        Usos: {usados}/{promo.limite_por_cliente}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5">
                  <button
                    type="button"
                    disabled={reachedLimit || activatingId === promo.id}
                    onClick={() => void handleActivate(promo)}
                    className={`w-full rounded-xl py-3 px-4 text-xs font-bold transition min-h-[44px] ${
                      reachedLimit
                        ? 'bg-[#F3F6F4] text-[#6A7B76] cursor-not-allowed'
                        : 'bg-[#0F4C45] text-white hover:opacity-95 active:scale-[0.99]'
                    }`}
                  >
                    {activatingId === promo.id
                      ? 'Generando cupón...'
                      : reachedLimit
                      ? 'Límite alcanzado'
                      : 'Activar promo'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal QR de Cupón Activado */}
      {selectedCupon && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Cupón QR activado"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl text-center space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0F4C45]">Cupón Activado</span>
              <button
                type="button"
                onClick={() => setSelectedCupon(null)}
                className="w-8 h-8 rounded-full bg-[#F3F6F4] flex items-center justify-center"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-base font-bold text-[#14201E]">{selectedCupon.promoTitle}</h3>

            <div className="p-4 rounded-2xl bg-[#F3F6F4] flex flex-col items-center">
              <QRCodeSVG
                value={selectedCupon.cupon.codigo_qr}
                size={180}
                bgColor="#F3F6F4"
                fgColor="#0F4C45"
              />
              <p className="mt-3 font-mono text-sm font-bold text-[#14201E]">
                {selectedCupon.cupon.codigo_qr}
              </p>
            </div>

            <p className="text-xs text-[#546560]">
              Muestra este QR en caja para aplicar tu descuento y acreditar tus sellos extra.
            </p>

            <button
              type="button"
              onClick={() => setSelectedCupon(null)}
              className="w-full rounded-xl bg-[#0F4C45] py-3 text-xs font-bold text-white min-h-[44px]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
