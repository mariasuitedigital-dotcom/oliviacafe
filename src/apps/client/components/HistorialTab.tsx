import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, Coffee, Gift, History, Sparkles, Smartphone } from 'lucide-react';
import type { Canje, Cartilla, Cliente, Sello, TipoSello } from '@/src/types/database';

interface HistorialTabProps {
  cliente: Cliente;
  cartilla: Cartilla;
  sellos: Sello[];
  canjes: Canje[];
}

type FiltroHistorial = 'todos' | 'sellos' | 'canjes';

type TimelineItem =
  | {
      kind: 'sello';
      id: string;
      createdAt: string;
      cantidad: number;
      tipo: TipoSello;
      detalle: string;
    }
  | {
      kind: 'canje';
      id: string;
      createdAt: string;
      premio: string;
      sellosConsumidos: number;
      verificadoOtp: boolean;
    };

function formatFechaPe(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getSelloLabel(tipo: TipoSello): string {
  switch (tipo) {
    case 'bienvenida':
      return 'Bienvenida';
    case 'instalacion_pwa':
      return 'App + Alertas';
    case 'promo':
      return 'Promoción';
    case 'referido':
      return 'Referido';
    case 'manual':
      return 'Ajuste';
    default:
      return 'Visita';
  }
}

export const HistorialTab: React.FC<HistorialTabProps> = ({
  cliente,
  cartilla,
  sellos,
  canjes,
}) => {
  const [filtro, setFiltro] = useState<FiltroHistorial>('todos');

  const items = useMemo<TimelineItem[]>(() => {
    const mappedSellos: TimelineItem[] = sellos.map((s) => ({
      kind: 'sello',
      id: `s-${s.id}`,
      createdAt: s.created_at,
      cantidad: s.cantidad,
      tipo: s.tipo,
      detalle: s.detalle,
    }));

    const mappedCanjes: TimelineItem[] = canjes.map((c) => ({
      kind: 'canje',
      id: `c-${c.id}`,
      createdAt: c.created_at,
      premio: c.premio_entregado,
      sellosConsumidos: c.sellos_consumidos,
      verificadoOtp: c.verificado_otp,
    }));

    const merged = [...mappedSellos, ...mappedCanjes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (filtro === 'sellos') return merged.filter((m) => m.kind === 'sello');
    if (filtro === 'canjes') return merged.filter((m) => m.kind === 'canje');
    return merged;
  }, [canjes, filtro, sellos]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#14201E]">Historial de Movimientos</h1>
          <p className="text-xs text-[#4A5A56] mt-0.5">
            Todos tus sellos acumulados y premios canjeados en tu cartilla.
          </p>
        </div>

        {/* Selector de filtro */}
        <div className="inline-flex rounded-xl bg-white p-1 border border-black/10 self-start">
          {(
            [
              { id: 'todos', label: 'Todos' },
              { id: 'sellos', label: `Sellos (${sellos.length})` },
              { id: 'canjes', label: `Canjes (${canjes.length})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltro(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filtro === tab.id
                  ? 'bg-[#0F4C45] text-white'
                  : 'text-[#4A5A56] hover:text-[#14201E]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen numérico */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white p-4 border border-black/5 shadow-sm">
          <p className="text-[11px] font-semibold text-[#546560]">Sellos totales</p>
          <p className="text-xl font-bold tabular-nums text-[#0F4C45] mt-1">
            {cartilla.sellos_historicos}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-black/5 shadow-sm">
          <p className="text-[11px] font-semibold text-[#546560]">Premios canjeados</p>
          <p className="text-xl font-bold tabular-nums text-[#14201E] mt-1">
            {cartilla.canjes_historicos}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-black/5 shadow-sm">
          <p className="text-[11px] font-semibold text-[#546560]">Visitas</p>
          <p className="text-xl font-bold tabular-nums text-[#14201E] mt-1">
            {cliente.total_visitas}
          </p>
        </div>
      </div>

      {/* Lista de movimientos */}
      {items.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center border border-black/5">
          <History className="w-8 h-8 text-[#6A7B76] mx-auto mb-2" />
          <p className="text-sm font-bold text-[#14201E]">
            {filtro === 'canjes'
              ? 'Aún no has canjeado premios'
              : 'Todavía no hay movimientos registrados'}
          </p>
          <p className="text-xs text-[#546560] mt-1">
            {filtro === 'canjes'
              ? `Completa ${cartilla.sellos_objetivo} sellos para reclamar tu primer premio gratis.`
              : 'Muestra tu QR en caja en tu próxima visita para sumar sellos.'}
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-white border border-black/5 shadow-sm divide-y divide-black/5 overflow-hidden">
          {items.map((item) => {
            if (item.kind === 'canje') {
              return (
                <div key={item.id} className="p-4 sm:px-5 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FEF6E0] text-[#7A5600] flex items-center justify-center shrink-0">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#14201E] truncate">
                        Canje · {item.premio}
                      </p>
                      <span className="rounded-lg bg-[#FEF6E0] text-[#7A5600] px-2 py-0.5 text-[10px] font-bold shrink-0">
                        -{item.sellosConsumidos} sellos
                      </span>
                    </div>
                    <p className="text-xs text-[#546560] mt-0.5">
                      {item.verificadoOtp ? 'Validado con código SMS' : 'Validado en caja'}
                    </p>
                  </div>
                  <span className="text-[11px] text-[#6A7B76] tabular-nums whitespace-nowrap shrink-0">
                    {formatFechaPe(item.createdAt)}
                  </span>
                </div>
              );
            }

            const SelloIcon =
              item.tipo === 'instalacion_pwa'
                ? Smartphone
                : item.tipo === 'promo'
                ? Sparkles
                : item.tipo === 'bienvenida'
                ? Award
                : item.tipo === 'visita'
                ? CheckCircle2
                : Coffee;

            return (
              <div key={item.id} className="p-4 sm:px-5 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#0F4C45] text-[#F2B632] flex items-center justify-center shrink-0">
                  <SelloIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-[#14201E]">
                      +{item.cantidad} {item.cantidad === 1 ? 'Sello' : 'Sellos'}
                    </p>
                    <span className="rounded-lg bg-[#E8F1EE] text-[#0F4C45] px-2 py-0.5 text-[10px] font-bold">
                      {getSelloLabel(item.tipo)}
                    </span>
                  </div>
                  <p className="text-xs text-[#546560] mt-0.5 truncate">{item.detalle}</p>
                </div>
                <span className="text-[11px] text-[#6A7B76] tabular-nums whitespace-nowrap shrink-0">
                  {formatFechaPe(item.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
