import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import {
  Award,
  BarChart3,
  Bot,
  CheckCircle2,
  Coffee,
  FileSearch,
  KeyRound,
  Laptop,
  MessageSquare,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  Tag,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/src/shared/auth/AuthContext';
import { ThemeProvider, useTheme } from '@/src/shared/theme/ThemeProvider';
import { AppHeader } from '@/src/shared/components/AppHeader';
import { OfflineIndicator } from '@/src/shared/pwa/OfflineIndicator';
import {
  confirmarOtpPrimerIngreso,
  validarAccesoClaveConOtp,
} from '@/src/shared/auth/accessProvisioning';
import { useAdminData } from '@/src/apps/admin/hooks/useAdminData';
import { ResumenSection } from '@/src/apps/admin/components/ResumenSection';
import { ClientesSection } from '@/src/apps/admin/components/ClientesSection';
import { PromocionesSection } from '@/src/apps/admin/components/PromocionesSection';
import { AutomatizacionesSection } from '@/src/apps/admin/components/AutomatizacionesSection';
import { WhatsappSection } from '@/src/apps/admin/components/WhatsappSection';
import {
  AjustesSection,
  AuditoriaSection,
  EquipoSection,
  RecompensaSection,
} from '@/src/apps/admin/components/RecompensaEquipoAjustesSections';
import { RootProvisioningModal } from '@/src/apps/admin/components/RootProvisioningModal';
import { CartaSection } from '@/src/apps/admin/components/CartaSection';
import { EspaciosSection } from '@/src/apps/admin/components/EspaciosSection';
import { AppSplashScreen } from '@/src/shared/components/AppSplashScreen';
import { MarIaDeveloperFooter } from '@/src/shared/components/MarIaDeveloperFooter';

type AdminSection =
  | 'resumen'
  | 'clientes'
  | 'promociones'
  | 'carta'
  | 'espacios'
  | 'automatizaciones'
  | 'whatsapp'
  | 'recompensa'
  | 'equipo'
  | 'ajustes'
  | 'auditoria';

const ADMIN_NAV: Array<{
  id: AdminSection;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'resumen', label: 'Resumen', shortLabel: 'Resumen', icon: BarChart3 },
  { id: 'clientes', label: 'Clientes', shortLabel: 'Clientes', icon: Users },
  { id: 'promociones', label: 'Promociones', shortLabel: 'Promos', icon: Tag },
  { id: 'carta', label: 'Carta Digital', shortLabel: 'Catálogo', icon: Coffee },
  { id: 'espacios', label: 'Coworking & Mesas', shortLabel: 'Cowork', icon: Laptop },
  { id: 'automatizaciones', label: 'Automatizaciones', shortLabel: 'Flujos', icon: Bot },
  { id: 'whatsapp', label: 'WhatsApp', shortLabel: 'WhatsApp', icon: MessageSquare },
  { id: 'recompensa', label: 'Recompensa', shortLabel: 'Premio', icon: Award },
  { id: 'equipo', label: 'Equipo y POS', shortLabel: 'Equipo', icon: UserCog },
  { id: 'ajustes', label: 'Ajustes', shortLabel: 'Ajustes', icon: Settings },
  { id: 'auditoria', label: 'Auditoría', shortLabel: 'Auditoría', icon: FileSearch },
];

interface PendingOtpState {
  perfilId: string;
  nombre: string;
  email: string | null;
  destinoEnmascarado: string;
  demoOtpCode?: string;
}

const AdminWorkspace: React.FC = () => {
  const { negocio } = useTheme();
  const {
    user,
    role,
    ownerDemoSession,
    supabaseReady,
    setOwnerDemoSession,
    signOut,
  } = useAuth();

  const {
    loading,
    sedes,
    clientes,
    promociones,
    automatizaciones,
    dispositivos,
    cajeros,
    auditoria,
    encuestas,
    campanas,
    cartaItems,
    espaciosCoworking,
    reservasCoworking,
    evolutionStatus,
    actionToast,
    exportClientesCsv,
    crearPromocion,
    actualizarPromocion,
    eliminarPromocion,
    togglePromocion,
    lanzarCampana,
    updateAutomatizacion,
    toggleEvolutionStatus,
    crearDispositivo,
    crearCajero,
    resetCajeroOtp,
    toggleCajero,
    saveNegocioConfig,
    updateNiveles,
    crearSede,
    actualizarSede,
    toggleSede,
    eliminarSede,
    crearCartaItem,
    actualizarCartaItem,
    toggleCartaItem,
    eliminarCartaItem,
    crearEspacio,
    actualizarEspacio,
    toggleEspacio,
    eliminarEspacio,
  } = useAdminData(supabaseReady);

  // Flujo único: Clave de 8 dígitos creada por Root + OTP primer ingreso
  const [clave8, setClave8] = useState('');
  const [pendingOtp, setPendingOtp] = useState<PendingOtpState | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [rootModalOpen, setRootModalOpen] = useState(false);

  const [activeSection, setActiveSection] = useState<AdminSection>('resumen');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOwnerAuthenticated =
    (Boolean(user) && (role === 'owner' || role === 'superadmin')) ||
    Boolean(ownerDemoSession);

  const handleClave8Login = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await validarAccesoClaveConOtp({
        supabaseReady,
        negocioId: negocio.id,
        rolObjetivo: 'owner',
        clave: clave8.trim(),
      });

      if (!res.valido) {
        setErrorMsg(res.mensaje || 'Clave de 8 dígitos inválida.');
        return;
      }

      if (res.requiereOtp && res.perfilId) {
        setPendingOtp({
          perfilId: res.perfilId,
          nombre: res.nombreCompleto || 'Dueño',
          email: res.email || null,
          destinoEnmascarado: res.destinoEnmascarado || 'WhatsApp registrado',
          demoOtpCode: res.demoOtpCode,
        });
        setOtpInput('');
        return;
      }

      setOwnerDemoSession({ email: res.email || res.nombreCompleto || 'dueno@oliviacafe.pe' });
      setClave8('');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmFirstOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingOtp) return;
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await confirmarOtpPrimerIngreso({
        supabaseReady,
        perfilId: pendingOtp.perfilId,
        codigoOtp: otpInput.trim(),
      });
      if (!res.autorizado || !res.perfil) {
        setErrorMsg(res.mensaje || 'Código OTP incorrecto.');
        return;
      }
      setPendingOtp(null);
      setOtpInput('');
      setClave8('');
      setOwnerDemoSession({ email: res.perfil.email || res.perfil.nombre_completo });
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setPendingOtp(null);
    await signOut();
  };

  const handleSelectSection = (section: AdminSection) => {
    setActiveSection(section);
    setMobileDrawerOpen(false);
  };

  const bajaWhatsappCount = clientes.filter((c) => c.baja_whatsapp).length;
  const activeNavMeta = ADMIN_NAV.find((n) => n.id === activeSection);
  const isExtraSectionActive = ADMIN_NAV.slice(4).some((n) => n.id === activeSection);

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--brand-tertiary)]">
      <AppHeader
        identity="Admin"
        appShortTitle="Dueño"
        userLabel={isOwnerAuthenticated ? user?.email || ownerDemoSession?.email || 'Dueño' : null}
        onSignOut={isOwnerAuthenticated ? handleLogout : undefined}
      />

      {actionToast && (
        <div
          role="status"
          className="fixed top-16 right-4 z-50 rounded-2xl bg-[#14201E] text-white px-4 py-3 text-xs font-semibold shadow-lg flex items-center gap-2 border border-white/10"
        >
          <CheckCircle2 className="w-4 h-4 text-[#F2B632] shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {!isOwnerAuthenticated ? (
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <section className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-black/5 space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)]">
                Panel Ejecutivo · {negocio.nombre}
              </p>
              <h1 className="text-2xl font-bold text-[var(--brand-neutral)] mt-1">
                {pendingOtp ? 'Activación por OTP (1.er ingreso)' : 'Ingreso de Dueño'}
              </h1>
              <p className="text-xs text-[#546560] mt-1">
                {pendingOtp
                  ? `Enviamos un código OTP de 6 dígitos a ${pendingOtp.destinoEnmascarado} para activar tu acceso por única vez.`
                  : 'Ingresa únicamente con tu clave numérica de 8 dígitos.'}
              </p>
            </div>

            {pendingOtp ? (
              <form onSubmit={handleConfirmFirstOtp} className="space-y-4">
                {pendingOtp.demoOtpCode && (
                  <div className="rounded-2xl bg-[#FEF6E0] border border-[#F2B632]/40 p-3.5 text-xs text-[#7A5600]">
                    <p className="font-bold">WhatsApp OTP simulado ({pendingOtp.destinoEnmascarado}):</p>
                    <p className="mt-1">
                      Tu código de activación es{' '}
                      <strong className="font-mono text-sm tracking-widest text-[#14201E]">
                        {pendingOtp.demoOtpCode}
                      </strong>
                    </p>
                  </div>
                )}

                <div>
                  <label htmlFor="admin-first-otp" className="block text-xs font-semibold text-[var(--brand-neutral)] mb-1.5">
                    Código OTP de activación (6 dígitos)
                  </label>
                  <input
                    id="admin-first-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full rounded-xl bg-[#F3F6F4] px-4 py-3 text-center text-xl font-mono font-bold tracking-[0.35em] text-[var(--brand-neutral)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] min-h-[48px]"
                    required
                  />
                </div>

                {errorMsg && (
                  <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3.5 py-2.5 text-xs font-medium">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy || otpInput.length !== 6}
                  className="w-full rounded-xl bg-[var(--brand-primary)] py-3.5 text-sm font-bold text-white disabled:opacity-50 min-h-[48px]"
                >
                  {busy ? 'Activando cuenta...' : 'Confirmar OTP y Entrar'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPendingOtp(null);
                    setErrorMsg(null);
                  }}
                  className="w-full text-xs font-semibold text-[#546560] hover:underline"
                >
                  Volver a ingresar clave de 8 dígitos
                </button>
              </form>
            ) : (
              <form onSubmit={handleClave8Login} className="space-y-4">
                <div>
                  <label htmlFor="admin-clave-8" className="block text-xs font-semibold text-[var(--brand-neutral)] mb-1.5">
                    Clave de Dueño (8 dígitos)
                  </label>
                  <div className="flex items-center gap-2 rounded-xl bg-[#F3F6F4] px-3.5">
                    <KeyRound className="w-4 h-4 text-[#0F4C45] shrink-0" />
                    <input
                      id="admin-clave-8"
                      type="password"
                      inputMode="numeric"
                      maxLength={8}
                      value={clave8}
                      onChange={(e) => setClave8(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="••••••••"
                      className="w-full bg-transparent py-3 text-center text-lg font-mono font-bold tracking-[0.3em] text-[var(--brand-neutral)] focus:outline-none min-h-[48px]"
                      required
                    />
                  </div>
                </div>

                {errorMsg && (
                  <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3.5 py-2.5 text-xs font-medium">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy || clave8.length !== 8}
                  className="w-full rounded-xl bg-[var(--brand-primary)] py-3.5 text-sm font-bold text-white disabled:opacity-50 min-h-[48px]"
                >
                  {busy ? 'Validando clave...' : 'Ingresar al Panel Admin'}
                </button>
              </form>
            )}
          </section>
        </main>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row max-w-7xl w-full mx-auto">
          {/* Sidebar escritorio */}
          <aside className="hidden lg:flex lg:w-64 shrink-0 flex-col p-4 gap-1">
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectSection(item.id)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition text-left ${
                    active
                      ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                      : 'text-[#354440] hover:bg-white/70'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}

            <div className="mt-4 rounded-2xl bg-white/80 p-3.5 border border-black/5 text-[11px] text-[#4A5A56] space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#0F4C45]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D99B16]" />
                <span>Rol: {role || 'owner (activado OTP)'}</span>
              </div>
              <p className="text-[11px] text-[#6A7B76]">
                {sedes.length} sedes activas · Evolution {evolutionStatus}
              </p>
            </div>
          </aside>

          {/* Contenido principal Admin */}
          <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-10">
            {activeSection !== 'resumen' && (
              <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F4C45]">
                    {negocio.nombre} · Administración
                  </p>
                  <h1 className="text-xl font-bold text-[#14201E]">
                    {activeNavMeta?.label}
                  </h1>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[11px] font-bold text-[#354440] border border-black/5 self-start sm:self-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0F4C45]" />
                  <span>{sedes.length} sedes</span>
                </span>
              </div>
            )}

            {loading ? (
              <div className="rounded-3xl bg-white p-8 border border-black/5 text-center text-xs font-semibold text-[#546560]">
                Cargando métricas y configuración de {negocio.nombre}...
              </div>
            ) : (
              <>
                {activeSection === 'resumen' && (
                  <ResumenSection
                    negocio={negocio}
                    sedes={sedes}
                    clientes={clientes}
                    encuestas={encuestas}
                    onExportCsv={exportClientesCsv}
                    onNavigateSection={(sec) => handleSelectSection(sec)}
                    onSaveRoiParams={(updates) => saveNegocioConfig(updates)}
                    onReactivateInactive={() =>
                      lanzarCampana({
                        titulo: 'Reactivación Automática +15 días',
                        mensaje:
                          '¡Te extrañamos en Olivia Café! Vuelve esta semana y suma sellos en tu cartilla.',
                        audiencia: 'inactivos_15',
                        canal: 'whatsapp',
                      })
                    }
                  />
                )}

                {activeSection === 'clientes' && (
                  <ClientesSection clientes={clientes} onExportCsv={exportClientesCsv} />
                )}

                {activeSection === 'promociones' && (
                  <PromocionesSection
                    promociones={promociones}
                    campanas={campanas}
                    whatsappLimit={negocio.whatsapp_limite_diario}
                    onCreatePromo={crearPromocion}
                    onUpdatePromo={actualizarPromocion}
                    onTogglePromo={togglePromocion}
                    onDeletePromo={eliminarPromocion}
                    onLaunchCampaign={lanzarCampana}
                  />
                )}

                {activeSection === 'carta' && (
                  <CartaSection
                    items={cartaItems}
                    onCreateItem={crearCartaItem}
                    onUpdateItem={actualizarCartaItem}
                    onToggleItem={toggleCartaItem}
                    onDeleteItem={eliminarCartaItem}
                  />
                )}

                {activeSection === 'espacios' && (
                  <EspaciosSection
                    negocio={negocio}
                    sedes={sedes}
                    espacios={espaciosCoworking}
                    reservas={reservasCoworking}
                    onCreateEspacio={crearEspacio}
                    onUpdateEspacio={actualizarEspacio}
                    onToggleEspacio={toggleEspacio}
                    onDeleteEspacio={eliminarEspacio}
                    onNavigateAjustes={() => handleSelectSection('ajustes')}
                  />
                )}

                {activeSection === 'automatizaciones' && (
                  <AutomatizacionesSection
                    automatizaciones={automatizaciones}
                    onUpdate={updateAutomatizacion}
                  />
                )}

                {activeSection === 'whatsapp' && (
                  <WhatsappSection
                    negocio={negocio}
                    evolutionStatus={evolutionStatus}
                    bajaCount={bajaWhatsappCount}
                    onToggleStatus={toggleEvolutionStatus}
                    onSaveLimits={(updates) => saveNegocioConfig(updates)}
                  />
                )}

                {activeSection === 'recompensa' && (
                  <RecompensaSection
                    negocio={negocio}
                    onSaveRecompensa={(updates) => saveNegocioConfig(updates)}
                    onUpdateNiveles={updateNiveles}
                  />
                )}

                {activeSection === 'equipo' && (
                  <EquipoSection
                    sedes={sedes}
                    dispositivos={dispositivos}
                    cajeros={cajeros}
                    onCreateDispositivo={crearDispositivo}
                    onCreateCajero={crearCajero}
                    onResetCajeroOtp={resetCajeroOtp}
                    onToggleCajero={toggleCajero}
                    onCreateSede={crearSede}
                    onUpdateSede={actualizarSede}
                    onToggleSede={toggleSede}
                    onDeleteSede={eliminarSede}
                  />
                )}

                {activeSection === 'ajustes' && (
                  <AjustesSection
                    negocio={negocio}
                    onSaveAjustes={(updates) => saveNegocioConfig(updates)}
                  />
                )}

                {activeSection === 'auditoria' && (
                  <AuditoriaSection auditoria={auditoria} encuestas={encuestas} />
                )}
              </>
            )}
          </main>

          {/* Drawer móvil para acceder a las 5 secciones restantes */}
          {mobileDrawerOpen && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end">
              <div className="w-full rounded-t-3xl bg-white p-5 pb-8 space-y-3 shadow-2xl">
                <div className="flex items-center justify-between pb-2 border-b border-black/5">
                  <span className="text-sm font-bold text-[#14201E]">Más secciones de gestión</span>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerOpen(false)}
                    className="rounded-full p-2 bg-[#F3F6F4] text-[#14201E]"
                    aria-label="Cerrar menú"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {ADMIN_NAV.slice(4).map((item) => {
                    const Icon = item.icon;
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectSection(item.id)}
                        className={`flex items-center gap-2.5 rounded-2xl p-3.5 text-xs font-bold text-left ${
                          active
                            ? 'bg-[#0F4C45] text-white'
                            : 'bg-[#F3F6F4] text-[#14201E]'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Barra inferior móvil (4 accesos principales + Más) */}
          <nav
            aria-label="Navegación móvil de administrador"
            className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-black/10 pwa-safe-bottom"
          >
            <div className="grid grid-cols-5 h-16">
              {ADMIN_NAV.slice(0, 4).map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSection(item.id)}
                    className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold ${
                      active ? 'text-[var(--brand-primary)]' : 'text-[#6A7B76]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="truncate max-w-[64px]">{item.shortLabel}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(true)}
                className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold ${
                  isExtraSectionActive ? 'text-[var(--brand-primary)]' : 'text-[#6A7B76]'
                }`}
              >
                <MoreHorizontal className="w-4 h-4" />
                <span>Más</span>
              </button>
            </div>
          </nav>
        </div>
      )}

      <MarIaDeveloperFooter onTriggerRoot={() => setRootModalOpen(true)} />

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

interface AdminAppProps {
  withAuthProvider?: boolean;
}

export default function AdminApp({ withAuthProvider = true }: AdminAppProps) {
  const inner = (
    <ThemeProvider negocioSlug="olivia">
      {withAuthProvider && <AppSplashScreen appRole="admin" />}
      <BrowserRouter>
        <Routes>
          <Route path="/admin/*" element={<AdminWorkspace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );

  return withAuthProvider ? <AuthProvider>{inner}</AuthProvider> : inner;
}
