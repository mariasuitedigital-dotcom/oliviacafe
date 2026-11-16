export type RolUsuario = 'customer' | 'cashier' | 'owner' | 'superadmin';
export type NivelLealtad = 'Bambú' | 'Plata' | 'Oro';
export type TipoSello = 'visita' | 'bienvenida' | 'instalacion_pwa' | 'promo' | 'referido' | 'manual';
export type EstadoCupon = 'activo' | 'canjeado' | 'expirado' | 'anulado';
export type CanalMensaje = 'push' | 'whatsapp' | 'ambos';
export type EstadoCampana = 'borrador' | 'programada' | 'procesando' | 'completada' | 'fallida' | 'cancelada';
export type EstadoOutbox = 'pendiente' | 'procesando' | 'enviado' | 'fallido';

export interface NivelConfig {
  nombre: NivelLealtad;
  min_sellos_historicos: number;
  beneficio: string;
}

export interface Negocio {
  id: string;
  slug: string;
  nombre: string;
  subtitulo: string | null;
  logo_url: string | null;
  color_primario: string;
  color_secundario: string;
  color_terciario: string;
  color_neutro: string;
  zona_horaria: string;
  texto_privacidad: string;
  url_privacidad: string | null;
  google_maps_url: string | null;
  otp_requerido_login: boolean;
  otp_requerido_canje: boolean;
  sellos_para_premio: number;
  nombre_premio: string;
  intervalo_minimo_sellos_min: number;
  niveles_config: NivelConfig[];
  evolution_instance_name: string | null;
  evolution_status: string;
  whatsapp_contacto_numero: string | null;
  whatsapp_limite_diario: number;
  horario_envio_inicio: string;
  horario_envio_fin: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Sede {
  id: string;
  negocio_id: string;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
  created_at: string;
}

export interface Perfil {
  id: string;
  negocio_id: string;
  sede_id: string | null;
  rol: RolUsuario;
  nombre_completo: string;
  email: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Dispositivo {
  id: string;
  negocio_id: string;
  sede_id: string;
  nombre: string;
  codigo_emparejamiento: string;
  emparejado: boolean;
  ultimo_acceso_at: string | null;
  activo: boolean;
  created_at: string;
}

export interface Cliente {
  id: string;
  negocio_id: string;
  user_id: string | null;
  nombre: string;
  celular: string;
  fecha_nacimiento_dia: number | null;
  fecha_nacimiento_mes: number | null;
  fecha_nacimiento_anio: number | null;
  consentimiento_whatsapp: boolean;
  consentimiento_push: boolean;
  contacto_guardado: boolean;
  fecha_consentimiento: string | null;
  version_consentimiento: string | null;
  baja_whatsapp: boolean;
  fecha_baja: string | null;
  origen_registro: string | null;
  total_visitas: number;
  ultima_visita_at: string | null;
  created_at: string;
}

export interface ClienteCajaView {
  id: string;
  negocio_id: string;
  nombre: string;
  celular_enmascarado: string;
  total_visitas: number;
  ultima_visita_at: string | null;
}

export interface Cartilla {
  id: string;
  negocio_id: string;
  cliente_id: string;
  codigo_corto: string;
  sellos_actuales: number;
  sellos_objetivo: number;
  nivel: NivelLealtad;
  sellos_historicos: number;
  canjes_historicos: number;
  puntos_bonus: number;
  premio_disponible: boolean;
  bonus_instalacion_otorgado: boolean;
  updated_at: string;
}

export interface Sello {
  id: string;
  negocio_id: string;
  sede_id: string | null;
  cliente_id: string;
  cartilla_id: string;
  cajero_id: string | null;
  dispositivo_id: string | null;
  cantidad: number;
  tipo: TipoSello;
  detalle: string;
  idempotency_key: string;
  created_at: string;
}

export interface Canje {
  id: string;
  negocio_id: string;
  sede_id: string | null;
  cliente_id: string;
  cartilla_id: string;
  cajero_id: string | null;
  premio_entregado: string;
  sellos_consumidos: number;
  verificado_otp: boolean;
  created_at: string;
}

export interface Promocion {
  id: string;
  negocio_id: string;
  titulo: string;
  descripcion: string;
  precio_especial: number;
  precio_regular: number | null;
  sellos_extra: number;
  imagen_url: string | null;
  vigencia_inicio: string;
  vigencia_fin: string;
  limite_por_cliente: number;
  stock_total: number | null;
  stock_usado: number;
  audiencia: string;
  canal: CanalMensaje;
  activa: boolean;
}

export interface Cupon {
  id: string;
  negocio_id: string;
  promocion_id: string;
  cliente_id: string;
  codigo_qr: string;
  estado: EstadoCupon;
  activado_at: string;
  expira_at: string;
  canjeado_at: string | null;
}

export interface AppJwtMetadata {
  role?: RolUsuario;
  negocio_id?: string;
  sede_id?: string;
}
