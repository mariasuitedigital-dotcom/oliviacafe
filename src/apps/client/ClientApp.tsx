import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CreditCard, Gift, History, Sparkles, Tag, User, Volume2, VolumeX, X } from 'lucide-react';
import { AuthProvider, useAuth } from '@/src/shared/auth/AuthContext';
import { ThemeProvider, useTheme } from '@/src/shared/theme/ThemeProvider';
import { AppHeader } from '@/src/shared/components/AppHeader';
import { OfflineIndicator } from '@/src/shared/pwa/OfflineIndicator';
import { PWAInstallBanner } from '@/src/shared/pwa/PWAInstallBanner';
import { PortalAccesoView } from '@/src/shared/components/PortalAccesoView';
import { ClientSplashScreen } from '@/src/shared/components/ClientSplashScreen';
import { MarIaDeveloperFooter } from '@/src/shared/components/MarIaDeveloperFooter';
import { RootProvisioningModal } from '@/src/apps/admin/components/RootProvisioningModal';
import {
  getSplashSoundMuted,
  setSplashSoundMuted,
  unlockAudioContext,
} from '@/src/shared/pwa/welcomeSound';
import { useClientData } from '@/src/apps/client/hooks/useClientData';
import { CartillaTab } from '@/src/apps/client/components/CartillaTab';
import { PromosTab } from '@/src/apps/client/components/PromosTab';
import { HistorialTab } from '@/src/apps/client/components/HistorialTab';
import { PerfilTab } from '@/src/apps/client/components/PerfilTab';

type ClientTab = 'cartilla' | 'promos' | 'historial' | 'perfil';

function resolveTabFromPath(pathname: string): ClientTab {
  if (pathname.includes('/promos')) return 'promos';
  if (pathname.includes('/historial')) return 'historial';
  if (pathname.includes('/perfil')) return 'perfil';
  return 'cartilla';
}

const ClientAuthAndShell: React.FC = () => {
  const { negocioSlug = 'olivia' } = useParams<{ negocioSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { negocio } = useTheme();
  const { user, role, clientSession, signOut, supabaseReady } = useAuth();

  const [activeTab, setActiveTab] = useState<ClientTab>(() =>
    resolveTabFromPath(location.pathname)
  );
  const [rootModalOpen, setRootModalOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState<boolean>(() => getSplashSoundMuted());

  useEffect(() => {
    const pathTab = resolveTabFromPath(location.pathname);
    setActiveTab(pathTab);
  }, [location.pathname]);

  useEffect(() => {
    const handleUnlock = () => {
      void unlockAudioContext();
    };
    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handleUnlock);
    };
  }, []);

  const toggleSoundMuted = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setSplashSoundMuted(next);
  };

  const isAuthenticated =
    (Boolean(user) && role === 'customer') ||
    (Boolean(clientSession) && clientSession?.negocio_slug === negocioSlug);

  const {
    loading,
    error,
    cliente,
    cartilla,
    sellos,
    canjes,
    promos,
    cupones,
    qrState,
    ratedToday,
    mapsBonusClaimed,
    stampCelebration,
    dismissStampCelebration,
    refreshQrToken,
    activarPromo,
    enviarEncuesta,
    reclamarBonusMaps,
    activarPushYBonus,
    actualizarPerfil,
  } = useClientData();

  if (!isAuthenticated) {
    return (
      <>
        <PortalAccesoView />
        <OfflineIndicator />
      </>
    );
  }

  const handleTabChange = (tab: ClientTab) => {
    setActiveTab(tab);
    const base = `/c/${negocioSlug}`;
    const target = tab === 'cartilla' ? base : `${base}/${tab}`;
    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
  };

  const activeCuponesCount = cupones.filter((c) => c.estado === 'activo').length;

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--brand-tertiary)]">
      <AppHeader
        identity="Cliente"
        appShortTitle="Mi Cartilla"
        userLabel={cliente?.nombre || clientSession?.nombre || user?.phone || null}
        onSignOut={signOut}
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 pb-24 space-y-5">
        <PWAInstallBanner
          appName={negocio.nombre}
          whatsappNumber={negocio.whatsapp_contacto_numero || '+51987111222'}
          negocioSlug={negocio.slug}
          onActivatePush={async () => {
            await activarPushYBonus();
          }}
          mandatoryModal
        />

        {stampCelebration && (
          <section
            role="status"
            aria-live="polite"
            className={`rounded-3xl p-4 shadow-md border flex items-start gap-3 transition-all ${
              stampCelebration.isGoalReached || stampCelebration.kind === 'redeem'
                ? 'bg-[#FEF6E0] border-[#F2B632] text-[#14201E]'
                : 'bg-[#0F4C45] border-[#0F4C45] text-white'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                stampCelebration.isGoalReached || stampCelebration.kind === 'redeem'
                  ? 'bg-[#F2B632] text-[#14201E]'
                  : 'bg-[#F2B632]/20 text-[#F2B632]'
              }`}
            >
              {stampCelebration.isGoalReached || stampCelebration.kind === 'redeem' ? (
                <Gift className="w-5 h-5" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold leading-snug">{stampCelebration.title}</p>
                <span
                  className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    stampCelebration.isGoalReached || stampCelebration.kind === 'redeem'
                      ? 'bg-[#14201E] text-[#F2B632]'
                      : 'bg-[#F2B632] text-[#14201E]'
                  }`}
                >
                  {stampCelebration.badgeText}
                </span>
              </div>
              <p
                className={`text-xs mt-1 leading-relaxed ${
                  stampCelebration.isGoalReached || stampCelebration.kind === 'redeem'
                    ? 'text-[#3F4E49]'
                    : 'text-white/85'
                }`}
              >
                {stampCelebration.body}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={toggleSoundMuted}
                aria-label={soundMuted ? 'Activar sonidos' : 'Silenciar sonidos'}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${
                  stampCelebration.isGoalReached || stampCelebration.kind === 'redeem'
                    ? 'hover:bg-black/5 text-[#546560]'
                    : 'hover:bg-white/10 text-white/80'
                }`}
              >
                {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={dismissStampCelebration}
                aria-label="Cerrar aviso"
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${
                  stampCelebration.isGoalReached || stampCelebration.kind === 'redeem'
                    ? 'hover:bg-black/5 text-[#546560]'
                    : 'hover:bg-white/10 text-white/80'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 text-red-700 px-4 py-3 text-xs font-medium">
            {error}
          </p>
        )}

        {loading || !cliente || !cartilla ? (
          <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Cargando cartilla">
            <div className="h-12 rounded-2xl bg-white/70 w-2/3" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7 h-72 rounded-3xl bg-[#0F4C45]/20" />
              <div className="lg:col-span-5 h-72 rounded-3xl bg-white/80" />
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'cartilla' && (
              <CartillaTab
                cliente={cliente}
                cartilla={cartilla}
                qrState={qrState}
                ratedToday={ratedToday}
                mapsBonusClaimed={mapsBonusClaimed}
                onRefreshQr={() => void refreshQrToken()}
                onRate={enviarEncuesta}
                onClaimMapsBonus={reclamarBonusMaps}
              />
            )}

            {activeTab === 'promos' && (
              <PromosTab
                promos={promos}
                cupones={cupones}
                onActivatePromo={activarPromo}
              />
            )}

            {activeTab === 'historial' && (
              <HistorialTab
                cliente={cliente}
                cartilla={cartilla}
                sellos={sellos}
                canjes={canjes}
              />
            )}

            {activeTab === 'perfil' && (
              <PerfilTab
                cliente={cliente}
                cartilla={cartilla}
                mapsBonusClaimed={mapsBonusClaimed}
                onActivatePushAndBonus={activarPushYBonus}
                onUpdateProfile={actualizarPerfil}
                onClaimMapsBonus={reclamarBonusMaps}
                onSignOut={signOut}
              />
            )}
          </>
        )}
      </main>

      <nav
        aria-label="Navegación de cliente"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-black/10 pwa-safe-bottom pwa-ui-noselect"
      >
        <div className="max-w-lg mx-auto grid grid-cols-4 h-16">
          {[
            { id: 'cartilla' as const, label: 'Mi Cartilla', icon: CreditCard, badge: 0 },
            {
              id: 'promos' as const,
              label: 'Promos',
              icon: Tag,
              badge: activeCuponesCount || promos.length,
            },
            { id: 'historial' as const, label: 'Historial', icon: History, badge: 0 },
            { id: 'perfil' as const, label: 'Perfil', icon: User, badge: 0 },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabChange(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
                  active ? 'text-[var(--brand-primary)]' : 'text-[#6A7B76]'
                }`}
              >
                <span className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#F2B632] text-[#14201E] text-[9px] font-bold flex items-center justify-center tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="pb-16">
        <MarIaDeveloperFooter onTriggerRoot={() => setRootModalOpen(true)} />
      </div>

      <RootProvisioningModal
        open={rootModalOpen}
        negocioId={negocio.id}
        negocioNombre={negocio.nombre}
        supabaseReady={supabaseReady}
        onClose={() => setRootModalOpen(false)}
      />

      <OfflineIndicator />
    </div>
  );
};

const ClientSlugWrapper: React.FC<{ showSplash?: boolean }> = ({ showSplash = false }) => {
  const { negocioSlug = 'olivia' } = useParams<{ negocioSlug: string }>();
  return (
    <ThemeProvider negocioSlug={negocioSlug}>
      {showSplash && <ClientSplashScreen />}
      <ClientAuthAndShell />
    </ThemeProvider>
  );
};

export interface ClientAppProps {
  withAuthProvider?: boolean;
}

export default function ClientApp({ withAuthProvider = true }: ClientAppProps) {
  const router = (
    <BrowserRouter>
      <Routes>
        <Route
          path="/c/:negocioSlug/*"
          element={<ClientSlugWrapper showSplash={withAuthProvider} />}
        />
        <Route path="/c/*" element={<Navigate to="/c/olivia" replace />} />
        <Route path="*" element={<Navigate to="/c/olivia" replace />} />
      </Routes>
    </BrowserRouter>
  );

  if (!withAuthProvider) {
    return router;
  }

  return <AuthProvider>{router}</AuthProvider>;
}
