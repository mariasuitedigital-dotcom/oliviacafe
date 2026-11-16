import {
  configureVapid,
  getSupabaseAdmin,
  parseJsonBody,
  verifyCronOrApiSecret,
  webpush,
  type ApiRequest,
  type ApiResponse,
} from './_lib/pushServerUtils';

interface SendPushBody {
  negocio_id?: string;
  cliente_id?: string;
  cliente_ids?: string[];
  title?: string;
  body?: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

interface PushSubRow {
  id: string;
  cliente_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const MAX_BATCH_SIZE = 50;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Usa POST.' });
    return;
  }

  if (!verifyCronOrApiSecret(req)) {
    res.status(401).json({ error: 'No autorizado. CRON_SECRET inválido o ausente.' });
    return;
  }

  const vapid = configureVapid();
  if (!vapid.configured) {
    res.status(503).json({ error: vapid.error });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(503).json({ error: 'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el servidor.' });
    return;
  }

  const body = parseJsonBody<SendPushBody>(req);
  if (!body.negocio_id || !body.title || !body.body) {
    res.status(400).json({ error: 'Se requiere negocio_id, title y body.' });
    return;
  }

  let query = supabase
    .from('push_subscriptions')
    .select('id, cliente_id, endpoint, p256dh, auth')
    .eq('negocio_id', body.negocio_id)
    .eq('enabled', true);

  if (body.cliente_id) {
    query = query.eq('cliente_id', body.cliente_id);
  } else if (body.cliente_ids && body.cliente_ids.length > 0) {
    query = query.in('cliente_id', body.cliente_ids);
  }

  const { data: rows, error: fetchErr } = await query;
  if (fetchErr) {
    res.status(500).json({ error: fetchErr.message });
    return;
  }

  const subscriptions = (rows || []) as PushSubRow[];
  if (subscriptions.length === 0) {
    res.status(200).json({ sent: 0, failed: 0, cleaned: 0, total: 0 });
    return;
  }

  const payloadStr = JSON.stringify({
    title: body.title,
    body: body.body,
    url: body.url || '/c/olivia',
    icon: body.icon || '/icons/client-192x192.png',
    badge: body.badge || '/icons/client-192x192.png',
    tag: body.tag || `olivia-push-${Date.now()}`,
  });

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];
  const deliveredIds: string[] = [];

  for (let i = 0; i < subscriptions.length; i += MAX_BATCH_SIZE) {
    const batch = subscriptions.slice(i, i + MAX_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadStr
        )
      )
    );

    results.forEach((result, idx) => {
      const sub = batch[idx];
      if (result.status === 'fulfilled') {
        sent += 1;
        deliveredIds.push(sub.id);
      } else {
        failed += 1;
        const statusCode = (result.reason as { statusCode?: number } | undefined)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          expiredIds.push(sub.id);
        }
      }
    });
  }

  const nowIso = new Date().toISOString();

  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds);
  }

  if (deliveredIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ last_sent_at: nowIso })
      .in('id', deliveredIds);
  }

  await supabase.from('mensajes_log').insert({
    negocio_id: body.negocio_id,
    cliente_id: body.cliente_id || null,
    canal: 'push',
    tipo_evento: body.tag || 'push_masivo',
    contenido: `${body.title}: ${body.body}`,
    estado: sent > 0 ? 'enviado' : 'fallido',
  });

  res.status(200).json({
    total: subscriptions.length,
    sent,
    failed,
    cleaned: expiredIds.length,
  });
}
