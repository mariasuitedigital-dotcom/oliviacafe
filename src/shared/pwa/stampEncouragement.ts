export type StampEventKind = 'stamp' | 'redeem';

export interface StampEncouragementInput {
  negocioNombre?: string;
  nombreCliente?: string;
  sellosActuales: number;
  sellosObjetivo: number;
  nombrePremio?: string;
  cantidadAgregada?: number;
  kind: StampEventKind;
}

export interface StampEncouragementMessage {
  title: string;
  body: string;
  isGoalReached: boolean;
  badgeText: string;
}

export interface DemoStampBroadcastPayload {
  clienteId: string;
  clientePhoneDigits?: string;
  kind: StampEventKind;
  cantidadAgregada: number;
  detalle: string;
  sellosActuales: number;
  sellosObjetivo: number;
  nombreCliente: string;
  negocioNombre: string;
  nombrePremio: string;
  createdAt: string;
}

export const DEMO_STAMP_CHANNEL = 'olivia_stamp_events_v1';
export const DEMO_STAMP_STORAGE_EVENT_KEY = 'olivia_last_demo_stamp_event_v1';

export function buildStampEncouragementMessage({
  negocioNombre = 'Olivia Café',
  nombreCliente = '',
  sellosActuales,
  sellosObjetivo,
  nombrePremio = 'Café de Especialidad o Postre',
  cantidadAgregada = 1,
  kind,
}: StampEncouragementInput): StampEncouragementMessage {
  const firstName = nombreCliente.trim().split(/\s+/)[0] || '';
  const saludoNombre = firstName ? `, ${firstName}` : '';
  const objetivo = Math.max(1, sellosObjetivo || 10);
  const actuales = Math.max(0, Math.min(objetivo, sellosActuales));
  const faltan = Math.max(0, objetivo - actuales);
  const sumaLabel = cantidadAgregada > 1 ? `+${cantidadAgregada} sellos` : '+1 sello';

  if (kind === 'redeem') {
    return {
      title: `¡Premio canjeado en ${negocioNombre}!`,
      body: `¡Que disfrutes tu ${nombrePremio}${saludoNombre}! Tu cartilla inició un nuevo ciclo (0/${objetivo}) para seguir sumando.`,
      isGoalReached: false,
      badgeText: 'Premio canjeado',
    };
  }

  if (actuales >= objetivo) {
    return {
      title: `¡Meta cumplida! ${actuales}/${objetivo} sellos`,
      body: `¡Felicidades${saludoNombre}! Completaste tu cartilla en ${negocioNombre}. Ya puedes canjear gratis: ${nombrePremio}.`,
      isGoalReached: true,
      badgeText: '¡Premio listo!',
    };
  }

  if (faltan === 1) {
    return {
      title: `¡${sumaLabel} sumado! Solo te falta 1`,
      body: `¡Casi lo logras${saludoNombre}! Ya llevas ${actuales}/${objetivo} sellos. En tu próxima visita canjeas tu ${nombrePremio} gratis.`,
      isGoalReached: false,
      badgeText: `${actuales}/${objetivo} sellos`,
    };
  }

  if (actuales >= Math.ceil(objetivo / 2)) {
    return {
      title: `¡${sumaLabel} en ${negocioNombre}! (${actuales}/${objetivo})`,
      body: `¡Excelente ritmo${saludoNombre}! Ya pasaste la mitad; solo te faltan ${faltan} visitas para tu ${nombrePremio} gratis.`,
      isGoalReached: false,
      badgeText: `${actuales}/${objetivo} sellos`,
    };
  }

  return {
    title: `¡${sumaLabel} agregado a tu cartilla! (${actuales}/${objetivo})`,
    body: `¡Gracias por tu visita${saludoNombre}! Cada sello en ${negocioNombre} te acerca más a tu ${nombrePremio} gratis.`,
    isGoalReached: false,
    badgeText: `${actuales}/${objetivo} sellos`,
  };
}

export function broadcastDemoStampEvent(payload: DemoStampBroadcastPayload): void {
  if (typeof window === 'undefined') return;
  try {
    if ('BroadcastChannel' in window) {
      const ch = new BroadcastChannel(DEMO_STAMP_CHANNEL);
      ch.postMessage(payload);
      ch.close();
    }
  } catch {
    // Ignorar errores de BroadcastChannel
  }
  try {
    localStorage.setItem(DEMO_STAMP_STORAGE_EVENT_KEY, JSON.stringify(payload));
  } catch {
    // Ignorar errores de almacenamiento
  }
}

export async function showLocalBrowserStampNotification(
  title: string,
  body: string,
  url = '/c/olivia'
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;

  const options: NotificationOptions = {
    body,
    icon: '/icons/client-192x192.png',
    badge: '/icons/client-192x192.png',
    tag: `olivia-stamp-${Date.now()}`,
    data: { url },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg =
        (await navigator.serviceWorker.getRegistration('/c/')) ||
        (await navigator.serviceWorker.getRegistration('/')) ||
        (await navigator.serviceWorker.ready.catch(() => undefined));
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, options);
        return true;
      }
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
