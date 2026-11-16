import { useCallback, useEffect, useState } from 'react';
import type { PosCashierSession } from '@/src/shared/auth/AuthContext';
import { getSupabaseClient } from '@/src/shared/lib/supabase';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useOnlineStatus } from '@/src/shared/pwa/useOnlineStatus';
import type { Cartilla, Cupon, NivelLealtad, Promocion } from '@/src/types/database';
import {
  addRecentPosActivity,
  enqueuePendingPosOp,
  listPendingPosOps,
  listRecentPosActivity,
  markPendingPosOpFailed,
  markRecentActivitySynced,
  removePendingPosOp,
  type PendingPosOp,
  type PosQueueEntry,
} from '@/src/apps/pos/offline/posOfflineQueue';

export interface PosCustomerView {
  id: string;
  negocio_id: string;
  nombre: string;
  celular_enmascarado: string;
  total_visitas: number;
  ultima_visita_at: string | null;
  cartilla: Cartilla;
}

export interface PosScannedCoupon {
  cupon: Cupon;
  promocion: Promocion;
  cliente_nombre: string;
  celular_enmascarado: string;
}

interface LocalPosRosterRecord extends PosCustomerView {
  match_digits: string;
}

interface LocalPosDemoDb {
  customers: LocalPosRosterRecord[];
  coupons: PosScannedCoupon[];
}

const POS_DEMO_DB_KEY = 'olivia_pos_demo_roster_v1';

function maskPhone9(digits9: string): string {
  const clean = digits9.replace(/\D/g, '').slice(-9);
  if (clean.length !== 9) return '***';
  return `${clean.slice(0, 3)} *** ${clean.slice(6)}`;
}

function buildInitialLocalPosDb(negocioId: string, objetivo: number): LocalPosDemoDb {
  const now = Date.now();
  return {
    customers: [
      {
        id: 'demo-client-1',
        negocio_id: negocioId,
        nombre: 'María Quispe',
        celular_enmascarado: maskPhone9('987654321'),
        match_digits: '987654321',
        total_visitas: 6,
        ultima_visita_at: new Date(now - 86400000).toISOString(),
        cartilla: {
          id: 'cartilla-demo-1',
          negocio_id: negocioId,
          cliente_id: 'demo-client-1',
          codigo_corto: '#OL-8942',
          sellos_actuales: 6,
          sellos_objetivo: objetivo,
          nivel: 'Bambú',
          sellos_historicos: 6,
          canjes_historicos: 1,
          puntos_bonus: 0,
          premio_disponible: false,
          bonus_instalacion_otorgado: false,
          updated_at: new Date(now - 86400000).toISOString(),
        },
      },
    ],
    coupons: [
      {
        cupon: {
          id: 'cup-demo-10',
          negocio_id: negocioId,
          promocion_id: 'promo-flat-white-combo',
          cliente_id: 'demo-client-1',
          codigo_qr: 'CUP-DEMO10',
          estado: 'activo',
          activado_at: new Date(now - 3600000).toISOString(),
          expira_at: new Date(now + 86400000 * 14).toISOString(),
          canjeado_at: null,
        },
        promocion: {
          id: 'promo-flat-white-combo',
          negocio_id: negocioId,
          titulo: 'Flat White + Croissant de Mantequilla',
          descripcion: 'Combo exclusivo para miembros del club con doble sello.',
          precio_especial: 18.9,
          precio_regular: 26.0,
          sellos_extra: 2,
          imagen_url: null,
          vigencia_inicio: new Date(now - 86400000).toISOString(),
          vigencia_fin: new Date(now + 86400000 * 14).toISOString(),
          limite_por_cliente: 2,
          stock_total: 100,
          stock_usado: 24,
          audiencia: 'todos',
          canal: 'push',
          activa: true,
        },
        cliente_nombre: 'María Quispe',
        celular_enmascarado: maskPhone9('987654321'),
      },
    ],
  };
}

function readLocalPosDb(negocioId: string, objetivo: number): LocalPosDemoDb {
  try {
    const raw = localStorage.getItem(POS_DEMO_DB_KEY);
    if (raw) return JSON.parse(raw) as LocalPosDemoDb;
  } catch {
    // Ignore parse errors
  }
  const initial = buildInitialLocalPosDb(negocioId, objetivo);
  try {
    localStorage.setItem(POS_DEMO_DB_KEY, JSON.stringify(initial));
  } catch {
    // Ignore quota errors
  }
  return initial;
}

function writeLocalPosDb(db: LocalPosDemoDb) {
  try {
    localStorage.setItem(POS_DEMO_DB_KEY, JSON.stringify(db));
  } catch {
    // Ignore quota errors
  }
}

function computeNivel(historicos: number): NivelLealtad {
  if (historicos >= 35) return 'Oro';
  if (historicos >= 15) return 'Plata';
  return 'Bambú';
}

function makeIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const ADMIN_DEMO_KEY = 'olivia_admin_demo_store_v1';

function readDemoActivePromos(negocioId: string): Promocion[] {
  const now = Date.now();
  try {
    const raw = localStorage.getItem(ADMIN_DEMO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { promociones?: Promocion[] };
      if (Array.isArray(parsed.promociones)) {
        return parsed.promociones.filter(
          (p) => p.activa && new Date(p.vigencia_fin).getTime() > now
        );
      }
    }
  } catch {
    // Ignore parse errors
  }
  return [
    {
      id: 'promo-flat-white-combo',
      negocio_id: negocioId,
      titulo: 'Flat White + Croissant de Mantequilla',
      descripcion: 'Combo exclusivo de mañana para miembros del club. Incluye 2 sellos en tu cartilla.',
      precio_especial: 18.9,
      precio_regular: 26.0,
      sellos_extra: 2,
      imagen_url: null,
      vigencia_inicio: new Date(now - 86400000).toISOString(),
      vigencia_fin: new Date(now + 86400000 * 21).toISOString(),
      limite_por_cliente: 2,
      stock_total: 100,
      stock_usado: 24,
      audiencia: 'todos',
      canal: 'push',
      activa: true,
    },
    {
      id: 'promo-cold-brew',
      negocio_id: negocioId,
      titulo: 'Cold Brew Citron de Tarde',
      descripcion: 'Extracción en frío 18h con naranja orgánica de Chanchamayo.',
      precio_especial: 12.5,
      precio_regular: 17.0,
      sellos_extra: 1,
      imagen_url: null,
      vigencia_inicio: new Date(now - 86400000).toISOString(),
      vigencia_fin: new Date(now + 86400000 * 12).toISOString(),
      limite_por_cliente: 1,
      stock_total: 60,
      stock_usado: 11,
      audiencia: 'frecuentes',
      canal: 'ambos',
      activa: true,
    },
  ];
}

export function usePosWorkspace(posSession: PosCashierSession | null, supabaseReady: boolean) {
  const { negocio } = useTheme();
  const isOnline = useOnlineStatus();

  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomerView | null>(null);
  const [scannedCoupon, setScannedCoupon] = useState<PosScannedCoupon | null>(null);
  const [pendingQrToken, setPendingQrToken] = useState<string | null>(null);
  const [activePromos, setActivePromos] = useState<Promocion[]>(() =>
    readDemoActivePromos(negocio.id)
  );

  const [searching, setSearching] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [feedbackMsg, setFeedbackMsg] = useState<{
    title: string;
    subtitle: string;
    offlineQueued?: boolean;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pendingOps, setPendingOps] = useState<PendingPosOp[]>([]);
  const [recentActivity, setRecentActivity] = useState<PosQueueEntry[]>([]);
  const [readyRedeemList, setReadyRedeemList] = useState<PosCustomerView[]>([]);

  const refreshLocalQueues = useCallback(async () => {
    const [pending, recent] = await Promise.all([
      listPendingPosOps(),
      listRecentPosActivity(),
    ]);
    setPendingOps(pending);
    setRecentActivity(recent);

    // En modo local o inicial, cargar clientes con premio listo (10/10)
    const db = readLocalPosDb(negocio.id, negocio.sellos_para_premio);
    setReadyRedeemList(
      db.customers
        .filter((c) => c.cartilla.sellos_actuales >= c.cartilla.sellos_objetivo)
        .map(({ match_digits: _m, ...rest }) => rest)
    );
  }, [negocio.id, negocio.sellos_para_premio]);

  useEffect(() => {
    void refreshLocalQueues();
  }, [refreshLocalQueues]);

  useEffect(() => {
    const loadPromos = async () => {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady && isOnline) {
        const { data, error } = await supabase.rpc('listar_promociones_caja', {
          p_negocio_id: negocio.id,
        });
        if (!error && Array.isArray(data)) {
          setActivePromos(data as Promocion[]);
          return;
        }
      }
      setActivePromos(readDemoActivePromos(negocio.id));
    };
    void loadPromos();
  }, [isOnline, negocio.id, supabaseReady]);

  // Sincronización automática cuando vuelve la conexión
  const syncOfflineQueue = useCallback(async () => {
    const supabase = getSupabaseClient();
    const ops = await listPendingPosOps();
    if (ops.length === 0) return;

    if (!supabase || !supabaseReady) {
      // En modo demo sin backend, al estar online marcamos como sincronizado limpio
      if (isOnline) {
        for (const op of ops) {
          await removePendingPosOp(op.idempotencyKey);
          await markRecentActivitySynced(op.idempotencyKey);
        }
        await refreshLocalQueues();
      }
      return;
    }

    if (!isOnline) return;

    setSyncing(true);
    try {
      for (const op of [...ops].reverse()) {
        try {
          if (op.kind === 'dar_sello') {
            const { error } = await supabase.rpc('dar_sello', op.payload);
            if (error) throw error;
          } else if (op.kind === 'canjear_premio') {
            const { error } = await supabase.rpc('canjear_premio', op.payload);
            if (error) throw error;
          } else if (op.kind === 'canjear_cupon') {
            const { error } = await supabase.rpc('canjear_cupon', op.payload);
            if (error) throw error;
          } else if (op.kind === 'aplicar_promo') {
            const { error } = await supabase.rpc('aplicar_promo_caja', op.payload);
            if (error) throw error;
          }
          await removePendingPosOp(op.idempotencyKey);
          await markRecentActivitySynced(op.idempotencyKey);
        } catch (err) {
          await markPendingPosOpFailed(
            op.idempotencyKey,
            err instanceof Error ? err.message : 'Error sincronizando operación'
          );
        }
      }
    } finally {
      setSyncing(false);
      await refreshLocalQueues();
    }
  }, [isOnline, refreshLocalQueues, supabaseReady]);

  useEffect(() => {
    if (isOnline) {
      void syncOfflineQueue();
    }
  }, [isOnline, syncOfflineQueue]);

  const searchByQueryOrQr = useCallback(
    async (rawInput: string) => {
      const trimmed = rawInput.trim();
      if (!trimmed) return;

      setErrorMsg(null);
      setSearching(true);
      setScannedCoupon(null);

      try {
        // 1. Detectar si es JSON QR de cliente: { v: 1, slug, cid, t }
        let parsedCid: string | null = null;
        let parsedToken: string | null = null;
        if (trimmed.startsWith('{')) {
          try {
            const parsed = JSON.parse(trimmed) as { cid?: string; t?: string };
            if (parsed.cid) {
              parsedCid = parsed.cid;
              parsedToken = parsed.t || null;
            }
          } catch {
            // No es JSON válido; continuar con búsqueda textual
          }
        }

        // 2. Detectar si es cupón promocional (CUP-...)
        const upper = trimmed.toUpperCase();
        if (upper.startsWith('CUP-')) {
          setPendingQrToken(null);
          const supabase = getSupabaseClient();
          if (supabase && supabaseReady && isOnline) {
            const { data, error } = await supabase.rpc('buscar_cupon_caja', {
              p_negocio_id: negocio.id,
              p_codigo_qr: upper,
            });
            if (error) throw error;
            const res = data as {
              encontrado: boolean;
              cupon?: Cupon;
              promocion?: Promocion;
              cliente_nombre?: string;
              celular_enmascarado?: string;
            };
            if (!res.encontrado || !res.cupon || !res.promocion) {
              throw new Error(`No encontramos el cupón ${upper}.`);
            }
            setScannedCoupon({
              cupon: res.cupon,
              promocion: res.promocion,
              cliente_nombre: res.cliente_nombre || 'Cliente',
              celular_enmascarado: res.celular_enmascarado || '***',
            });
            setSelectedCustomer(null);
            return;
          }

          const db = readLocalPosDb(negocio.id, negocio.sellos_para_premio);
          const foundCoupon = db.coupons.find(
            (c) => c.cupon.codigo_qr.toUpperCase() === upper
          );
          if (!foundCoupon) {
            throw new Error(`Cupón ${upper} no encontrado (en modo local prueba CUP-DEMO10).`);
          }
          setScannedCoupon(foundCoupon);
          setSelectedCustomer(null);
          return;
        }

        // 3. Buscar cliente por QR cid, 9 dígitos o código corto
        setPendingQrToken(parsedToken);
        const supabase = getSupabaseClient();
        if (supabase && supabaseReady && isOnline) {
          const { data, error } = await supabase.rpc('buscar_cliente_caja', {
            p_negocio_id: negocio.id,
            p_query: parsedCid ? null : trimmed,
            p_cliente_id: parsedCid,
          });
          if (error) throw error;
          const res = data as {
            encontrado: boolean;
            cliente?: Omit<PosCustomerView, 'cartilla'>;
            cartilla?: Cartilla;
          };
          if (!res.encontrado || !res.cliente || !res.cartilla) {
            throw new Error('Cliente no encontrado. Verifica los 9 dígitos o el QR.');
          }
          setSelectedCustomer({ ...res.cliente, cartilla: res.cartilla });
          return;
        }

        // Modo local / offline cacheado
        const db = readLocalPosDb(negocio.id, negocio.sellos_para_premio);
        const cleanDigits = trimmed.replace(/\D/g, '').slice(-9);
        const found = db.customers.find(
          (c) =>
            (parsedCid && c.id === parsedCid) ||
            (cleanDigits.length === 9 && c.match_digits === cleanDigits) ||
            c.cartilla.codigo_corto.toUpperCase() === upper
        );
        if (!found) {
          throw new Error(
            'Cliente no encontrado en modo local. Prueba con 987654321, 984112304 o 972554819.'
          );
        }
        const { match_digits: _m, ...view } = found;
        setSelectedCustomer(view);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Error al buscar cliente.');
        setSelectedCustomer(null);
      } finally {
        setSearching(false);
      }
    },
    [isOnline, negocio.id, negocio.sellos_para_premio, supabaseReady]
  );

  const darSello = useCallback(
    async (detalle: string) => {
      if (!selectedCustomer || !posSession) return;
      setActionBusy(true);
      setErrorMsg(null);
      const idempotencyKey = makeIdempotencyKey('sello');
      const nowIso = new Date().toISOString();

      const rpcPayload = {
        p_negocio_id: posSession.negocio_id,
        p_sede_id: posSession.sede_id,
        p_cliente_id: selectedCustomer.id,
        p_cajero_id: posSession.id,
        p_dispositivo_id: posSession.dispositivo_id,
        p_cantidad: 1,
        p_detalle: detalle || 'Consumo en barra',
        p_idempotency_key: idempotencyKey,
        p_qr_token: pendingQrToken,
      };

      const applyOptimisticStamp = (offlineQueued: boolean) => {
        const current = selectedCustomer.cartilla;
        const nuevoTotal = Math.min(current.sellos_objetivo, current.sellos_actuales + 1);
        const nuevoHistorico = current.sellos_historicos + 1;
        const nextCartilla: Cartilla = {
          ...current,
          sellos_actuales: nuevoTotal,
          sellos_historicos: nuevoHistorico,
          nivel: computeNivel(nuevoHistorico),
          premio_disponible: nuevoTotal >= current.sellos_objetivo,
          updated_at: nowIso,
        };
        const updatedCustomer: PosCustomerView = {
          ...selectedCustomer,
          total_visitas: selectedCustomer.total_visitas + 1,
          ultima_visita_at: nowIso,
          cartilla: nextCartilla,
        };
        setSelectedCustomer(updatedCustomer);
        setPendingQrToken(null);

        // Persistir en roster demo local si existe
        const db = readLocalPosDb(negocio.id, negocio.sellos_para_premio);
        db.customers = db.customers.map((c) =>
          c.id === selectedCustomer.id
            ? {
                ...c,
                total_visitas: updatedCustomer.total_visitas,
                ultima_visita_at: nowIso,
                cartilla: nextCartilla,
              }
            : c
        );
        writeLocalPosDb(db);

        setFeedbackMsg({
          title: `+1 Sello asignado a ${selectedCustomer.nombre}`,
          subtitle:
            nuevoTotal >= current.sellos_objetivo
              ? '¡Cartilla completa! Listo para canjear premio gratis.'
              : `Cartilla ahora en ${nuevoTotal}/${current.sellos_objetivo} sellos.`,
          offlineQueued,
        });

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([70, 35, 90]);
        }
      };

      try {
        const supabase = getSupabaseClient();
        let queuedOffline = false;

        if (supabase && supabaseReady && isOnline) {
          const { data, error } = await supabase.rpc('dar_sello', rpcPayload);
          if (error) {
            // Si es error de red o offline real, encolar; si es regla de negocio (intervalo mínimo), lanzar
            if (error.message.toLowerCase().includes('fetch')) {
              queuedOffline = true;
            } else {
              throw new Error(error.message);
            }
          } else {
            const res = data as { cartilla?: Cartilla };
            if (res.cartilla) {
              setSelectedCustomer((prev) =>
                prev ? { ...prev, cartilla: res.cartilla! } : prev
              );
            }
          }
        } else if (!isOnline) {
          queuedOffline = true;
        }

        if (queuedOffline) {
          await enqueuePendingPosOp({
            idempotencyKey,
            kind: 'dar_sello',
            createdAt: nowIso,
            customerName: selectedCustomer.nombre,
            maskedPhone: selectedCustomer.celular_enmascarado,
            summary: `+1 Sello · ${detalle}`,
            payload: rpcPayload,
            status: 'pending',
          });
        }

        await addRecentPosActivity({
          id: idempotencyKey,
          kind: 'dar_sello',
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.nombre,
          maskedPhone: selectedCustomer.celular_enmascarado,
          badgeText: '+1 Sello',
          detailText: detalle,
          createdAt: nowIso,
          syncState: queuedOffline ? 'offline_queued' : 'synced',
          idempotencyKey,
        });

        applyOptimisticStamp(queuedOffline);
        await refreshLocalQueues();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'No se pudo asignar el sello.');
      } finally {
        setActionBusy(false);
      }
    },
    [
      isOnline,
      negocio.id,
      negocio.sellos_para_premio,
      pendingQrToken,
      posSession,
      refreshLocalQueues,
      selectedCustomer,
      supabaseReady,
    ]
  );

  const canjearPremio = useCallback(
    async (customer: PosCustomerView, verificadoOtp: boolean) => {
      if (!posSession) return;
      setActionBusy(true);
      setErrorMsg(null);
      const idempotencyKey = makeIdempotencyKey('canje');
      const nowIso = new Date().toISOString();

      const rpcPayload = {
        p_negocio_id: posSession.negocio_id,
        p_sede_id: posSession.sede_id,
        p_cliente_id: customer.id,
        p_cajero_id: posSession.id,
        p_dispositivo_id: posSession.dispositivo_id,
        p_verificado_otp: verificadoOtp,
        p_idempotency_key: idempotencyKey,
      };

      try {
        const supabase = getSupabaseClient();
        let queuedOffline = false;

        if (supabase && supabaseReady && isOnline) {
          const { error } = await supabase.rpc('canjear_premio', rpcPayload);
          if (error) {
            if (error.message.toLowerCase().includes('fetch')) {
              queuedOffline = true;
            } else {
              throw new Error(error.message);
            }
          }
        } else if (!isOnline) {
          queuedOffline = true;
        }

        if (queuedOffline) {
          await enqueuePendingPosOp({
            idempotencyKey,
            kind: 'canjear_premio',
            createdAt: nowIso,
            customerName: customer.nombre,
            maskedPhone: customer.celular_enmascarado,
            summary: `Canje · ${negocio.nombre_premio}`,
            payload: rpcPayload,
            status: 'pending',
          });
        }

        await addRecentPosActivity({
          id: idempotencyKey,
          kind: 'canjear_premio',
          customerId: customer.id,
          customerName: customer.nombre,
          maskedPhone: customer.celular_enmascarado,
          badgeText: 'Canje Menú',
          detailText: negocio.nombre_premio,
          createdAt: nowIso,
          syncState: queuedOffline ? 'offline_queued' : 'synced',
          idempotencyKey,
        });

        const resetCartilla: Cartilla = {
          ...customer.cartilla,
          sellos_actuales: 0,
          premio_disponible: false,
          canjes_historicos: customer.cartilla.canjes_historicos + 1,
          updated_at: nowIso,
        };

        if (selectedCustomer?.id === customer.id) {
          setSelectedCustomer({ ...customer, cartilla: resetCartilla });
        }

        const db = readLocalPosDb(negocio.id, negocio.sellos_para_premio);
        db.customers = db.customers.map((c) =>
          c.id === customer.id ? { ...c, cartilla: resetCartilla } : c
        );
        writeLocalPosDb(db);

        setFeedbackMsg({
          title: `Premio canjeado para ${customer.nombre}`,
          subtitle: `${negocio.nombre_premio} entregado · Cartilla reiniciada a 0/${customer.cartilla.sellos_objetivo}.`,
          offlineQueued: queuedOffline,
        });

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([100, 40, 120]);
        }
        await refreshLocalQueues();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Error al canjear el premio.');
      } finally {
        setActionBusy(false);
      }
    },
    [
      isOnline,
      negocio.id,
      negocio.nombre_premio,
      negocio.sellos_para_premio,
      posSession,
      refreshLocalQueues,
      selectedCustomer?.id,
      supabaseReady,
    ]
  );

  const canjearCupon = useCallback(
    async (couponData: PosScannedCoupon) => {
      if (!posSession) return;
      setActionBusy(true);
      setErrorMsg(null);
      const idempotencyKey = makeIdempotencyKey('cupon');
      const nowIso = new Date().toISOString();

      try {
        const supabase = getSupabaseClient();
        if (supabase && supabaseReady && isOnline) {
          const { error } = await supabase.rpc('canjear_cupon', {
            p_negocio_id: posSession.negocio_id,
            p_sede_id: posSession.sede_id,
            p_codigo_qr: couponData.cupon.codigo_qr,
            p_cajero_id: posSession.id,
            p_dispositivo_id: posSession.dispositivo_id,
          });
          if (error) throw new Error(error.message);
        } else {
          if (couponData.cupon.estado !== 'activo') {
            throw new Error('Este cupón ya fue canjeado o expiró.');
          }
          const db = readLocalPosDb(negocio.id, negocio.sellos_para_premio);
          db.coupons = db.coupons.map((entry) =>
            entry.cupon.codigo_qr === couponData.cupon.codigo_qr
              ? {
                  ...entry,
                  cupon: { ...entry.cupon, estado: 'canjeado', canjeado_at: nowIso },
                }
              : entry
          );
          if (couponData.promocion.sellos_extra > 0) {
            db.customers = db.customers.map((c) => {
              if (c.id !== couponData.cupon.cliente_id) return c;
              const nextSellos = Math.min(
                c.cartilla.sellos_objetivo,
                c.cartilla.sellos_actuales + couponData.promocion.sellos_extra
              );
              const nextHist = c.cartilla.sellos_historicos + couponData.promocion.sellos_extra;
              return {
                ...c,
                cartilla: {
                  ...c.cartilla,
                  sellos_actuales: nextSellos,
                  sellos_historicos: nextHist,
                  nivel: computeNivel(nextHist),
                  premio_disponible: nextSellos >= c.cartilla.sellos_objetivo,
                },
              };
            });
          }
          writeLocalPosDb(db);
        }

        await addRecentPosActivity({
          id: idempotencyKey,
          kind: 'canjear_cupon',
          customerId: couponData.cupon.cliente_id,
          customerName: couponData.cliente_nombre,
          maskedPhone: couponData.celular_enmascarado,
          badgeText: `Cupón +${couponData.promocion.sellos_extra}`,
          detailText: couponData.promocion.titulo,
          createdAt: nowIso,
          syncState: 'synced',
          idempotencyKey,
        });

        setScannedCoupon({
          ...couponData,
          cupon: { ...couponData.cupon, estado: 'canjeado', canjeado_at: nowIso },
        });
        setFeedbackMsg({
          title: `Cupón ${couponData.cupon.codigo_qr} aplicado`,
          subtitle: `Precio promo S/ ${couponData.promocion.precio_especial.toFixed(2)} · +${couponData.promocion.sellos_extra} sellos acreditados a ${couponData.cliente_nombre}.`,
        });
        await refreshLocalQueues();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'No se pudo aplicar el cupón.');
      } finally {
        setActionBusy(false);
      }
    },
    [
      isOnline,
      negocio.id,
      negocio.sellos_para_premio,
      posSession,
      refreshLocalQueues,
      supabaseReady,
    ]
  );

  const aplicarPromoDirecta = useCallback(
    async (promo: Promocion) => {
      if (!selectedCustomer || !posSession) return;
      setActionBusy(true);
      setErrorMsg(null);
      const idempotencyKey = makeIdempotencyKey('pospromo');
      const nowIso = new Date().toISOString();

      const rpcPayload = {
        p_negocio_id: posSession.negocio_id,
        p_sede_id: posSession.sede_id,
        p_cliente_id: selectedCustomer.id,
        p_promocion_id: promo.id,
        p_cajero_id: posSession.id,
        p_dispositivo_id: posSession.dispositivo_id,
        p_idempotency_key: idempotencyKey,
      };

      const applyOptimisticPromo = (offlineQueued: boolean) => {
        const extra = Math.max(0, promo.sellos_extra || 0);
        const current = selectedCustomer.cartilla;
        const nuevoTotal = Math.min(current.sellos_objetivo, current.sellos_actuales + extra);
        const nuevoHistorico = current.sellos_historicos + extra;
        const nextCartilla: Cartilla = {
          ...current,
          sellos_actuales: nuevoTotal,
          sellos_historicos: nuevoHistorico,
          nivel: computeNivel(nuevoHistorico),
          premio_disponible: nuevoTotal >= current.sellos_objetivo,
          updated_at: nowIso,
        };
        const updatedCustomer: PosCustomerView = {
          ...selectedCustomer,
          total_visitas: selectedCustomer.total_visitas + 1,
          ultima_visita_at: nowIso,
          cartilla: nextCartilla,
        };
        setSelectedCustomer(updatedCustomer);

        const db = readLocalPosDb(negocio.id, negocio.sellos_para_premio);
        db.customers = db.customers.map((c) =>
          c.id === selectedCustomer.id
            ? {
                ...c,
                total_visitas: updatedCustomer.total_visitas,
                ultima_visita_at: nowIso,
                cartilla: nextCartilla,
              }
            : c
        );
        writeLocalPosDb(db);

        setFeedbackMsg({
          title: `Promo "${promo.titulo}" aplicada a ${selectedCustomer.nombre}`,
          subtitle: `Cobro especial S/ ${promo.precio_especial.toFixed(2)}${
            extra > 0 ? ` · +${extra} ${extra === 1 ? 'sello acreditado' : 'sellos acreditados'}` : ''
          }.`,
          offlineQueued,
        });

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([70, 35, 90]);
        }
      };

      try {
        const supabase = getSupabaseClient();
        let queuedOffline = false;

        if (supabase && supabaseReady && isOnline) {
          const { data, error } = await supabase.rpc('aplicar_promo_caja', rpcPayload);
          if (error) {
            if (error.message.toLowerCase().includes('fetch')) {
              queuedOffline = true;
            } else {
              throw new Error(error.message);
            }
          } else {
            const res = data as { cartilla?: Cartilla };
            if (res.cartilla) {
              setSelectedCustomer((prev) =>
                prev ? { ...prev, cartilla: res.cartilla! } : prev
              );
            }
          }
        } else if (!isOnline) {
          queuedOffline = true;
        }

        if (queuedOffline) {
          await enqueuePendingPosOp({
            idempotencyKey,
            kind: 'aplicar_promo',
            createdAt: nowIso,
            customerName: selectedCustomer.nombre,
            maskedPhone: selectedCustomer.celular_enmascarado,
            summary: `Promo POS · ${promo.titulo}`,
            payload: rpcPayload,
            status: 'pending',
          });
        }

        await addRecentPosActivity({
          id: idempotencyKey,
          kind: 'aplicar_promo',
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.nombre,
          maskedPhone: selectedCustomer.celular_enmascarado,
          badgeText: promo.sellos_extra > 0 ? `Promo +${promo.sellos_extra}` : 'Promo POS',
          detailText: `${promo.titulo} (S/ ${promo.precio_especial.toFixed(2)})`,
          createdAt: nowIso,
          syncState: queuedOffline ? 'offline_queued' : 'synced',
          idempotencyKey,
        });

        applyOptimisticPromo(queuedOffline);
        await refreshLocalQueues();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'No se pudo aplicar la promoción.');
      } finally {
        setActionBusy(false);
      }
    },
    [
      isOnline,
      negocio.id,
      negocio.sellos_para_premio,
      posSession,
      refreshLocalQueues,
      selectedCustomer,
      supabaseReady,
    ]
  );

  const clearSelection = useCallback(() => {
    setSelectedCustomer(null);
    setScannedCoupon(null);
    setPendingQrToken(null);
    setErrorMsg(null);
  }, []);

  return {
    isOnline,
    selectedCustomer,
    scannedCoupon,
    activePromos,
    searching,
    actionBusy,
    syncing,
    feedbackMsg,
    errorMsg,
    pendingOps,
    recentActivity,
    readyRedeemList,
    searchByQueryOrQr,
    darSello,
    canjearPremio,
    canjearCupon,
    aplicarPromoDirecta,
    syncOfflineQueue,
    clearSelection,
  };
}
