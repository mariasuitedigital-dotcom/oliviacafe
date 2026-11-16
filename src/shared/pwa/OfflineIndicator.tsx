import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from './useOnlineStatus';

interface OfflineIndicatorProps {
  message?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  message = 'Sin conexión — usando datos en caché local.',
}) => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 flex items-center gap-2 rounded-xl bg-[#14201E] px-4 py-2.5 text-xs font-medium text-white shadow-lg border border-white/10"
    >
      <WifiOff className="w-4 h-4 text-[var(--brand-secondary)] shrink-0" />
      <span>{message}</span>
    </div>
  );
};
