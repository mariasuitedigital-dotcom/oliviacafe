export async function registerAppSW(
  swUrl: '/sw.js' | '/c/sw.js' | '/caja/sw.js' | '/admin/sw.js',
  scope: '/' | '/c/' | '/caja/' | '/admin/'
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register(swUrl, {
      scope,
      updateViaCache: 'none',
    });
    return registration;
  } catch (err) {
    console.warn(`[PWA] No se pudo registrar el service worker (${swUrl}):`, err);
    return null;
  }
}
