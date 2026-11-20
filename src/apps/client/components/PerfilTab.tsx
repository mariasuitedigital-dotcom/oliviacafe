import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  Bell,
  BellRing,
  Cake,
  CheckCircle2,
  ExternalLink,
  History,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  Save,
  ShieldCheck,
} from 'lucide-react';
import type { Cartilla, Cliente } from '@/src/types/database';
import { useTheme } from '@/src/shared/theme/ThemeProvider';

interface PerfilTabProps {
  cliente: Cliente;
  cartilla: Cartilla;
  mapsBonusClaimed: boolean;
  onActivatePushAndBonus: () => Promise<{ granted: boolean; bonusGiven: boolean; error?: string }>;
  onUpdateProfile: (
    updates: Partial<
      Pick<
        Cliente,
        | 'nombre'
        | 'fecha_nacimiento_dia'
        | 'fecha_nacimiento_mes'
        | 'fecha_nacimiento_anio'
        | 'consentimiento_whatsapp'
        | 'consentimiento_push'
        | 'contacto_guardado'
        | 'baja_whatsapp'
      >
    >
  ) => Promise<void>;
  onClaimMapsBonus: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenHistorial?: () => void;
}

const MESES_PERU = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const PerfilTab: React.FC<PerfilTabProps> = ({
  cliente,
  cartilla,
  mapsBonusClaimed,
  onActivatePushAndBonus,
  onUpdateProfile,
  onClaimMapsBonus,
  onSignOut,
  onOpenHistorial,
}) => {
  const { negocio } = useTheme();

  const [nombre, setNombre] = useState(cliente.nombre);
  const [diaNac, setDiaNac] = useState<number>(cliente.fecha_nacimiento_dia || 15);
  const [mesNac, setMesNac] = useState<number>(cliente.fecha_nacimiento_mes || 5);
  const [anioNac, setAnioNac] = useState<string>(
    cliente.fecha_nacimiento_anio ? String(cliente.fecha_nacimiento_anio) : ''
  );

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);

  const [pushStatusMsg, setPushStatusMsg] = useState<string | null>(null);
  const [pushErrorMsg, setPushErrorMsg] = useState<string | null>(null);
  const [testingAlert, setTestingAlert] = useState(false);

  const [confirmOptOut, setConfirmOptOut] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const notifSupported = typeof window !== 'undefined' && 'Notification' in window;

  const initials = cliente.nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length < 2) return;
    setSavingProfile(true);
    setProfileSavedMsg(null);
    try {
      await onUpdateProfile({
        nombre: nombre.trim(),
        fecha_nacimiento_dia: diaNac,
        fecha_nacimiento_mes: mesNac,
        fecha_nacimiento_anio: anioNac.trim() ? Number(anioNac.trim()) : null,
      });
      setProfileSavedMsg('Tus datos y fecha de cumpleaños fueron guardados.');
      window.setTimeout(() => setProfileSavedMsg(null), 3500);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTestNotification = async () => {
    setPushErrorMsg(null);
    setPushStatusMsg(null);
    if (!notifSupported) {
      setPushErrorMsg('Este navegador no soporta Web Push.');
      return;
    }

    setTestingAlert(true);
    try {
      let perm = Notification.permission;
      if (perm === 'default') {
        const res = await onActivatePushAndBonus();
        if (!res.granted) {
          setPushErrorMsg(res.error || 'Permiso de notificación rechazado.');
          return;
        }
        perm = 'granted';
      }

      if (perm !== 'granted') {
        setPushErrorMsg(
          'Las notificaciones están bloqueadas en este navegador. Habilítalas en los ajustes del sitio.'
        );
        return;
      }

      const title = `${negocio.nombre} · Alerta de prueba`;
      const options: NotificationOptions = {
        body: `¡Hola ${cliente.nombre.split(' ')[0]}! Tus notificaciones funcionan perfecto (${cartilla.sellos_actuales}/${cartilla.sellos_objetivo} sellos).`,
        icon: '/icons/client-192x192.png',
        badge: '/icons/client-192x192.png',
        tag: 'olivia-test-alert',
      };

      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration('/c/');
        if (reg && 'showNotification' in reg) {
          await reg.showNotification(title, options);
          setPushStatusMsg('Alerta de prueba enviada a tu dispositivo.');
          return;
        }
      }

      new Notification(title, options);
      setPushStatusMsg('Alerta de prueba enviada correctamente.');
    } catch {
      setPushErrorMsg('No se pudo mostrar la alerta local en este dispositivo.');
    } finally {
      setTestingAlert(false);
    }
  };

  const handleConfirmBaja = async () => {
    await onUpdateProfile({
      baja_whatsapp: true,
      consentimiento_whatsapp: false,
    });
    setConfirmOptOut(false);
  };

  const handleReactivateWhatsApp = async () => {
    await onUpdateProfile({
      baja_whatsapp: false,
      consentimiento_whatsapp: true,
    });
  };

  return (
    <div className="space-y-5">
      {/* Cabecera Perfil */}
      <section className="rounded-3xl bg-white p-5 sm:p-6 border border-black/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0F4C45] text-[#F2B632] flex items-center justify-center text-base font-bold shrink-0">
            {initials || 'CL'}
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#14201E]">{cliente.nombre}</h1>
            <p className="text-xs text-[#546560] tabular-nums flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3.5 h-3.5 text-[#0F4C45]" />
              <span>{cliente.celular}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono font-semibold text-[#14201E]">{cartilla.codigo_corto}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          {onOpenHistorial && (
            <button
              type="button"
              onClick={onOpenHistorial}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#F3F6F4] hover:bg-[#E8F1EE] text-[#0F4C45] px-3.5 py-2 text-xs font-bold"
            >
              <History className="w-3.5 h-3.5" />
              <span>Ver historial</span>
            </button>
          )}
          <div className="inline-flex items-center gap-2 rounded-xl bg-[#FEF6E0] text-[#7A5600] px-3.5 py-2 text-xs font-bold">
            <Award className="w-4 h-4" />
            <span>Nivel {cartilla.nivel}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Datos personales y cumpleaños */}
        <form
          onSubmit={handleSavePersonal}
          className="rounded-3xl bg-white p-5 sm:p-6 border border-black/5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#14201E]">Mis Datos y Cumpleaños</h2>
            <span className="text-[11px] font-semibold text-[#0F4C45] inline-flex items-center gap-1">
              <Cake className="w-3.5 h-3.5" /> Regalo anual
            </span>
          </div>

          <div>
            <label htmlFor="perfil-nombre" className="block text-xs font-semibold text-[#14201E] mb-1.5">
              Nombre completo
            </label>
            <input
              id="perfil-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-xl bg-[#F3F6F4] px-4 py-3 text-sm text-[#14201E] focus:outline-none focus:ring-2 focus:ring-[#0F4C45] min-h-[44px]"
              required
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-[#14201E] mb-1.5">
              Fecha de cumpleaños
            </span>
            <div className="grid grid-cols-3 gap-2">
              <select
                aria-label="Día de nacimiento"
                value={diaNac}
                onChange={(e) => setDiaNac(Number(e.target.value))}
                className="w-full rounded-xl bg-[#F3F6F4] px-3 py-3 text-sm tabular-nums text-[#14201E] focus:outline-none focus:ring-2 focus:ring-[#0F4C45] min-h-[44px]"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    Día {d}
                  </option>
                ))}
              </select>
              <select
                aria-label="Mes de nacimiento"
                value={mesNac}
                onChange={(e) => setMesNac(Number(e.target.value))}
                className="w-full rounded-xl bg-[#F3F6F4] px-3 py-3 text-sm text-[#14201E] focus:outline-none focus:ring-2 focus:ring-[#0F4C45] min-h-[44px]"
              >
                {MESES_PERU.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                aria-label="Año de nacimiento opcional"
                type="number"
                min={1925}
                max={2015}
                value={anioNac}
                onChange={(e) => setAnioNac(e.target.value)}
                placeholder="Año (opc.)"
                className="w-full rounded-xl bg-[#F3F6F4] px-3 py-3 text-sm tabular-nums text-[#14201E] placeholder:text-[#7B8B86] focus:outline-none focus:ring-2 focus:ring-[#0F4C45] min-h-[44px]"
              />
            </div>
          </div>

          {profileSavedMsg && (
            <p className="rounded-xl bg-[#E8F1EE] text-[#0F4C45] px-3.5 py-2.5 text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{profileSavedMsg}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="w-full rounded-xl bg-[#0F4C45] py-3 px-4 text-xs font-bold text-white flex items-center justify-center gap-2 min-h-[44px] hover:opacity-95 transition"
          >
            <Save className="w-4 h-4" />
            <span>{savingProfile ? 'Guardando...' : 'Guardar cambios'}</span>
          </button>
        </form>

        {/* Preferencias de comunicación y prueba de alerta */}
        <section className="rounded-3xl bg-white p-5 sm:p-6 border border-black/5 shadow-sm space-y-4">
          <div>
            <h2 className="text-base font-bold text-[#14201E]">Preferencias de Avisos</h2>
            <p className="text-xs text-[#546560]">Administra tus canales y prueba alertas en tu equipo.</p>
          </div>

          <div className="space-y-2.5">
            <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#F3F6F4] cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-[#0F4C45]" />
                <div>
                  <p className="text-xs font-bold text-[#14201E]">Notificaciones Push</p>
                  <p className="text-[11px] text-[#546560]">Avisos directos sin costo ni SMS</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={cliente.consentimiento_push}
                onChange={(e) => void onUpdateProfile({ consentimiento_push: e.target.checked })}
                className="w-5 h-5 accent-[#0F4C45]"
              />
            </label>

            <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#F3F6F4] cursor-pointer">
              <div className="flex items-center gap-2.5">
                <MessageCircle className="w-4 h-4 text-[#0F4C45]" />
                <div>
                  <p className="text-xs font-bold text-[#14201E]">Avisos por WhatsApp</p>
                  <p className="text-[11px] text-[#546560]">
                    {cliente.baja_whatsapp
                      ? 'Diste de baja los mensajes promocionales'
                      : 'Recordatorio a 1 sello del premio y regalo de cumpleaños'}
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                disabled={cliente.baja_whatsapp}
                checked={cliente.consentimiento_whatsapp && !cliente.baja_whatsapp}
                onChange={(e) => void onUpdateProfile({ consentimiento_whatsapp: e.target.checked })}
                className="w-5 h-5 accent-[#0F4C45]"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={testingAlert}
            onClick={() => void handleTestNotification()}
            className="w-full rounded-xl bg-[#F3F6F4] text-[#14201E] px-4 py-3 text-xs font-bold flex items-center justify-center gap-2 min-h-[44px] hover:bg-[#E8F1EE] transition"
          >
            <BellRing className="w-4 h-4 text-[#0F4C45]" />
            <span>{testingAlert ? 'Enviando prueba...' : 'Probar alerta en este dispositivo'}</span>
          </button>

          {pushStatusMsg && (
            <p className="rounded-xl bg-[#E8F1EE] text-[#0F4C45] px-3.5 py-2.5 text-xs font-semibold">
              {pushStatusMsg}
            </p>
          )}
          {pushErrorMsg && (
            <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3.5 py-2.5 text-xs font-medium">
              {pushErrorMsg}
            </p>
          )}
        </section>
      </div>

      {/* Reseña Google Maps (+10 pts) */}
      <section className="rounded-3xl bg-white p-5 sm:p-6 border border-black/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FEF6E0] text-[#7A5600] flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#14201E]">Reseña en Google Maps</h2>
            <p className="text-xs text-[#546560] mt-0.5 leading-relaxed">
              Cuéntale a otros amantes del café qué te pareció tu visita y suma{' '}
              <strong className="text-[#0F4C45]">+10 puntos de bonificación</strong>.
            </p>
          </div>
        </div>

        <a
          href={negocio.google_maps_url || 'https://maps.google.com'}
          target="_blank"
          rel="noreferrer"
          onClick={() => void onClaimMapsBonus()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F3F6F4] hover:bg-[#E8F1EE] px-4 py-3 text-xs font-bold text-[#14201E] min-h-[44px] whitespace-nowrap transition shrink-0"
        >
          <span>
            {mapsBonusClaimed
              ? 'Reseña compartida (+10 pts ✓)'
              : 'Dejar reseña (+10 pts)'}
          </span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </section>

      {/* Privacidad Ley 29733, Baja de mensajes y Cerrar sesión */}
      <section className="rounded-3xl bg-white p-5 sm:p-6 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#0F4C45] shrink-0 mt-0.5" />
          <div className="text-xs text-[#4A5A56] leading-relaxed">
            <p className="font-bold text-[#14201E]">Privacidad y Baja de Mensajes (Ley N° 29733)</p>
            <p className="mt-1">{negocio.texto_privacidad}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-black/5">
          {cliente.baja_whatsapp ? (
            <button
              type="button"
              onClick={() => void handleReactivateWhatsApp()}
              className="text-xs font-bold text-[#0F4C45] underline text-left"
            >
              Reactivar avisos por WhatsApp
            </button>
          ) : confirmOptOut ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-50 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
              <span className="text-xs font-medium text-red-800">¿Dejar de recibir mensajes por WhatsApp?</span>
              <button
                type="button"
                onClick={() => void handleConfirmBaja()}
                className="rounded-lg bg-red-700 text-white px-2.5 py-1 text-[11px] font-bold"
              >
                Confirmar baja
              </button>
              <button
                type="button"
                onClick={() => setConfirmOptOut(false)}
                className="rounded-lg bg-white text-[#14201E] px-2.5 py-1 text-[11px] font-semibold"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmOptOut(true)}
              className="text-xs font-semibold text-[#6A7B76] hover:text-red-700 underline text-left"
            >
              Darme de baja de mensajes WhatsApp
            </button>
          )}

          {confirmSignOut ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FEF6E0] border border-[#F2B632]/40 px-3 py-2">
              <span className="text-xs font-medium text-[#14201E]">
                ¿Salir? Te pedirá tu celular al volver.
              </span>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="rounded-lg bg-[#14201E] text-white px-2.5 py-1 text-[11px] font-bold"
              >
                Salir igual
              </button>
              <button
                type="button"
                onClick={() => setConfirmSignOut(false)}
                className="rounded-lg bg-white text-[#14201E] px-2.5 py-1 text-[11px] font-semibold"
              >
                Mantener sesión
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmSignOut(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F3F6F4] hover:bg-red-50 hover:text-red-700 px-4 py-2.5 text-xs font-bold text-[#14201E] transition min-h-[40px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cambiar cuenta / Salir</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
