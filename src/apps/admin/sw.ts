import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import type { SwExtendableEvent, SwGlobalScope, SwNotificationEvent, SwPushEvent, SwPushPayload } from '@/src/shared/pwa/swTypes';

declare const self: SwGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

precacheAndRoute(self.__WB_MANIFEST || []);

registerRoute(
  ({ request, url }) => request.mode === 'navigate' && url.pathname.startsWith('/admin'),
  new NetworkFirst({
    cacheName: 'olivia-admin-pages',
    networkTimeoutSeconds: 4,
  })
);

self.addEventListener('push', (event: Event) => {
  const pushEvent = event as SwPushEvent;
  let payload: SwPushPayload = {
    title: 'Olivia Admin',
    body: 'Nueva alerta de gestión en tu negocio.',
    url: '/admin',
  };

  if (pushEvent.data) {
    try {
      payload = { ...payload, ...pushEvent.data.json() };
    } catch {
      payload.body = pushEvent.data.text() || payload.body;
    }
  }

  pushEvent.waitUntil(
    self.registration.showNotification(payload.title || 'Olivia Admin', {
      body: payload.body,
      icon: payload.icon || '/icons/admin-192x192.png',
      badge: payload.badge || '/icons/admin-192x192.png',
      tag: payload.tag || 'olivia-admin-notif',
      data: { url: payload.url || '/admin' },
    })
  );
});

self.addEventListener('notificationclick', (event: Event) => {
  const notifEvent = event as SwNotificationEvent;
  notifEvent.notification.close();
  const targetUrl = new URL(notifEvent.notification.data?.url || '/admin', self.location.origin).href;

  notifEvent.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(`${self.location.origin}/admin`) && 'focus' in client) {
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
