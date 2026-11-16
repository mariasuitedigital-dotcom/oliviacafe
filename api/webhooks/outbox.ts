import {
  configureVapid,
  getServerEnv,
  getSupabaseAdmin,
  verifyCronOrApiSecret,
  webpush,
  type ApiRequest,
  type ApiResponse,
} from '../push/_lib/pushServerUtils';
import {
  DEFAULT_EVOLUTION_TEMPLATES,
  isWithinSendWindow,
  normalizePeruWhatsapp,
  renderAutomationTemplate,
} from '../../src/shared/automations/messageTemplates';

interface OutboxEventRow {
  id: string;
  negocio_id: string;
  tipo_evento: string;
  payload: Record<string, unknown>;
  intentos: number;
  max_intentos: number;
}

const EVENT_TO_AUTOMATION: Record<string, keyof typeof DEFAULT_EVOLUTION_TEMPLATES> = {
  cliente_registrado: 'bienvenida',
  sello_confirmado: 'casi_premio',
  premio_listo: 'premio_listo',
  cumpleanos_hoy: 'cumpleanos',
  reactivacion_inactivos: 'reactivacion_15',
  encuesta_visita: 'encuesta_visita',
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido. Usa POST o GET.' });
    return;
  }

  if (!verifyCronOrApiSecret(req)) {
    res.status(401).json({ error: 'No autorizado. CRON_SECRET inválido o ausente.' });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: 'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.' });
    return;
  }

  const vapid = configureVapid();
  const appUrl = getServerEnv('APP_URL') || 'https://oliviacafe.pe';
  const defaultN8nUrl = getServerEnv('N8N_WEBHOOK_URL') || '';
  const n8nSecret = getServerEnv('N8N_WEBHOOK_SECRET') || '';
  const evolutionUrl = getServerEnv('EVOLUTION_API_URL') || '';
  const evolutionKey = getServerEnv('EVOLUTION_API_KEY') || '';

  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from('eventos_outbox')
    .select('id, negocio_id, tipo_evento, payload, intentos, max_intentos')
    .eq('estado', 'pendiente')
    .lte('proximo_reintento_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(50);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const events = (rows || []) as OutboxEventRow[];
  let dispatched = 0;
  let deferred = 0;
  let failed = 0;

  for (const ev of events) {
    try {
      await supabase.from('eventos_outbox').update({ estado: 'procesando' }).eq('id', ev.id);

      const { data: negocio } = await supabase
        .from('negocios')
        .select(
          'id, slug, nombre, nombre_premio, zona_horaria, evolution_instance_name, evolution_status, whatsapp_limite_diario, horario_envio_inicio, horario_envio_fin, webhook_n8n_url'
        )
        .eq('id', ev.negocio_id)
        .maybeSingle();

      const autoTipo = EVENT_TO_AUTOMATION[ev.tipo_evento];
      const { data: autoRow } = autoTipo
        ? await supabase
            .from('automatizaciones')
            .select('activo, canal, plantilla')
            .eq('negocio_id', ev.negocio_id)
            .eq('tipo', autoTipo)
            .maybeSingle()
        : { data: null };

      if (ev.tipo_evento === 'otp_activacion_primer_ingreso') {
        const otpPhone = normalizePeruWhatsapp(String(ev.payload?.celular_otp || ''), true);
        const otpCode = String(ev.payload?.codigo_otp || '');
        const otpNombre = String(ev.payload?.nombre || 'Usuario');
        const otpText = `🔐 Hola ${otpNombre}, tu código OTP de activación en ${negocio?.nombre || 'Olivia Café'} es: *${otpCode}*. Válido por 10 minutos.`;

        if (otpPhone && evolutionUrl && evolutionKey && negocio?.evolution_instance_name) {
          await fetch(
            `${evolutionUrl.replace(/\/$/, '')}/message/sendText/${negocio.evolution_instance_name}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', apikey: evolutionKey },
              body: JSON.stringify({ number: otpPhone, text: otpText }),
            }
          );
        } else if (otpPhone && (negocio?.webhook_n8n_url || defaultN8nUrl)) {
          const target = String(negocio?.webhook_n8n_url || defaultN8nUrl);
          await fetch(target, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(n8nSecret ? { 'x-olivia-secret': n8nSecret } : {}),
            },
            body: JSON.stringify({
              outbox_id: ev.id,
              negocio_id: ev.negocio_id,
              tipo_evento: ev.tipo_evento,
              numero_wa: otpPhone,
              mensaje: otpText,
              payload: ev.payload,
            }),
          });
        }

        await supabase
          .from('eventos_outbox')
          .update({ estado: 'enviado', processed_at: new Date().toISOString(), ultimo_error: null })
          .eq('id', ev.id);
        dispatched += 1;
        continue;
      }

      const clienteId = ev.payload?.cliente_id ? String(ev.payload.cliente_id) : '';
      const { data: cliente } = clienteId
        ? await supabase
            .from('clientes')
            .select('id, nombre, celular, consentimiento_whatsapp, consentimiento_push, baja_whatsapp')
            .eq('id', clienteId)
            .maybeSingle()
        : { data: null };

      // Saltar si es sello_confirmado pero aún le faltan > 1 sello (no saturar al cliente en cada café)
      const faltaNum = Number(ev.payload?.falta ?? 99);
      const shouldSkipCasiPremio = ev.tipo_evento === 'sello_confirmado' && faltaNum !== 1;

      if (autoRow && autoRow.activo === false) {
        await supabase
          .from('eventos_outbox')
          .update({ estado: 'enviado', processed_at: new Date().toISOString(), ultimo_error: 'Automatización pausada' })
          .eq('id', ev.id);
        dispatched += 1;
        continue;
      }

      if (shouldSkipCasiPremio) {
        await supabase
          .from('eventos_outbox')
          .update({ estado: 'enviado', processed_at: new Date().toISOString() })
          .eq('id', ev.id);
        dispatched += 1;
        continue;
      }

      const plantilla =
        autoRow?.plantilla ||
        (autoTipo ? DEFAULT_EVOLUTION_TEMPLATES[autoTipo] : 'Actualización de Olivia Café: {url}');
      const mensajeRenderizado = renderAutomationTemplate(plantilla, {
        nombre: String(cliente?.nombre || ev.payload?.nombre || 'Cliente'),
        sellos: Number(ev.payload?.sellos_actuales ?? 1),
        falta: faltaNum,
        premio: String(ev.payload?.premio || negocio?.nombre_premio || 'Premio Olivia Café'),
        url: `${appUrl}/c/${negocio?.slug || 'olivia'}`,
      });

      const canal = (autoRow?.canal || 'push') as 'push' | 'whatsapp' | 'ambos';
      let sentViaPush = false;

      // Prioridad 1: Web Push si tiene suscripción activa y el canal lo permite
      if (vapid.configured && clienteId && (canal === 'push' || canal === 'ambos')) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('id, endpoint, p256dh, auth')
          .eq('negocio_id', ev.negocio_id)
          .eq('cliente_id', clienteId)
          .eq('enabled', true);

        if (subs && subs.length > 0) {
          const payloadStr = JSON.stringify({
            title: negocio?.nombre || 'Olivia Café',
            body: mensajeRenderizado,
            url: `/c/${negocio?.slug || 'olivia'}`,
            icon: '/icons/client-192x192.png',
            badge: '/icons/client-192x192.png',
            tag: ev.tipo_evento,
          });

          const results = await Promise.allSettled(
            subs.map((s) =>
              webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payloadStr
              )
            )
          );
          sentViaPush = results.some((r) => r.status === 'fulfilled');
        }
      }

      // Prioridad 2: WhatsApp vía n8n o Evolution API (solo con consentimiento, sin baja, dentro de horario y cuota)
      const wantsWhatsapp =
        (canal === 'whatsapp' || (canal === 'ambos' && !sentViaPush)) &&
        Boolean(cliente?.celular) &&
        Boolean(cliente?.consentimiento_whatsapp) &&
        !cliente?.baja_whatsapp;

      if (wantsWhatsapp) {
        const inWindow = isWithinSendWindow(
          String(negocio?.horario_envio_inicio || '09:00:00'),
          String(negocio?.horario_envio_fin || '20:00:00'),
          String(negocio?.zona_horaria || 'America/Lima')
        );

        if (!inWindow) {
          // Posponer 1 hora para respetar horario de atención Lima (09:00-20:00)
          await supabase
            .from('eventos_outbox')
            .update({
              estado: 'pendiente',
              proximo_reintento_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              ultimo_error: 'Fuera de horario permitido (America/Lima)',
            })
            .eq('id', ev.id);
          deferred += 1;
          continue;
        }

        const targetN8n = String(negocio?.webhook_n8n_url || defaultN8nUrl || '');
        if (targetN8n) {
          const n8nRes = await fetch(targetN8n, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(n8nSecret ? { 'x-olivia-secret': n8nSecret } : {}),
            },
            body: JSON.stringify({
              outbox_id: ev.id,
              negocio_id: ev.negocio_id,
              tipo_evento: ev.tipo_evento,
              canal,
              mensaje: mensajeRenderizado,
              numero_wa: normalizePeruWhatsapp(String(cliente?.celular || ''), true),
              negocio,
              cliente,
              payload: ev.payload,
            }),
          });
          if (!n8nRes.ok) {
            throw new Error(`n8n respondió ${n8nRes.status}`);
          }
        } else if (evolutionUrl && evolutionKey && negocio?.evolution_instance_name) {
          const evoRes = await fetch(
            `${evolutionUrl.replace(/\/$/, '')}/message/sendText/${negocio.evolution_instance_name}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: evolutionKey,
              },
              body: JSON.stringify({
                number: normalizePeruWhatsapp(String(cliente?.celular || ''), true),
                text: mensajeRenderizado,
              }),
            }
          );
          if (!evoRes.ok) {
            throw new Error(`Evolution API respondió ${evoRes.status}`);
          }
        }

        await supabase.from('mensajes_log').insert({
          negocio_id: ev.negocio_id,
          cliente_id: clienteId || null,
          canal: 'whatsapp',
          tipo_evento: ev.tipo_evento,
          destinatario: String(cliente?.celular || ''),
          contenido: mensajeRenderizado,
          estado: 'enviado',
        });
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
      const backoffMs = Math.pow(2, Math.min(nextIntentos, 6)) * 60 * 1000;
      await supabase
        .from('eventos_outbox')
        .update({
          intentos: nextIntentos,
          estado: nextIntentos >= (ev.max_intentos || 5) ? 'fallido' : 'pendiente',
          proximo_reintento_at: new Date(Date.now() + backoffMs).toISOString(),
          ultimo_error: err instanceof Error ? err.message : 'Error procesando outbox',
        })
        .eq('id', ev.id);
    }
  }

  res.status(200).json({
    processed: events.length,
    dispatched,
    deferred,
    failed,
  });
}
