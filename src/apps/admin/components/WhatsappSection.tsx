import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  MessageSquare,
  QrCode,
  RefreshCw,
  Save,
  ShieldAlert,
  WifiOff,
  Workflow,
} from 'lucide-react';
import type { Negocio } from '@/src/types/database';
import { ANTI_SPAM_RULES } from '@/src/shared/automations/messageTemplates';

interface WhatsappSectionProps {
  negocio: Negocio;
  evolutionStatus: 'conectado' | 'qr_pendiente' | 'desconectado';
  bajaCount: number;
  onToggleStatus: (status: 'conectado' | 'qr_pendiente' | 'desconectado') => Promise<void>;
  onSaveLimits: (updates: {
    whatsapp_limite_diario: number;
    horario_envio_inicio: string;
    horario_envio_fin: string;
  }) => Promise<void>;
}

export const WhatsappSection: React.FC<WhatsappSectionProps> = ({
  negocio,
  evolutionStatus,
  bajaCount,
  onToggleStatus,
  onSaveLimits,
}) => {
  const [limiteDiario, setLimiteDiario] = useState(negocio.whatsapp_limite_diario);
  const [horarioInicio, setHorarioInicio] = useState(negocio.horario_envio_inicio);
  const [horarioFin, setHorarioFin] = useState(negocio.horario_envio_fin);
  const [qrNonce, setQrNonce] = useState(() => Date.now());
  const [savingLimits, setSavingLimits] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const instanceName = negocio.evolution_instance_name || 'olivia-lima-wa';
  const qrValue = `evolution://pair?instance=${encodeURIComponent(instanceName)}&token=${qrNonce}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://oliviacafe.pe';

  const copyEndpoint = async (path: string) => {
    try {
      await navigator.clipboard.writeText(`${origin}${path}`);
      setCopiedPath(path);
      window.setTimeout(() => setCopiedPath(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLimits(true);
    try {
      await onSaveLimits({
        whatsapp_limite_diario: Math.max(10, Math.min(500, Number(limiteDiario) || 120)),
        horario_envio_inicio: horarioInicio,
        horario_envio_fin: horarioFin,
      });
    } finally {
      setSavingLimits(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Estado de conexión Evolution API */}
        <section className="lg:col-span-7 rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#E8F1EE] text-[#0F4C45] flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#546560]">
                  Instancia Evolution API
                </p>
                <h2 className="text-base font-bold text-[#14201E] font-mono">{instanceName}</h2>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold self-start sm:self-center ${
                evolutionStatus === 'conectado'
                  ? 'bg-[#E8F1EE] text-[#0F4C45]'
                  : evolutionStatus === 'qr_pendiente'
                  ? 'bg-[#FEF6E0] text-[#7A5600]'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {evolutionStatus === 'conectado' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Conectado y enviando</span>
                </>
              ) : evolutionStatus === 'qr_pendiente' ? (
                <>
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Esperando lectura QR</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Desconectado</span>
                </>
              )}
            </span>
          </div>

          {evolutionStatus === 'conectado' ? (
            <div className="rounded-2xl bg-[#F3F6F4] p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#546560]">Número vinculado</span>
                <span className="font-bold tabular-nums text-[#14201E]">
                  {negocio.whatsapp_contacto_numero || '+51987111222'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#546560]">Webhook de bajas automáticas</span>
                <span className="font-bold text-[#0F4C45]">Activo (BAJA / STOP)</span>
              </div>
              <div className="pt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setQrNonce(Date.now());
                    void onToggleStatus('qr_pendiente');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-black/10 px-3.5 py-2 text-xs font-bold text-[#14201E] hover:bg-[#E8F1EE]"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#0F4C45]" />
                  <span>Re-vincular por QR</span>
                </button>
                <button
                  type="button"
                  onClick={() => void onToggleStatus('desconectado')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Desconectar sesión</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#F7F9F8] border border-black/5 p-5 flex flex-col sm:flex-row items-center gap-5">
              <div className="p-3 rounded-2xl bg-white border border-black/10 shrink-0">
                <QRCodeSVG value={qrValue} size={148} level="M" includeMargin={false} />
              </div>
              <div className="space-y-3 text-center sm:text-left">
                <h3 className="text-sm font-bold text-[#14201E]">
                  Escanea desde WhatsApp Business
                </h3>
                <ol className="text-xs text-[#4A5A56] space-y-1 list-decimal list-inside">
                  <li>Abre WhatsApp Business en el celular del local.</li>
                  <li>Entra a <strong>Dispositivos vinculados → Vincular dispositivo</strong>.</li>
                  <li>Apunta la cámara al QR para activar los envíos.</li>
                </ol>
                <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void onToggleStatus('conectado')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#F2B632]" />
                    <span>Confirmar vinculación</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrNonce(Date.now())}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-black/10 px-3.5 py-2.5 text-xs font-bold text-[#14201E]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refrescar QR</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Límites anti-spam y bajas */}
        <section className="lg:col-span-5 space-y-4">
          <form
            onSubmit={handleSaveLimits}
            className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-[#0F4C45]" />
              <div>
                <h3 className="text-sm font-bold text-[#14201E]">Protección Anti-Spam</h3>
                <p className="text-xs text-[#546560]">
                  Espera aleatoria {ANTI_SPAM_RULES.minDelaySeconds}–{ANTI_SPAM_RULES.maxDelaySeconds}s y zona {ANTI_SPAM_RULES.timezone}.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14201E] mb-1">
                Límite diario de mensajes WhatsApp
              </label>
              <input
                type="number"
                min={10}
                max={500}
                value={limiteDiario}
                onChange={(e) => setLimiteDiario(Number(e.target.value))}
                className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-sm font-bold tabular-nums text-[#14201E] min-h-[42px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#14201E] mb-1">
                  Horario inicio
                </label>
                <input
                  type="time"
                  value={horarioInicio}
                  onChange={(e) => setHorarioInicio(e.target.value)}
                  className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs font-bold tabular-nums min-h-[42px]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#14201E] mb-1">
                  Horario fin
                </label>
                <input
                  type="time"
                  value={horarioFin}
                  onChange={(e) => setHorarioFin(e.target.value)}
                  className="w-full rounded-xl bg-[#F3F6F4] px-3.5 py-2.5 text-xs font-bold tabular-nums min-h-[42px]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingLimits}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F4C45] py-3 text-xs font-bold text-white min-h-[44px]"
            >
              <Save className="w-3.5 h-3.5 text-[#F2B632]" />
              <span>{savingLimits ? 'Guardando...' : 'Guardar reglas de envío'}</span>
            </button>
          </form>

          <div className="rounded-3xl bg-white p-5 border border-black/5 shadow-sm flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 flex items-center justify-center shrink-0">
              <Ban className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#14201E]">
                Opt-out automático: {bajaCount} cliente(s) con Baja WA
              </p>
              <p className="text-xs text-[#546560] mt-1 leading-relaxed">
                Cuando un cliente responde <strong>BAJA</strong>, <strong>STOP</strong> o{' '}
                <strong>NO MÁS</strong>, el webhook marca <code className="font-mono">baja_whatsapp = true</code> al instante y excluye su número de futuras campañas.
              </p>
              <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#7A5600]">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Prioridad automática: Web Push gratis antes que WhatsApp</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Webhooks Outbox & Flujos n8n */}
      <section className="rounded-3xl bg-white p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#E8F1EE] text-[#0F4C45] flex items-center justify-center shrink-0">
            <Workflow className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#14201E]">
              Webhooks Outbox & Flujos n8n Importables
            </h3>
            <p className="text-xs text-[#546560]">
              Conecta tu instancia de Evolution API y tus 3 flujos JSON listos en <code className="font-mono">/n8n/</code>.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              label: 'Webhook Outbox Cron (Vercel)',
              path: '/api/webhooks/outbox',
              hint: 'Header: Authorization: Bearer $CRON_SECRET',
            },
            {
              label: 'Webhook Entrante Evolution API',
              path: '/api/webhooks/evolution-inbound',
              hint: 'Eventos: MESSAGES_UPSERT y CONNECTION_UPDATE',
            },
          ].map((ep) => (
            <div
              key={ep.path}
              className="rounded-2xl bg-[#F7F9F8] p-4 border border-black/5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#14201E]">{ep.label}</p>
                <p className="text-xs font-mono text-[#0F4C45] truncate mt-0.5">{ep.path}</p>
                <p className="text-[11px] text-[#6A7B76] mt-0.5">{ep.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => void copyEndpoint(ep.path)}
                className="rounded-xl bg-white border border-black/10 p-2.5 text-[#14201E] hover:bg-[#E8F1EE] shrink-0"
                aria-label={`Copiar URL ${ep.path}`}
              >
                {copiedPath === ep.path ? (
                  <Check className="w-4 h-4 text-[#0F4C45]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {[
            { file: '01-olivia-outbox-whatsapp-router.json', desc: 'Router Outbox -> Push + Evolution' },
            { file: '02-olivia-cumpleanos-y-reactivacion-cron.json', desc: 'Cron 10 AM Cumples e Inactivos' },
            { file: '03-olivia-evolution-inbound-bajas-encuestas.json', desc: 'Bajas BAJA/STOP y Encuestas 1-5★' },
          ].map((wf) => (
            <div key={wf.file} className="rounded-2xl bg-[#F3F6F4] p-3.5">
              <p className="font-mono font-bold text-[11px] text-[#0F4C45] truncate">{wf.file}</p>
              <p className="text-[11px] text-[#4A5A56] mt-1">{wf.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
