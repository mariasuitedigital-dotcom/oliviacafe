import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Negocio } from '@/src/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('TU-PROYECTO') &&
    !supabaseAnonKey.includes('TU_SUPABASE')
);

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }
  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return clientInstance;
}

export const OLIVIA_DEFAULT_NEGOCIO: Negocio = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'olivia',
  nombre: 'Olivia Café',
  subtitulo: 'Café de Especialidad & Pastelería Artesanal',
  logo_url: null,
  color_primario: '#0F4C45',
  color_secundario: '#F2B632',
  color_terciario: '#DCE3DE',
  color_neutro: '#14201E',
  zona_horaria: 'America/Lima',
  texto_privacidad:
    'De conformidad con la Ley N° 29733 (Ley de Protección de Datos Personales del Perú), tus datos se usan exclusivamente para tu cartilla de lealtad en Olivia Café y promociones autorizadas.',
  url_privacidad: '/privacidad',
  google_maps_url: 'https://maps.google.com/?q=Olivia+Cafe+Miraflores+Lima',
  otp_requerido_login: false,
  otp_requerido_canje: true,
  sellos_para_premio: 10,
  nombre_premio: 'Café de Especialidad o Postre de la Vitrina',
  intervalo_minimo_sellos_min: 30,
  niveles_config: [
    { nombre: 'Bambú', min_sellos_historicos: 0, beneficio: '1 sello por visita' },
    { nombre: 'Plata', min_sellos_historicos: 15, beneficio: 'Regalo doble en cumpleaños' },
    { nombre: 'Oro', min_sellos_historicos: 35, beneficio: 'Acceso anticipado a catas y promos' },
  ],
  evolution_instance_name: 'olivia-lima-wa',
  evolution_status: 'disconnected',
  whatsapp_contacto_numero: '+51987111222',
  whatsapp_limite_diario: 150,
  horario_envio_inicio: '09:00:00',
  horario_envio_fin: '20:00:00',
  activo: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const AITAMA_DEFAULT_NEGOCIO = OLIVIA_DEFAULT_NEGOCIO;
