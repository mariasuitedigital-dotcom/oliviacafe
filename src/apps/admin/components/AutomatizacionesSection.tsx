import React, { useState } from 'react';
import { Bot, Check, Eye, MessageSquare, Power, Save, Sparkles } from 'lucide-react';
import type { AdminAutomatizacion } from '@/src/apps/admin/hooks/useAdminData';
import type { CanalMensaje } from '@/src/types/database';
import { renderAutomationTemplate } from '@/src/shared/automations/messageTemplates';

interface AutomatizacionesSectionProps {
  automatizaciones: AdminAutomatizacion[];
  onUpdate: (
    id: string,
    updates: Partial<Pick<AdminAutomatizacion, 'activo' | 'canal' | 'plantilla'>>
  ) => Promise<void>;
}

const TEMPLATE_VARIABLES = ['{nombre}', '{sellos}', '{falta}', '{premio}', '{url}'];

export const AutomatizacionesSection: React.FC<AutomatizacionesSectionProps> = ({
  automatizaciones,
  onUpdate,
}) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [channelDrafts, setChannelDrafts] = useState<Record<string, CanalMensaje>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const getPlantilla = (auto: AdminAutomatizacion) => drafts[auto.id] ?? auto.plantilla;
  const getCanal = (auto: AdminAutomatizacion) => channelDrafts[auto.id] ?? auto.canal;

  const insertVariable = (auto: AdminAutomatizacion, variable: string) => {
    const current = getPlantilla(auto);
    const spacer = current.endsWith(' ') || current.length === 0 ? '' : ' ';
    setDrafts((prev) => ({ ...prev, [auto.id]: `${current}${spacer}${variable}` }));
  };

  const handleSave = async (auto: AdminAutomatizacion) => {
    setSavingId(auto.id);
    try {
      await onUpdate(auto.id, {
        canal: getCanal(auto),
        plantilla: getPlantilla(auto),
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleActivo = async (auto: AdminAutomatizacion) => {
    setSavingId(auto.id);
    try {
      await onUpdate(auto.id, { activo: !auto.activo });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-white p-5 sm:p-6 border border-black/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E8F1EE] text-[#0F4C45] flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#14201E]">Journeys Automáticos (6 flujos)</h2>
            <p className="text-xs text-[#546560] mt-0.5">
              Personaliza el canal (Push gratis o WhatsApp) y las variables dinámicas sincronizadas con el Outbox y n8n.
            </p>
          </div>
        </div>
        <div className="rounded-xl bg-[#FEF6E0] px-3.5 py-2 text-xs font-bold text-[#7A5600] whitespace-nowrap self-start sm:self-center">
          {automatizaciones.filter((a) => a.activo).length} de {automatizaciones.length} activos
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {automatizaciones.map((auto) => {
          const currentTemplate = getPlantilla(auto);
          const currentChannel = getCanal(auto);
          const isDirty =
            currentTemplate !== auto.plantilla || currentChannel !== auto.canal;
          const previewText = renderAutomationTemplate(currentTemplate, {
            nombre: 'María',
            sellos: 9,
            falta: 1,
            premio: 'Café de Especialidad gratis',
            url: 'https://oliviacafe.pe/c/olivia',
          });

          return (
            <article
              key={auto.id}
              className={`rounded-3xl bg-white p-5 border shadow-sm space-y-4 transition ${
                auto.activo ? 'border-black/5' : 'border-black/5 opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#F3F6F4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#546560]">
                      {auto.tipo}
                    </span>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                        auto.activo
                          ? 'bg-[#E8F1EE] text-[#0F4C45]'
                          : 'bg-neutral-100 text-[#6A7B76]'
                      }`}
                    >
                      {auto.activo ? 'Activo' : 'Pausado'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#14201E] mt-2">{auto.nombre_visible}</h3>
                </div>

                <button
                  type="button"
                  disabled={savingId === auto.id}
                  onClick={() => void handleToggleActivo(auto)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold min-h-[38px] transition ${
                    auto.activo
                      ? 'bg-[#E8F1EE] text-[#0F4C45] hover:bg-[#D7E6E1]'
                      : 'bg-[#F3F6F4] text-[#546560] hover:bg-[#E4EBE7]'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{auto.activo ? 'Pausar' : 'Activar'}</span>
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#546560] mb-1.5">
                  Canal de envío
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'push', label: 'Web Push' },
                      { id: 'whatsapp', label: 'WhatsApp' },
                      { id: 'ambos', label: 'Push + WA' },
                    ] as const
                  ).map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() =>
                        setChannelDrafts((prev) => ({ ...prev, [auto.id]: ch.id }))
                      }
                      className={`rounded-xl py-2 px-2.5 text-xs font-bold transition min-h-[38px] ${
                        currentChannel === ch.id
                          ? 'bg-[#0F4C45] text-white'
                          : 'bg-[#F3F6F4] text-[#354440] hover:bg-[#E8F1EE]'
                      }`}
                    >
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#546560]">
                    Plantilla de mensaje
                  </label>
                  <span className="text-[11px] text-[#6A7B76] flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {currentTemplate.length} caracteres
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={currentTemplate}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [auto.id]: e.target.value }))
                  }
                  className="w-full rounded-2xl bg-[#F3F6F4] p-3 text-xs text-[#14201E] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-semibold text-[#6A7B76] mr-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#D99B16]" /> Variables:
                  </span>
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(auto, v)}
                      className="rounded-lg bg-[#FEF6E0] hover:bg-[#FDECB8] px-2 py-1 text-[11px] font-mono font-bold text-[#7A5600] transition"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-[#F7F9F8] border border-black/5 p-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#546560] flex items-center gap-1">
                  <Eye className="w-3 h-3 text-[#0F4C45]" />
                  <span>Vista previa con datos reales (María · 9 sellos)</span>
                </p>
                <p className="text-xs text-[#14201E] leading-relaxed">{previewText}</p>
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-black/5">
                <button
                  type="button"
                  disabled={savingId === auto.id || !isDirty}
                  onClick={() => void handleSave(auto)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold min-h-[40px] transition ${
                    isDirty
                      ? 'bg-[#0F4C45] text-white hover:opacity-95'
                      : 'bg-[#F3F6F4] text-[#6A7B76] cursor-default'
                  }`}
                >
                  {savingId === auto.id ? (
                    <span>Guardando...</span>
                  ) : isDirty ? (
                    <>
                      <Save className="w-3.5 h-3.5 text-[#F2B632]" />
                      <span>Guardar plantilla</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Sincronizado</span>
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
