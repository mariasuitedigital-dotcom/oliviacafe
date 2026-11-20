import type {
  EspacioCoworking,
  ReservaCoworking,
} from '@/src/types/database';

const ESPACIOS_LOCAL_PREFIX = 'olivia_coworking_espacios_v1_';
const RESERVAS_LOCAL_PREFIX = 'olivia_coworking_reservas_v1_';
export const COWORKING_EVENT_CHANNEL = 'olivia_coworking_events_v1';
export const COWORKING_STORAGE_EVENT_KEY = 'olivia_coworking_last_event_v1';

export function buildDefaultEspacios(negocioId: string): EspacioCoworking[] {
  return [
    {
      id: 'esp-olivia-1',
      negocio_id: negocioId,
      sede_id: '22222222-2222-4222-8222-222222222221',
      nombre: 'Mesa Ejecutiva 01 (Reuniones)',
      capacidad: 4,
      descripcion:
        'Mesa amplia junto a ventanal iluminado para cerrar acuerdos o reuniones con clientes.',
      equipamiento: 'Wi-Fi Fibra 300Mbps · 4 Enchufes · Iluminación natural',
      consumo_minimo_pen: 18,
      duracion_bloque_min: 120,
      hora_apertura: '08:00',
      hora_cierre: '20:00',
      activo: true,
    },
    {
      id: 'esp-olivia-2',
      negocio_id: negocioId,
      sede_id: '22222222-2222-4222-8222-222222222221',
      nombre: 'Barra Work & Laptop 02',
      capacidad: 2,
      descripcion:
        'Espacio tranquilo con tomas de corriente USB-C y buena acústica para videollamadas.',
      equipamiento: 'Wi-Fi Fibra · Tomas múltiples · Zona tranquila',
      consumo_minimo_pen: 13.5,
      duracion_bloque_min: 120,
      hora_apertura: '08:00',
      hora_cierre: '20:00',
      activo: true,
    },
    {
      id: 'esp-olivia-3',
      negocio_id: negocioId,
      sede_id: '22222222-2222-4222-8222-222222222222',
      nombre: 'Mesa Negocios San Isidro 01',
      capacidad: 4,
      descripcion:
        'A pasos del centro financiero. Ideal para reuniones ejecutivas con café de especialidad.',
      equipamiento: 'Wi-Fi Fibra · Enchufes · Atención preferencial',
      consumo_minimo_pen: 20,
      duracion_bloque_min: 90,
      hora_apertura: '08:00',
      hora_cierre: '19:30',
      activo: true,
    },
  ];
}

export function readLocalEspacios(negocioId: string): EspacioCoworking[] {
  try {
    const raw = localStorage.getItem(`${ESPACIOS_LOCAL_PREFIX}${negocioId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as EspacioCoworking[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  const initial = buildDefaultEspacios(negocioId);
  writeLocalEspacios(negocioId, initial);
  return initial;
}

export function writeLocalEspacios(negocioId: string, items: EspacioCoworking[]): void {
  try {
    localStorage.setItem(`${ESPACIOS_LOCAL_PREFIX}${negocioId}`, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

export function readLocalReservas(negocioId: string): ReservaCoworking[] {
  try {
    const raw = localStorage.getItem(`${RESERVAS_LOCAL_PREFIX}${negocioId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as ReservaCoworking[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return [];
}

export function writeLocalReservas(negocioId: string, items: ReservaCoworking[]): void {
  try {
    localStorage.setItem(`${RESERVAS_LOCAL_PREFIX}${negocioId}`, JSON.stringify(items));
  } catch {
    // Ignore storage errors
  }
}

export function broadcastCoworkingSync(payload: {
  negocioId: string;
  reservaId?: string;
  clienteId?: string;
  tipo: 'nueva_solicitud' | 'yape_adjunto' | 'confirmada' | 'rechazada' | 'checkin' | 'cancelada';
  timestamp: string;
}) {
  if (typeof window === 'undefined') return;
  try {
    if ('BroadcastChannel' in window) {
      const ch = new BroadcastChannel(COWORKING_EVENT_CHANNEL);
      ch.postMessage(payload);
      ch.close();
    }
  } catch {
    // Ignore BroadcastChannel error
  }
  try {
    localStorage.setItem(COWORKING_STORAGE_EVENT_KEY, JSON.stringify(payload));
  } catch {
    // Ignore localStorage error
  }
}

export interface TimeSlotOption {
  hora_inicio: string;
  hora_fin: string;
  ocupado: boolean;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => Number(n) || 0);
  return h * 60 + m;
}

function toHhmm(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getTodayLimaDateStr(timezone = 'America/Lima'): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback below
  }
  return new Date().toISOString().slice(0, 10);
}

export function getNowLimaMinutes(timezone = 'America/Lima'): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value || '0');
    const m = Number(parts.find((p) => p.type === 'minute')?.value || '0');
    return h * 60 + m;
  } catch {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

export function buildSpaceTimeSlots(params: {
  espacio: EspacioCoworking;
  fecha: string;
  reservasExistentes: ReservaCoworking[];
  timezone?: string;
}): TimeSlotOption[] {
  const { espacio, fecha, reservasExistentes, timezone = 'America/Lima' } = params;
  const startMin = toMinutes(espacio.hora_apertura || '08:00');
  const endMin = toMinutes(espacio.hora_cierre || '20:00');
  const blockMin = Math.max(60, espacio.duracion_bloque_min || 120);
  const todayStr = getTodayLimaDateStr(timezone);
  const nowMin = getNowLimaMinutes(timezone);

  const blocking = reservasExistentes.filter(
    (r) =>
      r.espacio_id === espacio.id &&
      r.fecha === fecha &&
      ['pendiente_pago', 'yape_por_validar', 'confirmada', 'checkin'].includes(r.estado)
  );

  const slots: TimeSlotOption[] = [];
  for (let cur = startMin; cur + blockMin <= endMin; cur += blockMin) {
    // Si es hoy, ocultar o saltar horarios ya pasados (dando 10 min de margen)
    if (fecha === todayStr && cur + 15 < nowMin) continue;

    const slotStart = toHhmm(cur);
    const slotEnd = toHhmm(cur + blockMin);
    const ocupado = blocking.some((r) => {
      const rStart = toMinutes(r.hora_inicio);
      const rEnd = toMinutes(r.hora_fin);
      return cur < rEnd && cur + blockMin > rStart;
    });

    slots.push({
      hora_inicio: slotStart,
      hora_fin: slotEnd,
      ocupado,
    });
  }
  return slots;
}

export function compressReceiptImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen del comprobante.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Archivo de imagen inválido.'));
      img.onload = () => {
        const maxDim = 820;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function formatMinutesRemainingToMeeting(
  fecha: string,
  horaInicio: string,
  timezone = 'America/Lima'
): number | null {
  const todayStr = getTodayLimaDateStr(timezone);
  if (fecha !== todayStr) return null;
  const nowMin = getNowLimaMinutes(timezone);
  const startMin = toMinutes(horaInicio);
  return startMin - nowMin;
}
