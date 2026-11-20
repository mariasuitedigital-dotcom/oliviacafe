import {
  configureVapid,
  getSupabaseAdmin,
  verifyCronOrApiSecret,
  webpush,
  type ApiRequest,
  type ApiResponse,
} from './_lib/pushServerUtils';

function getLimaDateAndMinutes(): { fecha: string; nowMin: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  const hr = Number(parts.find((p) => p.type === 'hour')?.value || '0');
  const min = Number(parts.find((p) => p.type === 'minute')?.value || '0');

  return { fecha: `${y}-${m}-${d}`, nowMin: hr * 60 + min };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => Number(n) || 0);
  return h * 60 + m;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido.' });
    return;
  }

  if (!verifyCronOrApiSecret(req)) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }

  const vapid = configureVapid();
  const supabase = getSupabaseAdmin();
  if (!vapid.configured || !supabase) {
    res.status(200).json({ ok: false, skipped: true, reason: 'Push o Supabase no configurado.' });
    return;
  }

  const { fecha, nowMin } = getLimaDateAndMinutes();
  const { data: reservas, error } = await supabase
    .from('reservas_coworking')
    .select(
      'id, negocio_id, cliente_id, hora_inicio, codigo_reserva, espacios_coworking(nombre), clientes(nombre, consentimiento_push), negocios(nombre, slug)'
    )
    .eq('fecha', fecha)
    .eq('estado', 'confirmada')
    .eq('recordatorio_enviado', false);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  let notified = 0;
  for (const row of (reservas || []) as Array<Record<string, unknown>>) {
    const startMin = toMinutes(String(row.hora_inicio || '00:00'));
    const diff = startMin - nowMin;

    // Ventana: entre 5 y 45 minutos antes de la reunión
    if (diff < 5 || diff > 45) continue;

    const cliente = row.clientes as { nombre?: string; consentimiento_push?: boolean } | null;
    if (cliente?.consentimiento_push === false) continue;

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('negocio_id', String(row.negocio_id))
      .eq('cliente_id', String(row.cliente_id))
      .eq('enabled', true);

    if (!subs || subs.length === 0) continue;

    const negocio = row.negocios as { nombre?: string; slug?: string } | null;
    const espacio = row.espacios_coworking as { nombre?: string } | null;
    const firstName = (cliente?.nombre || '').split(/\s+/)[0] || '';
    const saludo = firstName ? `, ${firstName}` : '';

    const payloadStr = JSON.stringify({
      title: `⏰ Tu reunión empieza en ${diff} min (${row.hora_inicio})`,
      body: `¡Mucho éxito${saludo}! Tu ${espacio?.nombre || 'mesa'} en ${
        negocio?.nombre || 'Olivia Café'
      } te espera con Wi-Fi y café listo. ¡A cerrar ese trato!`,
      url: `/c/${negocio?.slug || 'olivia'}/espacios`,
      icon: '/icons/client-192x192.png',
      badge: '/icons/client-192x192.png',
      tag: `olivia-coworking-rem-${row.id}`,
    });

    await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: String(sub.endpoint),
            keys: { p256dh: String(sub.p256dh), auth: String(sub.auth) },
          },
          payloadStr
        )
      )
    );

    await supabase
      .from('reservas_coworking')
      .update({ recordatorio_enviado: true, updated_at: new Date().toISOString() })
      .eq('id', String(row.id));

    notified += 1;
  }

  res.status(200).json({ ok: true, checked: (reservas || []).length, notified });
}
