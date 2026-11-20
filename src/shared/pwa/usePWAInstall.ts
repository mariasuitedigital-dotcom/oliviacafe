import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Captura global a nivel de módulo para no perder `beforeinstallprompt`
// aunque se dispare antes de que el usuario inicie sesión o cambie de pantalla.
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalInstalledFlag = false;
const promptSubscribers = new Set<() => void>();

function checkStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    globalInstalledFlag ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function notifySubscribers() {
  promptSubscribers.forEach((cb) => cb());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifySubscribers();
  });

  window.addEventListener('appinstalled', () => {
    globalInstalledFlag = true;
    globalDeferredPrompt = null;
    notifySubscribers();
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => globalDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkStandalone());
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);

  useEffect(() => {
    const syncState = () => {
      setDeferredPrompt(globalDeferredPrompt);
      setIsInstalled(checkStandalone());
    };

    syncState();
    promptSubscribers.add(syncState);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        globalInstalledFlag = true;
        setIsInstalled(true);
      }
    };

    mediaQuery.addEventListener('change', onDisplayModeChange);

    return () => {
      promptSubscribers.delete(syncState);
      mediaQuery.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  const install = useCallback(async () => {
    const promptEvent = globalDeferredPrompt || deferredPrompt;
    if (!promptEvent) return false;

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        globalInstalledFlag = true;
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        setIsInstalled(true);
        notifySubscribers();
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt || globalDeferredPrompt),
    isInstalled,
    isIOS,
    isInIframe,
    install,
  };
}
