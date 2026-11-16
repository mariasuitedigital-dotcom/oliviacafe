import {
  configureVapid,
  getSupabaseAdmin,
  parseJsonBody,
  verifyCronOrApiSecret,
  webpush,
  type ApiRequest,
  type ApiResponse,
} from './_lib/pushServerUtils';

interface TestPushBody {
  negocio_id?: string;
  cliente_id?: string;
  subscription?: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  title?: string;
  body?: string;
  url?: string;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Usa POST.' });
    return;
  }

  const vapid = configureVapid();
  if (!vapid.configured) {
    res.status(503).json({ error: vapid.error });
    return;
  }

  const payload = parseJsonBody<TestPushBody>(req);
  let targetSub = payload.subscription || null;

  if (!targetSub) {
    if (!verifyCronOrApiSecret(req)) {
      res.status(401).json({ error: 'Se requiere CRON_SECRET para enviar pruebas por cliente_id.' });
      return;
    }
    const supabase = getSupabaseAdmin();
    if (!supabase || !payload.cliente_id) {
      res.status(400).json({ error: 'Proporciona subscription o cliente_id.' });
      return;
    }
    const { data } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('cliente_id', payload.cliente_id)
      .eq('enabled', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      targetSub = {
        endpoint: data.endpoint as string,
        keys: { p256dh: data.p256dh as string, auth: data.auth as string },
      };
    }
  }

  if (!targetSub) {
    res.status(404).json({ error: 'No se encontró una suscripción Web Push activa.' });
    return;
  }

  try {
    await webpush.sendNotification(
      targetSub,
      JSON.stringify({
        title: payload.title || 'Olivia Café · Prueba Web Push',
        body: payload.body || '¡Tus notificaciones están funcionando correctamente!',
        url: payload.url || '/c/olivia',
        icon: '/icons/client-192x192.png',
        badge: '/icons/client-192x192.png',
        tag: 'olivia-test-push',
      })
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    const statusCode = (err as { statusCode?: number } | undefined)?.statusCode || 500;
    res.status(statusCode).json({
      error: err instanceof Error ? err.message : 'Fallo al enviar notificación de prueba.',
    });
  }
}
