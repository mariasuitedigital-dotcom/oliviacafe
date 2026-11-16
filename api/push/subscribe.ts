import {
  getSupabaseAdmin,
  parseJsonBody,
  type ApiRequest,
  type ApiResponse,
} from './_lib/pushServerUtils';

interface SubscribeBody {
  negocio_id?: string;
  cliente_id?: string;
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  timezone?: string;
  user_agent?: string;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const supabase = getSupabaseAdmin();

  if (req.method === 'DELETE') {
    const body = parseJsonBody<{ endpoint?: string }>(req);
    if (!body.endpoint) {
      res.status(400).json({ error: 'Falta endpoint para desuscribir.' });
      return;
    }
    if (!supabase) {
      res.status(200).json({ ok: true, mode: 'env_pending' });
      return;
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('endpoint', body.endpoint);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Usa POST o DELETE.' });
    return;
  }

  const body = parseJsonBody<SubscribeBody>(req);
  if (!body.negocio_id || !body.cliente_id || !body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    res.status(400).json({
      error: 'Datos incompletos. Se requiere negocio_id, cliente_id, endpoint y keys (p256dh, auth).',
    });
    return;
  }

  if (!supabase) {
    res.status(200).json({
      ok: true,
      mode: 'env_pending',
      message: 'Suscripción recibida localmente; configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para persistir.',
    });
    return;
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      negocio_id: body.negocio_id,
      cliente_id: body.cliente_id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      timezone: body.timezone || 'America/Lima',
      user_agent: body.user_agent || null,
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await supabase
    .from('clientes')
    .update({ consentimiento_push: true })
    .eq('id', body.cliente_id)
    .eq('negocio_id', body.negocio_id);

  res.status(200).json({ ok: true });
}
