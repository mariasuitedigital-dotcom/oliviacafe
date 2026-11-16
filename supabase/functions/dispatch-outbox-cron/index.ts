// Supabase Edge Function: dispatch-outbox-cron
// Invocada por pg_cron cada 2 min o por Vercel Cron / n8n para despachar eventos_outbox
// aplicando backoff exponencial, prioridad Web Push -> WhatsApp y webhook n8n enriquecido.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface OutboxRow {
  id: string;
  negocio_id: string;
  tipo_evento: string;
  payload: Record<string, unknown>;
  intentos: number;
  max_intentos: number;
}

Deno.serve(async (req) => {
  const expectedSecret = Deno.env.get('CRON_SECRET');
  const authHeader = req.headers.get('authorization');
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const defaultN8nUrl = Deno.env.get('N8N_WEBHOOK_URL') ?? '';
  const n8nSecret = Deno.env.get('N8N_WEBHOOK_SECRET') ?? '';
  const appUrl = Deno.env.get('APP_URL') ?? '';

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const nowIso = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from('eventos_outbox')
    .select('id, negocio_id, tipo_evento, payload, intentos, max_intentos')
    .eq('estado', 'pendiente')
    .lte('proximo_reintento_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const events = (rows || []) as OutboxRow[];
  let dispatched = 0;
  let failed = 0;

  for (const ev of events) {
    try {
      await supabase
        .from('eventos_outbox')
        .update({ estado: 'procesando' })
        .eq('id', ev.id);

      // Cargar configuración del negocio y automatización asociada
      const { data: negocio } = await supabase
        .from('negocios')
        .select(
          'id, slug, nombre, nombre_premio, evolution_instance_name, evolution_status, whatsapp_limite_diario, horario_envio_inicio, horario_envio_fin, webhook_n8n_url, google_maps_url'
        )
        .eq('id', ev.negocio_id)
        .maybeSingle();

      let clienteInfo: Record<string, unknown> | null = null;
      const clienteId = ev.payload?.cliente_id ? String(ev.payload.cliente_id) : '';
      if (clienteId) {
        const { data: cli } = await supabase
          .from('clientes')
          .select('id, nombre, celular, consentimiento_whatsapp, consentimiento_push, baja_whatsapp')
          .eq('id', clienteId)
          .maybeSingle();
        clienteInfo = cli as Record<string, unknown> | null;
      }

      // 1. Notificación Web Push inmediata en eventos clave (casi_premio / premio_listo)
      if (
        appUrl &&
        expectedSecret &&
        clienteId &&
        (ev.tipo_evento === 'sello_confirmado' || ev.tipo_evento === 'premio_listo')
      ) {
        const falta = Number(ev.payload?.falta ?? 99);
        if (ev.tipo_evento === 'premio_listo' || falta === 1) {
          const title =
            ev.tipo_evento === 'premio_listo'
              ? '🎉 ¡Premio desbloqueado!'
              : '☕ ¡Te falta solo 1 sello!';
          const body =
            ev.tipo_evento === 'premio_listo'
              ? `Completaste tu cartilla en ${negocio?.nombre || 'Olivia Café'}. Pasa a canjear tu premio gratis.`
              : `Estás a 1 visita de tu ${negocio?.nombre_premio || 'premio gratis'} en ${negocio?.nombre || 'Olivia Café'}.`;

          await fetch(`${appUrl}/api/push/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${expectedSecret}`,
            },
            body: JSON.stringify({
              negocio_id: ev.negocio_id,
              cliente_id: clienteId,
              title,
              body,
              url: `/c/${negocio?.slug || 'olivia'}`,
              tag: ev.tipo_evento,
            }),
          });
        }
      }

      // 2. Enviar evento enriquecido a n8n para automatizaciones WhatsApp / Evolution API
      const targetN8nUrl = String(negocio?.webhook_n8n_url || defaultN8nUrl || '');
      if (targetN8nUrl) {
        const res = await fetch(targetN8nUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(n8nSecret ? { 'x-olivia-secret': n8nSecret } : {}),
          },
          body: JSON.stringify({
            outbox_id: ev.id,
            negocio_id: ev.negocio_id,
            tipo_evento: ev.tipo_evento,
            payload: ev.payload,
            negocio,
            cliente: clienteInfo,
            cartilla_url: appUrl ? `${appUrl}/c/${negocio?.slug || 'olivia'}` : '/c/olivia',
          }),
        });
        if (!res.ok) {
          throw new Error(`n8n webhook status ${res.status}`);
        }
      }

      await supabase
        .from('eventos_outbox')
        .update({
          estado: 'enviado',
          processed_at: new Date().toISOString(),
          ultimo_error: null,
        })
        .eq('id', ev.id);

      dispatched += 1;
    } catch (err) {
      failed += 1;
      const nextIntentos = ev.intentos + 1;
      const maxIntentos = ev.max_intentos || 5;
      const backoffMs = Math.pow(2, Math.min(nextIntentos, 6)) * 60 * 1000;
      const nextRetry = new Date(Date.now() + backoffMs).toISOString();

      await supabase
        .from('eventos_outbox')
        .update({
          intentos: nextIntentos,
          estado: nextIntentos >= maxIntentos ? 'fallido' : 'pendiente',
          proximo_reintento_at: nextRetry,
          ultimo_error: err instanceof Error ? err.message : 'Error dispatch outbox',
        })
        .eq('id', ev.id);
    }
  }

  return new Response(
    JSON.stringify({ processed: events.length, dispatched, failed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
