export interface TemplateVars {
  nombre?: string;
  sellos?: number | string;
  falta?: number | string;
  premio?: string;
  url?: string;
}

export const ANTI_SPAM_RULES = {
  timezone: 'America/Lima',
  defaultWindowStart: '09:00',
  defaultWindowEnd: '20:00',
  minDelaySeconds: 8,
  maxDelaySeconds: 25,
  maxBatchSize: 50,
  dailyDefaultLimit: 150,
  optOutKeywords: ['BAJA', 'STOP', 'SALIR', 'NO MAS', 'NO MÁS', 'CANCELAR'],
} as const;

export const DEFAULT_EVOLUTION_TEMPLATES: Record<
  'bienvenida' | 'casi_premio' | 'premio_listo' | 'cumpleanos' | 'reactivacion_15' | 'encuesta_visita',
  string
> = {
  bienvenida:
    '¡Hola {nombre}! Bienvenido a Olivia Café ☕ Ya tienes 1 sello de bienvenida. Mira tu cartilla aquí: {url}. Responde BAJA para no recibir más.',
  casi_premio:
    '¡{nombre}, te falta solo {falta} sello para tu {premio} gratis en Olivia Café! Pasa hoy por Miraflores o San Isidro.',
  premio_listo:
    '🎉 ¡Felicidades, {nombre}! Completaste {sellos} sellos. Tu {premio} te espera en Olivia Café. Muestra tu QR en caja. Responde BAJA para no recibir más.',
  cumpleanos:
    '🎂 ¡Feliz cumpleaños, {nombre}! Esta semana Olivia Café te regala una porción de tarta artesanal gratis al mostrar tu cartilla: {url}. Responde BAJA para no recibir más.',
  reactivacion_15:
    '¡Te extrañamos, {nombre}! Llevas {sellos} sellos en tu cartilla de Olivia Café. Te falta poco para tu {premio}. Responde BAJA para no recibir más.',
  encuesta_visita:
    'Hola {nombre}, ¿cómo estuvo tu café hoy en Olivia Café? Responde del 1 al 5 ⭐. Responde BAJA para no recibir más.',
};

export function renderAutomationTemplate(plantilla: string, vars: TemplateVars): string {
  const safeNombre = vars.nombre?.trim() || 'Amig@';
  const safeSellos = vars.sellos ?? 1;
  const safeFalta = vars.falta ?? 1;
  const safePremio = vars.premio?.trim() || 'Café de Especialidad gratis';
  const safeUrl = vars.url?.trim() || 'https://oliviacafe.pe/c/olivia';

  return plantilla
    .replace(/\{nombre\}/gi, safeNombre)
    .replace(/\{sellos\}/gi, String(safeSellos))
    .replace(/\{falta\}/gi, String(safeFalta))
    .replace(/\{premio\}/gi, safePremio)
    .replace(/\{url\}/gi, safeUrl);
}

/**
 * Normaliza un celular peruano para BD (+519XXXXXXXX) o Evolution API (519XXXXXXXX).
 */
export function normalizePeruWhatsapp(rawPhone: string, forEvolutionApi = false): string {
  const digits = rawPhone.replace(/\D/g, '');
  const local9 = digits.length >= 9 ? digits.slice(-9) : digits;
  const e164Digits = local9.startsWith('9') && local9.length === 9 ? `51${local9}` : digits;
  return forEvolutionApi ? e164Digits : `+${e164Digits}`;
}

/**
 * Evalúa si la hora actual en America/Lima está dentro de la ventana permitida (ej. 09:00 a 20:00).
 */
export function isWithinSendWindow(
  windowStart = '09:00:00',
  windowEnd = '20:00:00',
  timeZone = 'America/Lima',
  now: Date = new Date()
): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '12');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '00');
    const currentMinutes = hour * 60 + minute;

    const [sH, sM] = windowStart.split(':').map((n) => Number(n) || 0);
    const [eH, eM] = windowEnd.split(':').map((n) => Number(n) || 0);

    const startMinutes = sH * 60 + sM;
    const endMinutes = eH * 60 + eM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } catch {
    return true;
  }
}
