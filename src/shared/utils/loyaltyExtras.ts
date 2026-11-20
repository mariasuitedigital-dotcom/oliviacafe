import type { CartaItem, HappyHourConfig } from '@/src/types/database';

export const DEFAULT_HAPPY_HOUR_CONFIG: HappyHourConfig = {
  activo: false,
  dias: [2, 3, 4],
  hora_inicio: '15:00',
  hora_fin: '18:00',
  multiplicador: 2,
  etiqueta: 'Hora Feliz 2x Sellos',
};

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_MAP_SHORT: Record<string, number> = {
  sun: 0,
  dom: 0,
  mon: 1,
  lun: 1,
  tue: 2,
  mar: 2,
  wed: 3,
  mie: 3,
  'mié': 3,
  thu: 4,
  jue: 4,
  fri: 5,
  vie: 5,
  sat: 6,
  sab: 6,
  'sáb': 6,
};

export interface HappyHourEvaluation {
  enabled: boolean;
  isActiveNow: boolean;
  multiplier: number;
  label: string;
  scheduleSummary: string;
}

export function evaluateHappyHour(
  config?: HappyHourConfig | null,
  timezone = 'America/Lima'
): HappyHourEvaluation {
  const cfg: HappyHourConfig = {
    ...DEFAULT_HAPPY_HOUR_CONFIG,
    ...(config || {}),
    dias: Array.isArray(config?.dias) ? config.dias : DEFAULT_HAPPY_HOUR_CONFIG.dias,
  };

  const daysText =
    cfg.dias.length > 0
      ? cfg.dias
          .slice()
          .sort((a, b) => a - b)
          .map((d) => DAY_LABELS[d] || '')
          .filter(Boolean)
          .join(', ')
      : 'Todos los días';
  const scheduleSummary = `${daysText} · ${cfg.hora_inicio} – ${cfg.hora_fin}`;
  const mult = Math.max(2, Number(cfg.multiplicador) || 2);

  if (!cfg.activo) {
    return {
      enabled: false,
      isActiveNow: false,
      multiplier: 1,
      label: cfg.etiqueta || 'Hora Feliz 2x Sellos',
      scheduleSummary,
    };
  }

  let currentDow = new Date().getDay();
  let currentHhmm = `${String(new Date().getHours()).padStart(2, '0')}:${String(
    new Date().getMinutes()
  ).padStart(2, '0')}`;

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'America/Lima',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const wd = (parts.find((p) => p.type === 'weekday')?.value || '').toLowerCase().slice(0, 3);
    const hr = parts.find((p) => p.type === 'hour')?.value || '00';
    const min = parts.find((p) => p.type === 'minute')?.value || '00';
    if (wd in DAY_MAP_SHORT) currentDow = DAY_MAP_SHORT[wd];
    currentHhmm = `${hr.padStart(2, '0')}:${min.padStart(2, '0')}`;
  } catch {
    // Fallback a reloj local si timeZone falla
  }

  const dayMatch = cfg.dias.length === 0 || cfg.dias.includes(currentDow);
  const timeMatch = currentHhmm >= cfg.hora_inicio && currentHhmm <= cfg.hora_fin;
  const isActiveNow = dayMatch && timeMatch;

  return {
    enabled: true,
    isActiveNow,
    multiplier: isActiveNow ? mult : 1,
    label: cfg.etiqueta || `Hora Feliz ${mult}x Sellos`,
    scheduleSummary,
  };
}

const CARTA_LOCAL_PREFIX = 'olivia_carta_digital_v1_';

export function buildDefaultCartaItems(negocioId: string): CartaItem[] {
  return [
    {
      id: 'carta-1',
      negocio_id: negocioId,
      categoria: 'Café de Especialidad',
      nombre: 'Flat White Doble Origen',
      descripcion: 'Doble ristretto 100% arábica de Villa Rica con leche texturizada sedosa.',
      precio: 13.5,
      imagen_url: '/src/assets/images/aitama_reward_cup_1794847436322.jpg',
      recomendado: true,
      maridaje: 'Ideal con Croissant de Mantequilla',
      disponible: true,
      orden: 1,
    },
    {
      id: 'carta-2',
      negocio_id: negocioId,
      categoria: 'Café de Especialidad',
      nombre: 'V60 Filtrado de Altura',
      descripcion: 'Extracción manual con notas cítricas y cacao fino de Cusco.',
      precio: 15.0,
      imagen_url: '/src/assets/images/aitama_cafe_hero_1794847435488.jpg',
      recomendado: false,
      maridaje: 'Ideal con Galleta Chocochip',
      disponible: true,
      orden: 2,
    },
    {
      id: 'carta-3',
      negocio_id: negocioId,
      categoria: 'Cold Brew & Fríos',
      nombre: 'Cold Brew Citron',
      descripcion: 'Maceración en frío 18h con rodaja de naranja orgánica de Chanchamayo.',
      precio: 14.5,
      imagen_url: '/src/assets/images/aitama_cafe_hero_1794847435488.jpg',
      recomendado: true,
      maridaje: 'Ideal con Tartaleta de Limón',
      disponible: true,
      orden: 3,
    },
    {
      id: 'carta-4',
      negocio_id: negocioId,
      categoria: 'Cold Brew & Fríos',
      nombre: 'Iced Latte de Avena',
      descripcion: 'Espresso doble sobre hielo con bebida vegetal de avena cremosa.',
      precio: 15.5,
      imagen_url: '/src/assets/images/aitama_reward_cup_1794847436322.jpg',
      recomendado: false,
      maridaje: 'Ideal con Muffin de Arándanos',
      disponible: true,
      orden: 4,
    },
    {
      id: 'carta-5',
      negocio_id: negocioId,
      categoria: 'Pastelería Artesanal',
      nombre: 'Croissant de Mantequilla',
      descripcion: 'Hojaldre francés horneado cada mañana, crujiente por fuera y aireado por dentro.',
      precio: 9.5,
      imagen_url: '/src/assets/images/aitama_reward_cup_1794847436322.jpg',
      recomendado: true,
      maridaje: 'Acompaña con Flat White o Cappuccino',
      disponible: true,
      orden: 5,
    },
    {
      id: 'carta-6',
      negocio_id: negocioId,
      categoria: 'Combos & Brunch',
      nombre: 'Combo Mañana Olivia',
      descripcion: 'Flat White o Americano + Croissant de Mantequilla artesanal recién horneado.',
      precio: 19.9,
      imagen_url: '/src/assets/images/aitama_reward_cup_1794847436322.jpg',
      recomendado: true,
      maridaje: 'Suma sello en tu cartilla al instante',
      disponible: true,
      orden: 6,
    },
  ];
}

export function readLocalCartaItems(negocioId: string): CartaItem[] {
  try {
    const raw = localStorage.getItem(`${CARTA_LOCAL_PREFIX}${negocioId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as CartaItem[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  const initial = buildDefaultCartaItems(negocioId);
  writeLocalCartaItems(negocioId, initial);
  return initial;
}

export function writeLocalCartaItems(negocioId: string, items: CartaItem[]): void {
  try {
    localStorage.setItem(`${CARTA_LOCAL_PREFIX}${negocioId}`, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

const PENDING_REF_KEY = 'olivia_pending_referral_code_v1';

export function captureReferralFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('ref');
    if (raw && raw.trim().length >= 3) {
      const clean = raw.trim().toUpperCase();
      sessionStorage.setItem(PENDING_REF_KEY, clean);
      return clean;
    }
    return sessionStorage.getItem(PENDING_REF_KEY);
  } catch {
    return null;
  }
}

export function getPendingReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(PENDING_REF_KEY);
  } catch {
    return null;
  }
}

export function clearPendingReferralCode(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_REF_KEY);
  } catch {
    // Ignore
  }
}

export function buildReferralShareUrl(negocioSlug: string, codigoCorto: string): string {
  const cleanCode = codigoCorto.replace('#', '').trim().toUpperCase();
  if (typeof window === 'undefined') {
    return `/c/${negocioSlug}?ref=${encodeURIComponent(cleanCode)}`;
  }
  return `${window.location.origin}/c/${negocioSlug}?ref=${encodeURIComponent(cleanCode)}`;
}
