let swControllerReloadBound = false;

export async function registerAppSW(
  swUrl: '/sw.js' | '/c/sw.js' | '/caja/sw.js' | '/admin/sw.js',
  scope: '/' | '/c/' | '/caja/' | '/admin/'
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  // En desarrollo desactivamos y limpiamos Service Workers/cachés previos para evitar
  // que el navegador muestre versiones antiguas tras cambios en caliente.
  if (import.meta.env.DEV) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      // Ignore dev cleanup errors
    }
    return null;
  }

  try {
    const hadController = Boolean(navigator.serviceWorker.controller);
    if (!swControllerReloadBound && hadController) {
      swControllerReloadBound = true;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }

    const registration = await navigator.serviceWorker.register(swUrl, {
      scope,
      updateViaCache: 'none',
    });
    void registration.update();
    return registration;
  } catch (err) {
    console.warn(`[PWA] No se pudo registrar el service worker (${swUrl}):`, err);
    return null;
  }
}
