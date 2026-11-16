import React from 'react';
import {
  CheckCircle2,
  Clock,
  CloudOff,
  Gift,
  ListChecks,
  RefreshCw,
  Sparkles,
  Tag,
} from 'lucide-react';
import type { PendingPosOp, PosQueueEntry } from '@/src/apps/pos/offline/posOfflineQueue';

interface ColaTabProps {
  isOnline: boolean;
  syncing: boolean;
  pendingOps: PendingPosOp[];
  recentActivity: PosQueueEntry[];
  onSyncNow: () => Promise<void>;
}

function formatHora(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const ColaTab: React.FC<ColaTabProps> = ({
  isOnline,
  syncing,
  pendingOps,
  recentActivity,
  onSyncNow,
}) => {
  return (
    <div className="space-y-5">
      {/* ESTADO DE COLA OFFLINE (INDEXEDDB) */}
      <section className="rounded-3xl bg-white p-5 border border-black/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              pendingOps.length > 0
                ? 'bg-[#FEF6E0] text-[#7A5600]'
                : 'bg-[#E8F1EE] text-[#0F4C45]'
            }`}
          >
            {pendingOps.length > 0 ? (
              <CloudOff className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <div>
            <h1 className="text-base font-bold text-[#14201E]">
              {pendingOps.length > 0
                ? `${pendingOps.length} operaciones pendientes en IndexedDB`
                : 'Cola offline al día'}
            </h1>
            <p className="text-xs text-[#546560] mt-0.5">
              {isOnline
                ? 'Terminal en línea · Las claves de idempotencia evitan sellos duplicados.'
                : 'Sin conexión · Todo sello nuevo queda protegido en IndexedDB hasta reconectar.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={!isOnline || syncing || pendingOps.length === 0}
          onClick={() => void onSyncNow()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-45 whitespace-nowrap min-h-[42px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
        </button>
      </section>

      {/* OPERACIONES PENDIENTES SI EXISTEN */}
      {pendingOps.length > 0 && (
        <section className="rounded-3xl bg-[#FEF6E0] p-5 border border-[#F2B632]/40 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#7A5600]">
            En cola de envío ({pendingOps.length})
          </h2>
          <div className="space-y-2">
            {pendingOps.map((op) => (
              <div
                key={op.idempotencyKey}
                className="rounded-2xl bg-white p-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#14201E] truncate">
                    {op.customerName} · {op.summary}
                  </p>
                  <p className="text-[11px] text-[#546560] tabular-nums">
                    Cel: {op.maskedPhone} · Clave: {op.idempotencyKey.slice(0, 14)}
                  </p>
                  {op.errorText && (
                    <p className="text-[11px] text-red-700 font-semibold mt-0.5">{op.errorText}</p>
                  )}
                </div>
                <span className="rounded-lg bg-[#FEF6E0] text-[#7A5600] px-2.5 py-1 text-[11px] font-bold shrink-0">
                  Pendiente
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* COLA RÁPIDA RECIENTE */}
      <section className="rounded-3xl bg-white p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#14201E] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#0F4C45]" />
            <span>Cola Rápida Reciente</span>
          </h2>
          <span className="text-xs text-[#546560] font-semibold">
            {recentActivity.length} registrados en turno
          </span>
        </div>

        {recentActivity.length === 0 ? (
          <div className="rounded-2xl bg-[#F3F6F4] p-7 text-center">
            <ListChecks className="w-8 h-8 text-[#6A7B76] mx-auto mb-2" />
            <p className="text-sm font-bold text-[#14201E]">Sin movimientos en esta sesión</p>
            <p className="text-xs text-[#546560] mt-1">
              Cada sello, cupón o canje realizado aparecerá aquí al instante.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {recentActivity.map((item) => {
              const initials = item.customerName
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() || '')
                .join('');

              return (
                <div key={item.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#F3F6F4] text-[#0F4C45] flex items-center justify-center text-xs font-bold shrink-0">
                      {initials || 'CL'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#14201E] truncate">
                        {item.customerName}
                      </p>
                      <p className="text-xs text-[#546560] tabular-nums truncate">
                        Cel: {item.maskedPhone} · {item.detailText}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${
                        item.kind === 'canjear_premio'
                          ? 'bg-[#FEF6E0] text-[#7A5600]'
                          : item.kind === 'canjear_cupon'
                          ? 'bg-[#E8F1EE] text-[#0F4C45]'
                          : 'bg-[#E8F1EE] text-[#0F4C45]'
                      }`}
                    >
                      {item.kind === 'canjear_premio' ? (
                        <Gift className="w-3 h-3" />
                      ) : item.kind === 'canjear_cupon' || item.kind === 'aplicar_promo' ? (
                        <Tag className="w-3 h-3" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      <span>{item.badgeText}</span>
                    </span>
                    <p className="text-[11px] text-[#6A7B76] tabular-nums">
                      {formatHora(item.createdAt)}
                      {item.syncState === 'offline_queued' ? ' · Offline' : ''}
                    </p>
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
