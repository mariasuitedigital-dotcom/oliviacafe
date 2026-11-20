import {
  configureVapid,
  getHeaderValue,
  getSupabaseAdmin,
  parseJsonBody,
  verifyCronOrApiSecret,
  webpush,
  type ApiRequest,
  type ApiResponse,
} from './_lib/pushServerUtils';

interface StampNotifyBody {
  negocio_id?: string;
  negocio_nombre?: string;
  nombre_premio?: string;
  cliente_id?: string;
  cliente_nombre?: string;
  dispositivo_id?: string;
  cajero_id?: string;
  kind?: 'stamp' | 'redeem';
  cantidad_agregada?: number;
  sellos_actuales?: number;
  sellos_objetivo?: number;
  url?: string;
}

interface PushSubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function buildServerStampMessage(params: {
  negocioNombre: string;
  nombreCliente: string;
  sellosActuales: number;
  sellosObjetivo: number;
  nombrePremio: string;
  cantidadAgregada: number;
  kind: 'stamp' | 'redeem';
}) {
  const firstName = params.nombreCliente.trim().split(/\s+/)[0] || '';
  const saludo = firstName ? `, ${firstName}` : '';
  const objetivo = Math.max(1, params.sellosObjetivo || 10);
  const actuales = Math.max(0, Math.min(objetivo, params.sellosActuales));
  const faltan = Math.max(0, objetivo - actuales);
  const sumaLabel = params.cantidadAgregada > 1 ? `+${params.cantidadAgregada} sellos` : '+1 sello';

  if (params.kind === 'redeem') {
    return {
      title: `¡Premio canjeado en ${params.negocioNombre}!`,
      body: `¡Que disfrutes tu ${params.nombrePremio}${saludo}! Tu cartilla inició un nuevo ciclo (0/${objetivo}) para seguir sumando.`,
    };
  }
  if (actuales >= objetivo) {
    return {
      title: `¡Meta cumplida! ${actuales}/${objetivo} sellos`,
      body: `¡Felicidades${saludo}! Completaste tu cartilla en ${params.negocioNombre}. Ya puedes canjear gratis: ${params.nombrePremio}.`,
    };
  }
  if (faltan === 1) {
    return {
      title: `¡${sumaLabel} sumado! Solo te falta 1`,
      body: `¡Casi lo logras${saludo}! Ya llevas ${actuales}/${objetivo} sellos. En tu próxima visita canjeas tu ${params.nombrePremio} gratis.`,
    };
  }
  if (actuales >= Math.ceil(objetivo / 2)) {
    return {
      title: `¡${sumaLabel} en ${params.negocioNombre}! (${actuales}/${objetivo})`,
      body: `¡Excelente ritmo${saludo}! Ya pasaste la mitad; solo te faltan ${faltan} visitas para tu ${params.nombrePremio} gratis.`,
    };
  }
  return {
    title: `¡${sumaLabel} agregado a tu cartilla! (${actuales}/${objetivo})`,
    body: `¡Gracias por tu visita${saludo}! Cada sello en ${params.negocioNombre} te acerca más a tu ${params.nombrePremio} gratis.`,
  };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Usa POST.' });
    return;
  }

  const vapid = configureVapid();
  if (!vapid.configured) {
    res.status(200).json({ ok: false, skipped: true, reason: vapid.error });
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    res.status(200).json({
      ok: false,
      skipped: true,
      reason: 'Faltan variables de Supabase en el servidor.',
    });
    return;
  }

  const body = parseJsonBody<StampNotifyBody>(req);
  if (!body.negocio_id || !body.cliente_id) {
    res.status(400).json({ error: 'Se requiere negocio_id y cliente_id.' });
    return;
  }

  // Autorización: CRON_SECRET, JWT de staff (owner/superadmin/cashier) o terminal POS + cajero activos en DB
  let authorized = verifyCronOrApiSecret(req);

  if (!authorized) {
    const authHeader = getHeaderValue(req, 'authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const { data: userRes } = await supabase.auth.getUser(token);
        const appMeta = (userRes?.user?.app_metadata || {}) as {
          role?: string;
          negocio_id?: string;
        };
        if (
          userRes?.user &&
          (appMeta.role === 'superadmin' ||
            ((appMeta.role === 'owner' || appMeta.role === 'cashier') &&
              appMeta.negocio_id === body.negocio_id))
        ) {
          authorized = true;
        }
      }
    }
  }

  if (!authorized && body.dispositivo_id && body.cajero_id) {
    const [{ data: device }, { data: staff }] = await Promise.all([
      supabase
        .from('dispositivos')
        .select('id')
        .eq('id', body.dispositivo_id)
        .eq('negocio_id', body.negocio_id)
        .eq('activo', true)
        .maybeSingle(),
      supabase
        .from('perfiles')
        .select('id, rol')
        .eq('id', body.cajero_id)
        .eq('negocio_id', body.negocio_id)
        .eq('activo', true)
        .in('rol', ['cashier', 'owner', 'superadmin'])
        .maybeSingle(),
    ]);

    if (device && staff) {
      authorized = true;
    }
  }

  if (!authorized) {
    res.status(401).json({ error: 'Terminal o sesión no autorizada para enviar notificaciones.' });
    return;
  }

  // Obtener datos reales del cliente, cartilla y negocio para mensaje personalizado
  const [{ data: cliente }, { data: cartilla }, { data: negocio }] = await Promise.all([
    supabase
      .from('clientes')
      .select('id, nombre, consentimiento_push')
      .eq('id', body.cliente_id)
      .eq('negocio_id', body.negocio_id)
      .maybeSingle(),
    supabase
      .from('cartillas')
      .select('sellos_actuales, sellos_objetivo')
      .eq('cliente_id', body.cliente_id)
      .eq('negocio_id', body.negocio_id)
      .maybeSingle(),
    supabase
      .from('negocios')
      .select('slug, nombre, nombre_premio, sellos_para_premio')
      .eq('id', body.negocio_id)
      .maybeSingle(),
  ]);

  if (cliente && cliente.consentimiento_push === false) {
    res.status(200).json({ ok: true, sent: 0, skipped: true, reason: 'Cliente sin opt-in push.' });
    return;
  }

  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('negocio_id', body.negocio_id)
    .eq('cliente_id', body.cliente_id)
    .eq('enabled', true);

  if (subErr) {
    res.status(500).json({ error: subErr.message });
    return;
  }

  const subscriptions = (subs || []) as PushSubRow[];
  if (subscriptions.length === 0) {
    res.status(200).json({ ok: true, sent: 0, reason: 'Sin dispositivos suscritos.' });
    return;
  }

  const msg = buildServerStampMessage({
    negocioNombre: (negocio?.nombre as string) || body.negocio_nombre || 'Olivia Café',
    nombreCliente: (cliente?.nombre as string) || body.cliente_nombre || '',
    sellosActuales:
      typeof body.sellos_actuales === 'number'
        ? body.sellos_actuales
        : Number(cartilla?.sellos_actuales ?? 1),
    sellosObjetivo:
      typeof body.sellos_objetivo === 'number'
        ? body.sellos_objetivo
        : Number(cartilla?.sellos_objetivo ?? negocio?.sellos_para_premio ?? 10),
    nombrePremio:
      (negocio?.nombre_premio as string) ||
      body.nombre_premio ||
      'Café de Especialidad o Postre',
    cantidadAgregada: Math.max(1, body.cantidad_agregada || 1),
    kind: body.kind === 'redeem' ? 'redeem' : 'stamp',
  });

  const slug = (negocio?.slug as string) || 'olivia';
  const payloadStr = JSON.stringify({
    title: msg.title,
    body: msg.body,
    url: body.url || `/c/${slug}`,
    icon: '/icons/client-192x192.png',
    badge: '/icons/client-192x192.png',
    tag: `olivia-stamp-${body.kind || 'stamp'}-${Date.now()}`,
  });

  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];
  const deliveredIds: string[] = [];

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
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
    const sub = subscriptions[idx];
    if (result.status === 'fulfilled') {
      sent += 1;
      deliveredIds.push(sub.id);
    } else {
      failed += 1;
      const errObj = result.reason as { statusCode?: number } | undefined;
      if (errObj?.statusCode === 404 || errObj?.statusCode === 410) {
        expiredIds.push(sub.id);
      }
    }
  });

  if (expiredIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds);
  }
  if (deliveredIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ last_sent_at: new Date().toISOString() })
      .in('id', deliveredIds);
  }

  res.status(200).json({
    ok: true,
    sent,
    failed,
    cleaned: expiredIds.length,
    title: msg.title,
  });
}
