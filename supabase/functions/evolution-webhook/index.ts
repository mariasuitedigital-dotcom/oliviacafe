// Supabase Edge Function: evolution-webhook
// Recibe mensajes entrantes de WhatsApp vía Evolution API:
// 1) Procesa bajas inmediatas ("BAJA", "STOP", "SALIR", "NO MÁS")
// 2) Captura calificaciones 1-5 de encuestas post-visita
// 3) Reenvía conversaciones generales a n8n
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STOP_KEYWORDS = ['BAJA', 'STOP', 'SALIR', 'NO MAS', 'NO MÁS', 'CANCELAR'];

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const instanceName = String(body?.instance || '');
    const remoteJid = String(body?.data?.key?.remoteJid || '');
    const fromMe = Boolean(body?.data?.key?.fromMe);
    const rawText = String(
      body?.data?.message?.conversation ||
        body?.data?.message?.extendedTextMessage?.text ||
        ''
    ).trim();

    if (!remoteJid || !rawText || fromMe) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const digits = remoteJid.replace(/\D/g, '').slice(-9);
    const phonePe = digits.length === 9 ? `+51${digits}` : `+${remoteJid.replace(/\D/g, '')}`;

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: negocio } = await supabase
      .from('negocios')
      .select('id, nombre, google_maps_url')
      .eq('evolution_instance_name', instanceName)
      .maybeSingle();

    const upper = rawText.toUpperCase();
    const isOptOut = STOP_KEYWORDS.some((kw) => upper === kw || upper.startsWith(`${kw} `));

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

      return new Response(JSON.stringify({ ok: true, action: 'opt_out_applied' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Procesar respuesta numérica de encuesta (1 a 5)
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
          redirigido_maps: calificacion === 5,
        });

        return new Response(
          JSON.stringify({
            ok: true,
            action: 'survey_recorded',
            calificacion,
            es_detractor: calificacion <= 3,
            google_maps_url: calificacion >= 4 ? negocio.google_maps_url : null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Reenviar mensaje conversacional a n8n si está configurado
    const n8nInboundUrl = Deno.env.get('N8N_INBOUND_WEBHOOK_URL') ?? '';
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

    return new Response(JSON.stringify({ ok: true, forwarded: Boolean(n8nInboundUrl) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Error webhook' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
