import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import type {
  SwExtendableEvent,
  SwGlobalScope,
  SwNotificationEvent,
  SwPushEvent,
  SwPushPayload,
} from '@/src/shared/pwa/swTypes';

declare const self: SwGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST || []);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'aitama-root-fonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 12,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  })
);

registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'aitama-root-pages',
    networkTimeoutSeconds: 4,
  })
);

self.addEventListener('push', (event: Event) => {
  const pushEvent = event as SwPushEvent;
  let payload: SwPushPayload = {
    title: 'Olivia Café',
    body: 'Tienes novedades en tu cartilla de lealtad.',
    url: '/',
  };

  if (pushEvent.data) {
    try {
      payload = { ...payload, ...pushEvent.data.json() };
    } catch {
      payload.body = pushEvent.data.text() || payload.body;
    }
  }

  pushEvent.waitUntil(
    self.registration.showNotification(payload.title || 'Olivia Café', {
      body: payload.body,
      icon: payload.icon || '/icons/client-192x192.png',
      badge: payload.badge || '/icons/client-192x192.png',
      tag: payload.tag || 'olivia-root-notif',
      vibrate: [120, 60, 120],
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event: Event) => {
  const notifEvent = event as SwNotificationEvent;
  notifEvent.notification.close();
  const targetUrl = new URL(notifEvent.notification.data?.url || '/', self.location.origin).href;

  notifEvent.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('activate', (event: Event) => {
  const extEvent = event as SwExtendableEvent;
  extEvent.waitUntil(self.clients.claim());
});
