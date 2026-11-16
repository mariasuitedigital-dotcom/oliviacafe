import React, { useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Lock,
  RefreshCw,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';
import {
  createOwnerByRootLocal,
  DEFAULT_ROOT_DEV_KEY,
  generateNumericDigits,
  listLocalAccounts,
  resetAccountOtpActivationLocal,
  toggleAccountActiveLocal,
  type ProvisionedAccount,
} from '@/src/shared/auth/accessProvisioning';
import { getSupabaseClient } from '@/src/shared/lib/supabase';

interface RootProvisioningModalProps {
  open: boolean;
  negocioId: string;
  negocioNombre: string;
  supabaseReady: boolean;
  onClose: () => void;
}

export const RootProvisioningModal: React.FC<RootProvisioningModalProps> = ({
  open,
  negocioId,
  negocioNombre,
  supabaseReady,
  onClose,
}) => {
  const [rootUnlocked, setRootUnlocked] = useState(false);
  const [rootKeyInput, setRootKeyInput] = useState('');
  const [rootError, setRootError] = useState<string | null>(null);

  const [owners, setOwners] = useState<ProvisionedAccount[]>(() =>
    listLocalAccounts().filter((a) => a.rol === 'owner')
  );
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [celularOtp, setCelularOtp] = useState('');
  const [clave8, setClave8] = useState(() => generateNumericDigits(8));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!open) return null;

  const refreshOwners = () => {
    setOwners(listLocalAccounts().filter((a) => a.rol === 'owner'));
  };

  const handleUnlockRoot = (e: React.FormEvent) => {
    e.preventDefault();
    setRootError(null);
    if (rootKeyInput.trim() !== DEFAULT_ROOT_DEV_KEY) {
      setRootError('Clave maestra Root incorrecta.');
      return;
    }
    setRootUnlocked(true);
    refreshOwners();
  };

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    setRootError(null);
    setFeedback(null);

    const digits9 = celularOtp.replace(/\D/g, '').slice(-9);
    const phonePe = digits9.length === 9 ? `+51${digits9}` : celularOtp.trim();

    if (!/^[0-9]{8}$/.test(clave8)) {
      setRootError('La clave del dueño debe tener exactamente 8 dígitos.');
      return;
    }

    const supabase = getSupabaseClient();
    if (supabase && supabaseReady) {
      const { error } = await supabase.rpc('root_crear_dueno', {
        p_negocio_id: negocioId,
        p_nombre: nombre.trim(),
        p_email: email.trim(),
        p_celular_otp: phonePe,
        p_clave_8_digitos: clave8,
      });
      if (error) {
        setRootError(error.message);
        return;
      }
      setFeedback(`Dueño ${nombre.trim()} aprovisionado en Supabase. Pedirá OTP en su primer ingreso.`);
      setNombre('');
      setEmail('');
      setCelularOtp('');
      setClave8(generateNumericDigits(8));
      return;
    }

    const res = createOwnerByRootLocal({
      negocio_id: negocioId,
      nombre_completo: nombre,
      email: email.trim() || 'dueno@oliviacafe.pe',
      celular_otp: phonePe,
      clave_8_digitos: clave8,
    });

    if (!res.ok) {
      setRootError(res.error || 'No se pudo crear el dueño.');
      return;
    }

    refreshOwners();
    setFeedback(`Clave de 8 dígitos (${clave8}) creada. Exigirá OTP al primer ingreso.`);
    setNombre('');
    setEmail('');
    setCelularOtp('');
    setClave8(generateNumericDigits(8));
  };

  const handleCopyKey = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard errors
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Consola Root Desarrollador"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-black/10 space-y-5 my-auto">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-black/5">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/Captura_de_Pantalla_2026-11-14_a_la_s__13.37.51_9d5343a3.png"
              alt="MarIA Sistemas Digitales"
              className="w-10 h-10 rounded-2xl object-cover border border-black/10 shrink-0"
            />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F4C45]">
                Root · MarIA Sistemas Digitales
              </p>
              <h2 className="text-lg font-bold text-[#14201E]">
                Provisión de Claves de Dueño (8 dígitos) · {negocioNombre}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 bg-[#F3F6F4] hover:bg-[#E4EBE7] text-[#14201E]"
            aria-label="Cerrar consola Root"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!rootUnlocked ? (
          <form onSubmit={handleUnlockRoot} className="space-y-4">
            <div className="rounded-2xl bg-[#F7F9F8] p-4 border border-black/5 text-xs text-[#354440]">
              Acceso exclusivo para el desarrollador (Root). Ingresa tu clave maestra para emitir credenciales de 8 dígitos para Dueños.
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14201E] mb-1.5">
                Clave maestra Root
              </label>
              <div className="flex items-center gap-2 rounded-xl bg-[#F3F6F4] px-3.5">
                <Lock className="w-4 h-4 text-[#546560]" />
                <input
                  type="password"
                  inputMode="numeric"
                  value={rootKeyInput}
                  onChange={(e) => setRootKeyInput(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-transparent py-3 text-center text-lg font-mono font-bold tracking-[0.35em] text-[#14201E] focus:outline-none min-h-[46px]"
                  required
                />
              </div>
            </div>

            {rootError && (
              <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3.5 py-2.5 text-xs font-medium">
                {rootError}
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-[#14201E] py-3.5 text-sm font-bold text-white min-h-[46px]"
            >
              Desbloquear Consola Root
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            {/* Formulario crear dueño */}
            <form
              onSubmit={handleCreateOwner}
              className="rounded-2xl bg-[#F7F9F8] p-4 border border-black/5 space-y-3"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F4C45] flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" />
                <span>Emitir nueva clave de Dueño (8 dígitos)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre del dueño (ej. Andrea G.)"
                  className="rounded-xl bg-white border border-black/10 px-3.5 py-2.5 text-xs min-h-[42px]"
                  required
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Correo opcional (ej. dueno@oliviacafe.pe)"
                  className="rounded-xl bg-white border border-black/10 px-3.5 py-2.5 text-xs min-h-[42px]"
                />
                <input
                  type="tel"
                  value={celularOtp}
                  onChange={(e) => setCelularOtp(e.target.value)}
                  placeholder="WhatsApp OTP (ej. 987111222)"
                  className="rounded-xl bg-white border border-black/10 px-3.5 py-2.5 text-xs font-mono min-h-[42px]"
                  required
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    pattern="[0-9]{8}"
                    value={clave8}
                    onChange={(e) => setClave8(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="8 dígitos"
                    className="flex-1 rounded-xl bg-white border border-black/10 px-3.5 py-2.5 text-sm font-mono font-bold tracking-widest min-h-[42px]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setClave8(generateNumericDigits(8))}
                    title="Generar 8 dígitos aleatorios"
                    className="rounded-xl bg-[#FEF6E0] px-3 py-2.5 text-[#7A5600] hover:bg-[#FDECB8] min-h-[42px]"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {rootError && (
                <p role="alert" className="rounded-xl bg-red-50 text-red-700 px-3 py-2 text-xs font-medium">
                  {rootError}
                </p>
              )}
              {feedback && (
                <p role="status" className="rounded-xl bg-[#E8F1EE] text-[#0F4C45] px-3 py-2 text-xs font-bold">
                  {feedback}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0F4C45] px-4 py-2.5 text-xs font-bold text-white min-h-[42px]"
                >
                  <KeyRound className="w-4 h-4 text-[#F2B632]" />
                  <span>Crear clave de Dueño</span>
                </button>
              </div>
            </form>

            {/* Lista de Dueños aprovisionados */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#14201E]">
                Dueños aprovisionados ({owners.length})
              </p>
              <div className="divide-y divide-black/5 rounded-2xl border border-black/5 max-h-56 overflow-y-auto">
                {owners.map((owner) => (
                  <div
                    key={owner.id}
                    className="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#14201E]">{owner.nombre_completo}</span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                            owner.primer_ingreso_pendiente
                              ? 'bg-[#FEF6E0] text-[#7A5600]'
                              : 'bg-[#E8F1EE] text-[#0F4C45]'
                          }`}
                        >
                          {owner.primer_ingreso_pendiente ? 'Pendiente OTP 1.er ingreso' : 'Activado'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#546560] mt-0.5">
                        {owner.email} · OTP: {owner.celular_otp} · Clave:{' '}
                        <code className="font-mono font-bold text-[#0F4C45]">{owner.clave_acceso}</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleCopyKey(owner.id, owner.clave_acceso)}
                        className="rounded-lg bg-[#F3F6F4] p-2 text-[#14201E] hover:bg-[#E8F1EE]"
                        aria-label="Copiar clave de 8 dígitos"
                      >
                        {copiedId === owner.id ? (
                          <Check className="w-3.5 h-3.5 text-[#0F4C45]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {!owner.primer_ingreso_pendiente && (
                        <button
                          type="button"
                          onClick={() => {
                            resetAccountOtpActivationLocal(owner.id);
                            refreshOwners();
                          }}
                          className="rounded-lg bg-[#F3F6F4] px-2.5 py-1.5 text-[11px] font-bold text-[#354440] hover:bg-[#E4EBE7] inline-flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reset OTP</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          toggleAccountActiveLocal(owner.id);
                          refreshOwners();
                        }}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                          owner.activo ? 'bg-[#E8F1EE] text-[#0F4C45]' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {owner.activo ? 'Activo' : 'Bloqueado'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
