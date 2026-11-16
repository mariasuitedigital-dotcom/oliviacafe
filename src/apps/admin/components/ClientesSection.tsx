import React, { useMemo, useState } from 'react';
import { Award, Download, MessageCircle, Search, Users } from 'lucide-react';
import type { AdminClienteRow } from '@/src/apps/admin/hooks/useAdminData';

interface ClientesSectionProps {
  clientes: AdminClienteRow[];
  onExportCsv: () => void;
}

type SegmentFilter = 'todos' | 'listos' | 'inactivos' | 'cumple' | 'baja';

export const ClientesSection: React.FC<ClientesSectionProps> = ({ clientes, onExportCsv }) => {
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<SegmentFilter>('todos');
  const currentMonth = new Date().getMonth() + 1;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clientes.filter((c) => {
      if (q && !c.nombre.toLowerCase().includes(q) && !c.celular.includes(q)) {
        return false;
      }
      if (segment === 'listos') return c.sellos_actuales >= c.sellos_objetivo;
      if (segment === 'inactivos') {
        const days = (Date.now() - new Date(c.ultima_visita_at).getTime()) / 86400000;
        return days >= 15;
      }
      if (segment === 'cumple') return c.fecha_nacimiento_mes === currentMonth;
      if (segment === 'baja') return c.baja_whatsapp;
      return true;
    });
  }, [clientes, currentMonth, search, segment]);

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-white p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#14201E]">Base de Clientes ({clientes.length})</h2>
            <p className="text-xs text-[#546560]">
              Vista completa exclusiva del dueño con estado de consentimientos y nivel.
            </p>
          </div>
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white whitespace-nowrap min-h-[40px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV completo</span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 flex items-center rounded-xl bg-[#F3F6F4] px-3.5">
            <Search className="w-4 h-4 text-[#546560] mr-2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o +51..."
              className="w-full bg-transparent py-2.5 text-xs text-[#14201E] focus:outline-none min-h-[40px]"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'listos', label: 'Listos canje' },
                { id: 'inactivos', label: 'Inactivos +15d' },
                { id: 'cumple', label: 'Cumple este mes' },
                { id: 'baja', label: 'Baja WA' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSegment(f.id)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  segment === f.id
                    ? 'bg-[#0F4C45] text-white'
                    : 'bg-[#F3F6F4] text-[#4A5A56] hover:bg-[#E8F1EE]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center border border-black/5">
          <Users className="w-8 h-8 text-[#6A7B76] mx-auto mb-2" />
          <p className="text-sm font-bold text-[#14201E]">Sin resultados para este filtro</p>
        </div>
      ) : (
        <div className="rounded-3xl bg-white border border-black/5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-black/5 bg-[#F7F9F8] text-[11px] font-bold uppercase tracking-wider text-[#546560]">
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Celular</th>
                  <th className="py-3 px-4">Sellos</th>
                  <th className="py-3 px-4">Nivel</th>
                  <th className="py-3 px-4">Canales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 text-xs">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F7F9F8]">
                    <td className="py-3.5 px-4 font-bold text-[#14201E]">
                      <div>{c.nombre}</div>
                      <div className="text-[11px] font-normal text-[#546560]">
                        {c.total_visitas} visitas · {c.canjes_historicos} canjes
                      </div>
                    </td>
                    <td className="py-3.5 px-4 tabular-nums text-[#354440]">{c.celular}</td>
                    <td className="py-3.5 px-4 tabular-nums font-bold text-[#0F4C45]">
                      {c.sellos_actuales}/{c.sellos_objetivo}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-[#FEF6E0] text-[#7A5600] px-2 py-0.5 text-[11px] font-bold">
                        <Award className="w-3 h-3" /> {c.nivel}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {c.baja_whatsapp ? (
                          <span className="rounded-md bg-red-50 text-red-700 px-2 py-0.5 text-[10px] font-bold">
                            Baja WA
                          </span>
                        ) : c.consentimiento_whatsapp ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#E8F1EE] text-[#0F4C45] px-2 py-0.5 text-[10px] font-bold">
                            <MessageCircle className="w-2.5 h-2.5" /> WA
                          </span>
                        ) : null}
                        {c.consentimiento_push && (
                          <span className="rounded-md bg-[#F3F6F4] text-[#14201E] px-2 py-0.5 text-[10px] font-bold">
                            Push
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
