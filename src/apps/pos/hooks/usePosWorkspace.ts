import { useCallback, useEffect, useState } from 'react';
import type { PosCashierSession } from '@/src/shared/auth/AuthContext';
import { getSupabaseClient } from '@/src/shared/lib/supabase';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { useOnlineStatus } from '@/src/shared/pwa/useOnlineStatus';
import { playStampFeedbackSound } from '@/src/shared/pwa/welcomeSound';
import {
  broadcastDemoStampEvent,
  buildStampEncouragementMessage,
  showLocalBrowserStampNotification,
  type StampEventKind,
} from '@/src/shared/pwa/stampEncouragement';
import {
  evaluateHappyHour,
  type HappyHourEvaluation,
} from '@/src/shared/utils/loyaltyExtras';
import {
  broadcastCoworkingSync,
  COWORKING_EVENT_CHANNEL,
  COWORKING_STORAGE_EVENT_KEY,
  readLocalEspacios,
  readLocalReservas,
  writeLocalReservas,
} from '@/src/shared/utils/coworkingHelpers';
import type {
  Cartilla,
  Cupon,
  EspacioCoworking,
  NivelLealtad,
  Promocion,
  ReservaCoworking,
} from '@/src/types/database';
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
  const [espaciosCoworking, setEspaciosCoworking] = useState<EspacioCoworking[]>(() =>
    readLocalEspacios(negocio.id)
  );
  const [reservasCoworking, setReservasCoworking] = useState<ReservaCoworking[]>(() =>
    readLocalReservas(negocio.id)
  );
  const [happyHourStatus, setHappyHourStatus] = useState<HappyHourEvaluation>(() =>
    evaluateHappyHour(negocio.happy_hour_config, negocio.zona_horaria)
  );

  useEffect(() => {
    const updateHh = () =>
      setHappyHourStatus(evaluateHappyHour(negocio.happy_hour_config, negocio.zona_horaria));
    updateHh();
    const timer = window.setInterval(updateHh, 30000);
    return () => window.clearInterval(timer);
  }, [negocio.happy_hour_config, negocio.zona_horaria]);

  const dispatchStampPushNotification = useCallback(
    async (params: {
      clienteId: string;
      clienteNombre: string;
      clientePhoneMasked?: string;
      kind: StampEventKind;
      cantidadAgregada?: number;
      sellosActuales: number;
      sellosObjetivo: number;
      detalle?: string;
      queuedOffline?: boolean;
    }) => {
      if (!posSession) return;

      const phoneDigits = (params.clientePhoneMasked || '').replace(/\D/g, '').slice(-9);
      const nowIso = new Date().toISOString();

      // Difusión local para modo demo en el mismo navegador
      if (!supabaseReady || params.clienteId.startsWith('demo-')) {
        broadcastDemoStampEvent({
          clienteId: params.clienteId,
          clientePhoneDigits: phoneDigits.length === 9 ? phoneDigits : undefined,
          kind: params.kind,
          cantidadAgregada: Math.max(1, params.cantidadAgregada || 1),
          detalle: params.detalle || 'Consumo en barra',
          sellosActuales: params.sellosActuales,
          sellosObjetivo: params.sellosObjetivo,
          nombreCliente: params.clienteNombre,
          negocioNombre: negocio.nombre,
          nombrePremio: negocio.nombre_premio,
          createdAt: nowIso,
        });
      }

      if (params.queuedOffline || !isOnline) return;

      const previewMsg = buildStampEncouragementMessage({
        negocioNombre: negocio.nombre,
        nombreCliente: params.clienteNombre,
        sellosActuales: params.sellosActuales,
        sellosObjetivo: params.sellosObjetivo,
        nombrePremio: negocio.nombre_premio,
        cantidadAgregada: params.cantidadAgregada || 1,
        kind: params.kind,
      });

      let sentByServer = false;
      if (supabaseReady && !params.clienteId.startsWith('demo-')) {
        try {
          const supabase = getSupabaseClient();
          const sessionRes = supabase ? await supabase.auth.getSession() : null;
          const accessToken = sessionRes?.data?.session?.access_token;

          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
          }

          const res = await fetch('/api/push/stamp-notify', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              negocio_id: posSession.negocio_id,
              negocio_nombre: negocio.nombre,
              nombre_premio: negocio.nombre_premio,
              cliente_id: params.clienteId,
              cliente_nombre: params.clienteNombre,
              dispositivo_id: posSession.dispositivo_id,
              cajero_id: posSession.id,
              kind: params.kind,
              cantidad_agregada: Math.max(1, params.cantidadAgregada || 1),
              sellos_actuales: params.sellosActuales,
              sellos_objetivo: params.sellosObjetivo,
              url: `/c/${negocio.slug}`,
            }),
          });
          if (res.ok) {
            const json = (await res.json()) as { sent?: number; skipped?: boolean };
            sentByServer = Boolean(json.sent && json.sent > 0);
          }
        } catch {
          // Fallback local si el endpoint no está disponible en preview
        }
      }

      if (!sentByServer) {
        void showLocalBrowserStampNotification(
          previewMsg.title,
          previewMsg.body,
          `/c/${negocio.slug}`
        );
      }
    },
    [isOnline, negocio.nombre, negocio.nombre_premio, negocio.slug, posSession, supabaseReady]
  );

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

  const loadCoworkingData = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase && supabaseReady && isOnline) {
      try {
        const [{ data: espData }, { data: resData }] = await Promise.all([
          supabase
            .from('espacios_coworking')
            .select('*')
            .eq('negocio_id', negocio.id)
            .order('created_at', { ascending: true }),
          supabase
            .from('reservas_coworking')
            .select('*, clientes(nombre, celular), espacios_coworking(nombre)')
            .eq('negocio_id', negocio.id)
            .order('created_at', { ascending: false })
            .limit(60),
        ]);
        if (Array.isArray(espData) && espData.length > 0) {
          setEspaciosCoworking(espData as EspacioCoworking[]);
        } else {
          setEspaciosCoworking(readLocalEspacios(negocio.id));
        }
        if (Array.isArray(resData)) {
          const mapped: ReservaCoworking[] = (resData as Array<Record<string, unknown>>).map(
            (r) => {
              const cli = (r.clientes as Record<string, unknown> | null) || null;
              const esp = (r.espacios_coworking as Record<string, unknown> | null) || null;
              return {
                ...(r as unknown as ReservaCoworking),
                cliente_nombre: String(cli?.nombre || r.cliente_nombre || 'Cliente'),
                cliente_celular: String(cli?.celular || r.cliente_celular || ''),
                espacio_nombre: String(esp?.nombre || r.espacio_nombre || 'Mesa Cowork'),
                items_pedido: Array.isArray(r.items_pedido)
                  ? (r.items_pedido as ReservaCoworking['items_pedido'])
                  : [],
              };
            }
          );
          setReservasCoworking(mapped);
          return;
        }
      } catch {
        // Fallback local below
      }
    }
    setEspaciosCoworking(readLocalEspacios(negocio.id));
    setReservasCoworking(readLocalReservas(negocio.id));
  }, [isOnline, negocio.id, supabaseReady]);

  useEffect(() => {
    void loadCoworkingData();
  }, [loadCoworkingData]);

  // Escucha en vivo de nuevas reservas o comprobantes Yape desde la app cliente
  useEffect(() => {
    let ch: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      ch = new BroadcastChannel(COWORKING_EVENT_CHANNEL);
      ch.onmessage = (event: MessageEvent<{ tipo?: string }>) => {
        void loadCoworkingData();
        if (event.data?.tipo === 'nueva_solicitud' || event.data?.tipo === 'yape_adjunto') {
          void playStampFeedbackSound('pos_ok');
        }
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === COWORKING_STORAGE_EVENT_KEY || e.key?.startsWith('olivia_coworking_reservas_')) {
        void loadCoworkingData();
      }
    };
    window.addEventListener('storage', onStorage);

    const supabase = getSupabaseClient();
    let rtChannel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    if (supabase && supabaseReady && isOnline) {
      rtChannel = supabase
        .channel(`pos-coworking-${negocio.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'reservas_coworking', filter: `negocio_id=eq.${negocio.id}` },
          (payload) => {
            void loadCoworkingData();
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              void playStampFeedbackSound('pos_ok');
            }
          }
        )
        .subscribe();
    }

    return () => {
      ch?.close();
      window.removeEventListener('storage', onStorage);
      if (supabase && rtChannel) {
        void supabase.removeChannel(rtChannel);
      }
    };
  }, [isOnline, loadCoworkingData, negocio.id, supabaseReady]);

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
      const hhNow = evaluateHappyHour(negocio.happy_hour_config, negocio.zona_horaria);
      const expectedQty = hhNow.isActiveNow ? hhNow.multiplier : 1;
      const effectiveDetalle = hhNow.isActiveNow
        ? `${detalle || 'Consumo en barra'} · ${hhNow.label}`
        : detalle || 'Consumo en barra';

      const rpcPayload = {
        p_negocio_id: posSession.negocio_id,
        p_sede_id: posSession.sede_id,
        p_cliente_id: selectedCustomer.id,
        p_cajero_id: posSession.id,
        p_dispositivo_id: posSession.dispositivo_id,
        p_cantidad: 1,
        p_detalle: effectiveDetalle,
        p_idempotency_key: idempotencyKey,
        p_qr_token: pendingQrToken,
      };

      const applyFinalStampState = (
        offlineQueued: boolean,
        qtyAdded: number,
        syncedCartilla: Cartilla | null
      ) => {
        const current = selectedCustomer.cartilla;
        const nuevoTotal =
          syncedCartilla?.sellos_actuales ??
          Math.min(current.sellos_objetivo, current.sellos_actuales + qtyAdded);
        const nuevoHistorico =
          syncedCartilla?.sellos_historicos ?? current.sellos_historicos + qtyAdded;
        const nextCartilla: Cartilla = syncedCartilla || {
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
          title: `+${qtyAdded} ${qtyAdded === 1 ? 'Sello asignado' : 'Sellos asignados'} a ${selectedCustomer.nombre}`,
          subtitle:
            nextCartilla.sellos_actuales >= nextCartilla.sellos_objetivo
              ? '¡Cartilla completa! Listo para canjear premio gratis.'
              : `Cartilla ahora en ${nextCartilla.sellos_actuales}/${nextCartilla.sellos_objetivo} sellos.`,
          offlineQueued,
        });

        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([70, 35, 90]);
        }
        void playStampFeedbackSound('pos_ok');
        return nextCartilla;
      };

      try {
        const supabase = getSupabaseClient();
        let queuedOffline = false;
        let syncedCartilla: Cartilla | null = null;
        let qtyFinal = expectedQty;
        let referidorId: string | null = null;

        if (supabase && supabaseReady && isOnline) {
          const { data, error } = await supabase.rpc('dar_sello', rpcPayload);
          if (error) {
            if (error.message.toLowerCase().includes('fetch')) {
              queuedOffline = true;
            } else {
              throw new Error(error.message);
            }
          } else {
            const res = data as {
              cartilla?: Cartilla;
              cantidad_otorgada?: number;
              referidor_id?: string | null;
            };
            if (res.cartilla) {
              syncedCartilla = res.cartilla;
            }
            if (typeof res.cantidad_otorgada === 'number' && res.cantidad_otorgada > 0) {
              qtyFinal = res.cantidad_otorgada;
            }
            if (res.referidor_id) {
              referidorId = res.referidor_id;
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
            summary: `+${qtyFinal} ${qtyFinal === 1 ? 'Sello' : 'Sellos'} · ${effectiveDetalle}`,
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
          badgeText: `+${qtyFinal} ${qtyFinal === 1 ? 'Sello' : 'Sellos'}`,
          detailText: effectiveDetalle,
          createdAt: nowIso,
          syncState: queuedOffline ? 'offline_queued' : 'synced',
          idempotencyKey,
        });

        const finalCartilla = applyFinalStampState(queuedOffline, qtyFinal, syncedCartilla);
        void dispatchStampPushNotification({
          clienteId: selectedCustomer.id,
          clienteNombre: selectedCustomer.nombre,
          clientePhoneMasked:
            selectedCustomer.id === 'demo-client-1' ? '987654321' : selectedCustomer.celular_enmascarado,
          kind: 'stamp',
          cantidadAgregada: qtyFinal,
          sellosActuales: finalCartilla.sellos_actuales,
          sellosObjetivo: finalCartilla.sellos_objetivo,
          detalle: effectiveDetalle,
          queuedOffline,
        });

        // Si este primer sello desbloqueó premio de referido para quien lo invitó, notificarle también
        if (referidorId) {
          void dispatchStampPushNotification({
            clienteId: referidorId,
            clienteNombre: 'Amigo del Club',
            kind: 'stamp',
            cantidadAgregada: Math.max(1, negocio.referidos_sellos_invitador ?? 1),
            sellosActuales: finalCartilla.sellos_actuales,
            sellosObjetivo: negocio.sellos_para_premio,
            detalle: `¡Tu referido ${selectedCustomer.nombre} visitó el local!`,
            queuedOffline: false,
          });
        }

        await refreshLocalQueues();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'No se pudo asignar el sello.');
      } finally {
        setActionBusy(false);
      }
    },
    [
      dispatchStampPushNotification,
      isOnline,
      negocio.happy_hour_config,
      negocio.id,
      negocio.referidos_sellos_invitador,
      negocio.sellos_para_premio,
      negocio.zona_horaria,
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
        void playStampFeedbackSound('pos_ok');
        void dispatchStampPushNotification({
          clienteId: customer.id,
          clienteNombre: customer.nombre,
          clientePhoneMasked:
            customer.id === 'demo-client-1' ? '987654321' : customer.celular_enmascarado,
          kind: 'redeem',
          sellosActuales: 0,
          sellosObjetivo: customer.cartilla.sellos_objetivo,
          detalle: `Premio canjeado · ${negocio.nombre_premio}`,
          queuedOffline,
        });
        await refreshLocalQueues();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Error al canjear el premio.');
      } finally {
        setActionBusy(false);
      }
    },
    [
      dispatchStampPushNotification,
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
        void playStampFeedbackSound('pos_ok');
        if (couponData.promocion.sellos_extra > 0) {
          void dispatchStampPushNotification({
            clienteId: couponData.cupon.cliente_id,
            clienteNombre: couponData.cliente_nombre,
            clientePhoneMasked:
              couponData.cupon.cliente_id === 'demo-client-1'
                ? '987654321'
                : couponData.celular_enmascarado,
            kind: 'stamp',
            cantidadAgregada: couponData.promocion.sellos_extra,
            sellosActuales: couponData.promocion.sellos_extra,
            sellosObjetivo: negocio.sellos_para_premio,
            detalle: `Cupón · ${couponData.promocion.titulo}`,
          });
        }
        await refreshLocalQueues();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'No se pudo aplicar el cupón.');
      } finally {
        setActionBusy(false);
      }
    },
    [
      dispatchStampPushNotification,
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
        void playStampFeedbackSound('pos_ok');
        return nextCartilla;
      };

      try {
        const supabase = getSupabaseClient();
        let queuedOffline = false;
        let syncedCartilla: Cartilla | null = null;

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
              syncedCartilla = res.cartilla;
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

        const optimisticCartilla = applyOptimisticPromo(queuedOffline);
        const finalCartilla = syncedCartilla || optimisticCartilla;
        if (promo.sellos_extra > 0) {
          void dispatchStampPushNotification({
            clienteId: selectedCustomer.id,
            clienteNombre: selectedCustomer.nombre,
            clientePhoneMasked:
              selectedCustomer.id === 'demo-client-1'
                ? '987654321'
                : selectedCustomer.celular_enmascarado,
            kind: 'stamp',
            cantidadAgregada: promo.sellos_extra,
            sellosActuales: finalCartilla.sellos_actuales,
            sellosObjetivo: finalCartilla.sellos_objetivo,
            detalle: `Promo · ${promo.titulo}`,
            queuedOffline,
          });
        }
        await refreshLocalQueues();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'No se pudo aplicar la promoción.');
      } finally {
        setActionBusy(false);
      }
    },
    [
      dispatchStampPushNotification,
      isOnline,
      negocio.id,
      negocio.sellos_para_premio,
      posSession,
      refreshLocalQueues,
      selectedCustomer,
      supabaseReady,
    ]
  );

  const sendCoworkingPush = useCallback(
    async (params: {
      reserva: ReservaCoworking;
      kind: 'coworking_confirmed' | 'coworking_rejected' | 'coworking_checkin';
      customTitle: string;
      customBody: string;
    }) => {
      if (!posSession || !isOnline) return;
      if (supabaseReady && !params.reserva.cliente_id.startsWith('demo-')) {
        try {
          const supabase = getSupabaseClient();
          const sessionRes = supabase ? await supabase.auth.getSession() : null;
          const accessToken = sessionRes?.data?.session?.access_token;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

          await fetch('/api/push/stamp-notify', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              negocio_id: posSession.negocio_id,
              negocio_nombre: negocio.nombre,
              nombre_premio: negocio.nombre_premio,
              cliente_id: params.reserva.cliente_id,
              cliente_nombre: params.reserva.cliente_nombre || 'Cliente',
              dispositivo_id: posSession.dispositivo_id,
              cajero_id: posSession.id,
              kind: params.kind,
              custom_title: params.customTitle,
              custom_body: params.customBody,
              url: `/c/${negocio.slug}/espacios`,
            }),
          });
        } catch {
          // Ignore server push error in preview
        }
      } else {
        void showLocalBrowserStampNotification(
          params.customTitle,
          params.customBody,
          `/c/${negocio.slug}/espacios`
        );
      }
    },
    [isOnline, negocio.nombre, negocio.nombre_premio, negocio.slug, posSession, supabaseReady]
  );

  const confirmarReservaYape = useCallback(
    async (reservaId: string, nota?: string) => {
      if (!posSession) return;
      const target = reservasCoworking.find((r) => r.id === reservaId);
      if (!target) return;
      setActionBusy(true);
      setErrorMsg(null);
      const nowIso = new Date().toISOString();
      const mensajePos =
        nota ||
        `¡Yape validado! Tu mesa ${target.espacio_nombre || ''} quedó separada para las ${target.hora_inicio}. ¡Muchos éxitos en tu reunión!`;

      try {
        const supabase = getSupabaseClient();
        if (supabase && supabaseReady && isOnline && !reservaId.startsWith('res-')) {
          const { error } = await supabase
            .from('reservas_coworking')
            .update({
              estado: 'confirmada',
              mensaje_pos: mensajePos,
              validado_por_cajero_id: posSession.id,
              updated_at: nowIso,
            })
            .eq('id', reservaId);
          if (error) throw new Error(error.message);
        } else {
          const updated = reservasCoworking.map((r) =>
            r.id === reservaId
              ? {
                  ...r,
                  estado: 'confirmada' as const,
                  mensaje_pos: mensajePos,
                  validado_por_cajero_id: posSession.id,
                  updated_at: nowIso,
                }
              : r
          );
          writeLocalReservas(negocio.id, updated);
          setReservasCoworking(updated);
        }

        broadcastCoworkingSync({
          negocioId: negocio.id,
          reservaId,
          clienteId: target.cliente_id,
          tipo: 'confirmada',
          timestamp: nowIso,
        });

        const firstName = (target.cliente_nombre || 'Cliente').split(' ')[0];
        void sendCoworkingPush({
          reserva: target,
          kind: 'coworking_confirmed',
          customTitle: `✅ ¡Mesa separada, ${firstName}! (${target.hora_inicio})`,
          customBody: `Validamos tu Yape (S/ ${target.total_pedido_pen.toFixed(2)}). ${target.espacio_nombre || 'Tu mesa'} y tu café te esperan. ¡Muchos éxitos en tu reunión!`,
        });

        setFeedbackMsg({
          title: `Mesa separada para ${target.cliente_nombre || 'Cliente'}`,
          subtitle: `${target.espacio_nombre || 'Mesa Cowork'} · ${target.fecha} ${target.hora_inicio}–${target.hora_fin} · Yape confirmado.`,
        });
        void playStampFeedbackSound('pos_ok');
        await loadCoworkingData();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'No se pudo confirmar la reserva.');
      } finally {
        setActionBusy(false);
      }
    },
    [
      isOnline,
      loadCoworkingData,
      negocio.id,
      posSession,
      reservasCoworking,
      sendCoworkingPush,
      supabaseReady,
    ]
  );

  const rechazarReservaYape = useCallback(
    async (reservaId: string, motivo: string) => {
      if (!posSession) return;
      const target = reservasCoworking.find((r) => r.id === reservaId);
      if (!target) return;
      setActionBusy(true);
      const nowIso = new Date().toISOString();
      try {
        const supabase = getSupabaseClient();
        if (supabase && supabaseReady && isOnline && !reservaId.startsWith('res-')) {
          await supabase
            .from('reservas_coworking')
            .update({
              estado: 'rechazada',
              mensaje_pos: motivo,
              updated_at: nowIso,
            })
            .eq('id', reservaId);
        } else {
          const updated = reservasCoworking.map((r) =>
            r.id === reservaId
              ? { ...r, estado: 'rechazada' as const, mensaje_pos: motivo, updated_at: nowIso }
              : r
          );
          writeLocalReservas(negocio.id, updated);
          setReservasCoworking(updated);
        }

        broadcastCoworkingSync({
          negocioId: negocio.id,
          reservaId,
          clienteId: target.cliente_id,
          tipo: 'rechazada',
          timestamp: nowIso,
        });

        void sendCoworkingPush({
          reserva: target,
          kind: 'coworking_rejected',
          customTitle: `⚠️ Mensaje de Caja sobre tu reserva ${target.codigo_reserva}`,
          customBody: motivo,
        });

        setFeedbackMsg({
          title: `Aviso Yape enviado a ${target.cliente_nombre || 'Cliente'}`,
          subtitle: 'El cliente verá tu mensaje y número Yape dentro de su app para volver a adjuntar su captura.',
        });
        await loadCoworkingData();
      } finally {
        setActionBusy(false);
      }
    },
    [
      isOnline,
      loadCoworkingData,
      negocio.id,
      posSession,
      reservasCoworking,
      sendCoworkingPush,
      supabaseReady,
    ]
  );

  const checkinReservaCoworking = useCallback(
    async (reservaId: string) => {
      if (!posSession) return;
      const target = reservasCoworking.find((r) => r.id === reservaId);
      if (!target) return;
      setActionBusy(true);
      const nowIso = new Date().toISOString();
      try {
        const supabase = getSupabaseClient();
        if (supabase && supabaseReady && isOnline && !reservaId.startsWith('res-')) {
          await supabase
            .from('reservas_coworking')
            .update({ estado: 'checkin', updated_at: nowIso })
            .eq('id', reservaId);
        } else {
          const updated = reservasCoworking.map((r) =>
            r.id === reservaId ? { ...r, estado: 'checkin' as const, updated_at: nowIso } : r
          );
          writeLocalReservas(negocio.id, updated);
          setReservasCoworking(updated);
        }

        // Acreditar sello(s) por el consumo mínimo al hacer Check-in
        const hhNow = evaluateHappyHour(negocio.happy_hour_config, negocio.zona_horaria);
        const qty = hhNow.isActiveNow ? hhNow.multiplier : 1;
        const detalle = `Coworking · ${target.espacio_nombre || 'Mesa'} (${target.codigo_reserva})`;

        if (supabase && supabaseReady && isOnline && !target.cliente_id.startsWith('demo-')) {
          await supabase.rpc('dar_sello', {
            p_negocio_id: posSession.negocio_id,
            p_sede_id: posSession.sede_id,
            p_cliente_id: target.cliente_id,
            p_cajero_id: posSession.id,
            p_dispositivo_id: posSession.dispositivo_id,
            p_cantidad: 1,
            p_detalle: detalle,
            p_idempotency_key: `cowork-${target.id}`,
            p_qr_token: null,
          });
        } else {
          const db = readLocalPosDb(negocio.id, negocio.sellos_para_premio);
          let currentSellos = 1;
          let objetivo = negocio.sellos_para_premio;
          db.customers = db.customers.map((c) => {
            if (c.id !== target.cliente_id) return c;
            const nextSellos = Math.min(c.cartilla.sellos_objetivo, c.cartilla.sellos_actuales + qty);
            const nextHist = c.cartilla.sellos_historicos + qty;
            currentSellos = nextSellos;
            objetivo = c.cartilla.sellos_objetivo;
            return {
              ...c,
              total_visitas: c.total_visitas + 1,
              ultima_visita_at: nowIso,
              cartilla: {
                ...c.cartilla,
                sellos_actuales: nextSellos,
                sellos_historicos: nextHist,
                nivel: computeNivel(nextHist),
                premio_disponible: nextSellos >= c.cartilla.sellos_objetivo,
                updated_at: nowIso,
              },
            };
          });
          writeLocalPosDb(db);

          broadcastDemoStampEvent({
            clienteId: target.cliente_id,
            kind: 'stamp',
            cantidadAgregada: qty,
            detalle,
            sellosActuales: currentSellos,
            sellosObjetivo: objetivo,
            nombreCliente: target.cliente_nombre || 'Cliente',
            negocioNombre: negocio.nombre,
            nombrePremio: negocio.nombre_premio,
            createdAt: nowIso,
          });
        }

        broadcastCoworkingSync({
          negocioId: negocio.id,
          reservaId,
          clienteId: target.cliente_id,
          tipo: 'checkin',
          timestamp: nowIso,
        });

        void sendCoworkingPush({
          reserva: target,
          kind: 'coworking_checkin',
          customTitle: `☕ ¡Bienvenido a tu mesa, ${(target.cliente_nombre || 'Cliente').split(' ')[0]}!`,
          customBody: `Check-in confirmado y +${qty} ${qty === 1 ? 'sello' : 'sellos'} sumados a tu cartilla. ¡Muchos éxitos en tu reunión!`,
        });

        setFeedbackMsg({
          title: `Check-in Coworking · ${target.cliente_nombre || 'Cliente'}`,
          subtitle: `Mesa activada y +${qty} ${qty === 1 ? 'sello acreditado' : 'sellos acreditados'} por su consumo.`,
        });
        void playStampFeedbackSound('pos_ok');
        await loadCoworkingData();
      } finally {
        setActionBusy(false);
      }
    },
    [
      isOnline,
      loadCoworkingData,
      negocio.happy_hour_config,
      negocio.id,
      negocio.nombre,
      negocio.nombre_premio,
      negocio.sellos_para_premio,
      negocio.zona_horaria,
      posSession,
      reservasCoworking,
      sendCoworkingPush,
      supabaseReady,
    ]
  );

  const liberarReservaCoworking = useCallback(
    async (reservaId: string) => {
      if (!posSession) return;
      const target = reservasCoworking.find((r) => r.id === reservaId);
      setActionBusy(true);
      const nowIso = new Date().toISOString();
      try {
        const supabase = getSupabaseClient();
        if (supabase && supabaseReady && isOnline && !reservaId.startsWith('res-')) {
          await supabase
            .from('reservas_coworking')
            .update({ estado: 'cancelada', updated_at: nowIso })
            .eq('id', reservaId);
        } else {
          const updated = reservasCoworking.map((r) =>
            r.id === reservaId ? { ...r, estado: 'cancelada' as const, updated_at: nowIso } : r
          );
          writeLocalReservas(negocio.id, updated);
          setReservasCoworking(updated);
        }

        broadcastCoworkingSync({
          negocioId: negocio.id,
          reservaId,
          clienteId: target?.cliente_id,
          tipo: 'cancelada',
          timestamp: nowIso,
        });
        setFeedbackMsg({
          title: `Mesa liberada (${target?.codigo_reserva || ''})`,
          subtitle: 'El horario vuelve a estar disponible para otros clientes.',
        });
        await loadCoworkingData();
      } finally {
        setActionBusy(false);
      }
    },
    [isOnline, loadCoworkingData, negocio.id, posSession, reservasCoworking, supabaseReady]
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
    happyHourStatus,
    espaciosCoworking,
    reservasCoworking,
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
    confirmarReservaYape,
    rechazarReservaYape,
    checkinReservaCoworking,
    liberarReservaCoworking,
    syncOfflineQueue,
    clearSelection,
  };
}
