// Supabase Edge Function: validar-pin-pos
// Valida el PIN del cajero de forma segura usando SERVICE_ROLE y registra auditoría.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { negocio_id, sede_id, pin, dispositivo_id } = await req.json();

    if (!negocio_id || !sede_id || !pin || !/^[0-9]{4,6}$/.test(String(pin))) {
      return new Response(
        JSON.stringify({ valido: false, mensaje: 'Parámetros o formato de PIN inválido (4-6 dígitos).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase.rpc('validar_pin', {
      p_negocio_id: negocio_id,
      p_sede_id: sede_id,
      p_pin: String(pin),
      p_dispositivo_id: dispositivo_id ?? null,
    });

    if (error) {
      return new Response(
        JSON.stringify({ valido: false, mensaje: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ valido: false, mensaje: err instanceof Error ? err.message : 'Error interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
