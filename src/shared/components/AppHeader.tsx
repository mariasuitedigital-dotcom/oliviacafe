import React from 'react';
import { Coffee, LogOut } from 'lucide-react';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { PWAInstallBanner } from '@/src/shared/pwa/PWAInstallBanner';

export type AppIdentity = 'Cliente' | 'Caja' | 'Admin';

interface AppHeaderProps {
  identity: AppIdentity;
  appShortTitle: string;
  userLabel?: string | null;
  onSignOut?: () => void;
  rightSlot?: React.ReactNode;
}

const IDENTITY_STYLES: Record<AppIdentity, { bg: string; text: string }> = {
  Cliente: { bg: 'bg-[#E8F1EE]', text: 'text-[#0F4C45]' },
  Caja: { bg: 'bg-[#FEF3D1]', text: 'text-[#7A5600]' },
  Admin: { bg: 'bg-[#14201E]', text: 'text-white' },
};

export const AppHeader: React.FC<AppHeaderProps> = ({
  identity,
  appShortTitle,
  userLabel,
  onSignOut,
  rightSlot,
}) => {
  const { negocio } = useTheme();
  const badgeStyle = IDENTITY_STYLES[identity];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-black/5 pwa-safe-top pwa-ui-noselect">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center shrink-0 border-2 border-[var(--brand-secondary)]/60">
            {negocio.logo_url ? (
              <img
                src={negocio.logo_url}
                alt={negocio.nombre}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <Coffee className="w-4 h-4 text-[var(--brand-secondary)]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6A7B76] truncate">
              {negocio.nombre}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--brand-neutral)] truncate">
                {appShortTitle}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md whitespace-nowrap shrink-0 ${badgeStyle.bg} ${badgeStyle.text}`}
              >
                {identity}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallBanner appName={`${negocio.nombre} ${identity}`} compact />
          {rightSlot}
          {userLabel && onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              title={`Cerrar sesión (${userLabel})`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F3F6F4] px-3 py-2 text-xs font-semibold text-[var(--brand-neutral)] hover:bg-[#E4EBE7] transition min-h-[40px] whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
