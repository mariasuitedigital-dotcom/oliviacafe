import type { PrecacheEntry } from 'workbox-precaching';

export interface SwPushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  negocio_slug?: string;
}

export interface SwClient {
  url: string;
  focused: boolean;
  focus: () => Promise<SwClient>;
}

export interface SwClients {
  matchAll: (options?: { type?: 'window' | 'worker' | 'sharedworker' | 'all'; includeUncontrolled?: boolean }) => Promise<SwClient[]>;
  openWindow: (url: string) => Promise<SwClient | null>;
  claim: () => Promise<void>;
}

export interface SwRegistration {
  showNotification: (
    title: string,
    options?: NotificationOptions & { vibrate?: number[]; data?: Record<string, unknown> }
  ) => Promise<void>;
}

export interface SwExtendableEvent extends Event {
  waitUntil: (f: Promise<unknown>) => void;
}

export interface SwPushEvent extends SwExtendableEvent {
  data: {
    json: () => SwPushPayload;
    text: () => string;
  } | null;
}

export interface SwNotificationEvent extends SwExtendableEvent {
  notification: Notification & { data?: { url?: string } };
}

export interface SwGlobalScope extends EventTarget {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
  location: Location;
  clients: SwClients;
  registration: SwRegistration;
  skipWaiting: () => Promise<void>;
}
