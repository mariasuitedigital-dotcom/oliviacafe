import {
  getHeaderValue,
  getServerEnv,
  getSupabaseAdmin,
  parseJsonBody,
  type ApiRequest,
  type ApiResponse,
} from '../push/_lib/pushServerUtils';
import { ANTI_SPAM_RULES, normalizePeruWhatsapp } from '../../src/shared/automations/messageTemplates';

interface EvolutionInboundPayload {
  event?: string;
  instance?: string;
  data?: {
    state?: string;
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Usa POST.' });
    return;
  }

  const expectedSecret = getServerEnv('EVOLUTION_WEBHOOK_SECRET');
  if (expectedSecret) {
    const provided =
      getHeaderValue(req, 'x-evolution-secret') || getHeaderValue(req, 'apikey');
    if (provided !== expectedSecret) {
      res.status(401).json({ error: 'Secreto de webhook inválido.' });
      return;
    }
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: 'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.' });
    return;
  }

  const body = parseJsonBody<EvolutionInboundPayload>(req);
  const instanceName = String(body.instance || '');

  // 1. Actualización de estado de conexión WhatsApp (CONNECTION_UPDATE)
  if (body.event?.toUpperCase() === 'CONNECTION_UPDATE' && instanceName) {
    const rawState = String(body.data?.state || '').toLowerCase();
    const mapped =
      rawState === 'open'
        ? 'conectado'
        : rawState === 'connecting'
        ? 'qr_pendiente'
        : 'desconectado';
    await supabase
      .from('negocios')
      .update({ evolution_status: mapped })
      .eq('evolution_instance_name', instanceName);
    res.status(200).json({ ok: true, event: 'connection_updated', status: mapped });
    return;
  }

  const remoteJid = String(body.data?.key?.remoteJid || '');
  const fromMe = Boolean(body.data?.key?.fromMe);
  const rawText = String(
    body.data?.message?.conversation || body.data?.message?.extendedTextMessage?.text || ''
  ).trim();

  if (!remoteJid || !rawText || fromMe) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  const phonePe = normalizePeruWhatsapp(remoteJid, false);
  const { data: negocio } = await supabase
    .from('negocios')
    .select('id, nombre, google_maps_url')
    .eq('evolution_instance_name', instanceName)
    .maybeSingle();

  const upper = rawText.toUpperCase();
  const isOptOut = ANTI_SPAM_RULES.optOutKeywords.some(
    (kw) => upper === kw || upper.startsWith(`${kw} `)
  );

  // 2. Baja inmediata (BAJA / STOP / SALIR)
  if (negocio && isOptOut) {
    const { data: cliente } = await supabase
      .from('clientes')
      .update({
        baja_whatsapp: true,
        consentimiento_whatsapp: false,
        fecha_baja: new Date().toISOString(),
      })
      .eq('negocio_id', negocio.id)
      .eq('celular', phonePe)
      .select('id')
      .maybeSingle();

    await supabase.from('mensajes_log').insert({
      negocio_id: negocio.id,
      cliente_id: cliente?.id ?? null,
      canal: 'whatsapp',
      tipo_evento: 'baja_entrante',
      destinatario: phonePe,
      contenido: `Cliente respondió "${rawText}" -> baja automática`,
      estado: 'baja',
    });

    res.status(200).json({ ok: true, action: 'opt_out_applied', celular: phonePe });
    return;
  }

  // 3. Respuesta numérica de encuesta (1 a 5)
  if (negocio && /^[1-5]$/.test(rawText)) {
    const calificacion = Number(rawText);
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nombre')
      .eq('negocio_id', negocio.id)
      .eq('celular', phonePe)
      .maybeSingle();

    if (cliente) {
      await supabase.from('encuestas').insert({
        negocio_id: negocio.id,
        cliente_id: cliente.id,
        calificacion,
        comentario: 'Respondido vía WhatsApp',
        redirigido_maps: calificacion >= 4,
      });

      res.status(200).json({
        ok: true,
        action: 'survey_recorded',
        calificacion,
        es_detractor: calificacion <= 3,
        google_maps_url: calificacion >= 4 ? negocio.google_maps_url : null,
      });
      return;
    }
  }

  // 4. Reenviar conversación normal a n8n si está configurado
  const n8nInboundUrl = getServerEnv('N8N_INBOUND_WEBHOOK_URL') || '';
  if (n8nInboundUrl) {
    await fetch(n8nInboundUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        negocio_id: negocio?.id ?? null,
        instance: instanceName,
        celular: phonePe,
        texto: rawText,
        raw: body,
      }),
    });
  }

  res.status(200).json({ ok: true, forwarded: Boolean(n8nInboundUrl) });
}
