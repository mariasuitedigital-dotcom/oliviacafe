import React, { useState } from 'react';
import { Award, CheckCircle2, Gift, QrCode, ShieldCheck } from 'lucide-react';
import type { PosCustomerView } from '@/src/apps/pos/hooks/usePosWorkspace';
import type { PosQueueEntry } from '@/src/apps/pos/offline/posOfflineQueue';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

interface CanjesTabProps {
  readyRedeemList: PosCustomerView[];
  recentActivity: PosQueueEntry[];
  actionBusy: boolean;
  onOpenScanner: () => void;
  onRedeemReward: (customer: PosCustomerView, verificadoOtp: boolean) => Promise<void>;
}

export const CanjesTab: React.FC<CanjesTabProps> = ({
  readyRedeemList,
  recentActivity,
  actionBusy,
  onOpenScanner,
  onRedeemReward,
}) => {
  const { negocio } = useTheme();
  const [confirmCustomer, setConfirmCustomer] = useState<PosCustomerView | null>(null);
  const completedRedemptions = recentActivity.filter(
    (item) => item.kind === 'canjear_premio' || item.kind === 'canjear_cupon'
  );

  return (
    <div className="space-y-5">
      {/* Cabecera operativa de canjes (sin estadísticas de negocio) */}
      <section className="rounded-3xl bg-white p-5 border border-black/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-[#14201E]">Entrega de Premios y Cupones</h1>
          <p className="text-xs text-[#546560] mt-0.5">
            Premio vigente: <strong className="text-[#0F4C45]">{negocio.nombre_premio}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenScanner}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white whitespace-nowrap min-h-[42px]"
        >
          <QrCode className="w-4 h-4 text-[#F2B632]" />
          <span>Escanear Cupón o QR</span>
        </button>
      </section>

      {/* Clientes con 10/10 sellos listos para canjear */}
      <section className="rounded-3xl bg-white p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#14201E] flex items-center gap-2">
            <Gift className="w-4 h-4 text-[#F2B632]" />
            <span>Cartillas completas listas para canje</span>
          </h2>
          <span className="text-xs font-bold tabular-nums text-[#0F4C45]">
            {readyRedeemList.length} disponibles
          </span>
        </div>

        {readyRedeemList.length === 0 ? (
          <div className="rounded-2xl bg-[#F3F6F4] p-6 text-center text-xs text-[#546560]">
            No hay cartillas con {negocio.sellos_para_premio}/{negocio.sellos_para_premio} sellos pendientes en este momento.
          </div>
        ) : (
          <div className="space-y-3">
            {readyRedeemList.map((customer) => (
              <div
                key={customer.id}
                className="rounded-2xl bg-[#F3F6F4] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#14201E]">{customer.nombre}</p>
                    <span className="rounded-lg bg-[#FEF6E0] text-[#7A5600] px-2 py-0.5 text-[10px] font-bold inline-flex items-center gap-1">
                      <Award className="w-3 h-3" /> {customer.cartilla.nivel}
                    </span>
                  </div>
                  <p className="text-xs text-[#546560] tabular-nums mt-0.5">
                    Cel: +51 {customer.celular_enmascarado} · {customer.cartilla.sellos_actuales}/
                    {customer.cartilla.sellos_objetivo} sellos
                  </p>
                </div>

                {confirmCustomer?.id === customer.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={async () => {
                        await onRedeemReward(customer, negocio.otp_requerido_canje);
                        setConfirmCustomer(null);
                      }}
                      className="rounded-xl bg-[#0F4C45] px-3.5 py-2 text-xs font-bold text-white min-h-[40px]"
                    >
                      Confirmar entrega
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCustomer(null)}
                      className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#14201E] min-h-[40px]"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCustomer(customer)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#F2B632] text-[#14201E] px-4 py-2.5 text-xs font-bold min-h-[42px]"
                  >
                    <Gift className="w-4 h-4" />
                    <span>Entregar premio</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Historial de canjes del turno */}
      <section className="rounded-3xl bg-white p-5 border border-black/5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#0F4C45]" />
          <h2 className="text-sm font-bold text-[#14201E]">Canjes validados en este turno</h2>
        </div>

        {completedRedemptions.length === 0 ? (
          <p className="text-xs text-[#546560]">Aún no se han entregado premios o cupones en este turno.</p>
        ) : (
          <div className="divide-y divide-black/5">
            {completedRedemptions.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#0F4C45] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[#14201E]">{item.customerName}</p>
                    <p className="text-[11px] text-[#546560]">
                      {item.maskedPhone} · {item.detailText}
                    </p>
                  </div>
                </div>
                <span className="rounded-lg bg-[#FEF6E0] text-[#7A5600] px-2.5 py-0.5 text-[11px] font-bold">
                  {item.badgeText}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
