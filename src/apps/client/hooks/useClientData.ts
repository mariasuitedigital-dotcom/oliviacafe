import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/src/shared/auth/AuthContext';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import { getSupabaseClient } from '@/src/shared/lib/supabase';
import {
  registerClientPushSubscription,
  unregisterClientPushSubscription,
} from '@/src/shared/pwa/pushSubscription';
import { playStampFeedbackSound } from '@/src/shared/pwa/welcomeSound';
import {
  buildStampEncouragementMessage,
  DEMO_STAMP_CHANNEL,
  DEMO_STAMP_STORAGE_EVENT_KEY,
  showLocalBrowserStampNotification,
  type DemoStampBroadcastPayload,
  type StampEventKind,
} from '@/src/shared/pwa/stampEncouragement';
import {
  evaluateHappyHour,
  readLocalCartaItems,
  type HappyHourEvaluation,
} from '@/src/shared/utils/loyaltyExtras';
import type { Canje, CartaItem, Cartilla, Cliente, Cupon, Promocion, Sello } from '@/src/types/database';

export interface QrTokenState {
  token: string;
  secondsLeft: number;
}

export interface StampCelebrationState {
  id: string;
  kind: StampEventKind;
  title: string;
  body: string;
  badgeText: string;
  isGoalReached: boolean;
}

const LOCAL_STATE_PREFIX = 'olivia_client_demo_state_';

interface DemoStore {
  cliente: Cliente;
  cartilla: Cartilla;
  sellos: Sello[];
  canjes: Canje[];
  cupones: Cupon[];
  ratedToday: number | null;
  mapsBonusClaimed: boolean;
}

function buildInitialDemoStore(
  negocioId: string,
  clienteId: string,
  nombre: string,
  celular: string,
  objetivo: number,
  extra?: {
    dia_nac?: number;
    mes_nac?: number;
    anio_nac?: number | null;
    consentimiento_push?: boolean;
    contacto_guardado?: boolean;
  }
): DemoStore {
  const now = Date.now();
  const cartillaId = `cartilla-${clienteId}`;
  return {
    cliente: {
      id: clienteId,
      negocio_id: negocioId,
      user_id: null,
      nombre: nombre || 'María Quispe',
      celular: celular || '+51987654321',
      fecha_nacimiento_dia: extra?.dia_nac ?? 15,
      fecha_nacimiento_mes: extra?.mes_nac ?? 5,
      fecha_nacimiento_anio: extra?.anio_nac ?? null,
      consentimiento_whatsapp: true,
      consentimiento_push:
        extra?.consentimiento_push ??
        (typeof Notification !== 'undefined' && Notification.permission === 'granted'),
      contacto_guardado: extra?.contacto_guardado ?? false,
      fecha_consentimiento: new Date(now - 86400000 * 14).toISOString(),
      version_consentimiento: 'v1.0-pe-29733',
      baja_whatsapp: false,
      fecha_baja: null,
      origen_registro: 'qr_mesa',
      total_visitas: 6,
      ultima_visita_at: new Date(now - 86400000).toISOString(),
      created_at: new Date(now - 86400000 * 14).toISOString(),
    },
    cartilla: {
      id: cartillaId,
      negocio_id: negocioId,
      cliente_id: clienteId,
      codigo_corto: '#OL-8942',
      sellos_actuales: 6,
      sellos_objetivo: objetivo,
      nivel: 'Bambú',
      sellos_historicos: 6,
      canjes_historicos: 0,
      puntos_bonus: 0,
      premio_disponible: false,
      bonus_instalacion_otorgado: false,
      updated_at: new Date(now - 86400000).toISOString(),
    },
    sellos: [
      {
        id: 'sello-6',
        negocio_id: negocioId,
        sede_id: '22222222-2222-4222-8222-222222222222',
        cliente_id: clienteId,
        cartilla_id: cartillaId,
        cajero_id: null,
        dispositivo_id: null,
        cantidad: 1,
        tipo: 'visita',
        detalle: 'Flat White Doble & Croissant · San Isidro',
        idempotency_key: 'demo-6',
        created_at: new Date(now - 86400000 * 1).toISOString(),
      },
      {
        id: 'sello-5',
        negocio_id: negocioId,
        sede_id: '22222222-2222-4222-8222-222222222221',
        cliente_id: clienteId,
        cartilla_id: cartillaId,
        cajero_id: null,
        dispositivo_id: null,
        cantidad: 1,
        tipo: 'visita',
        detalle: 'V60 Huila Origen Único · Miraflores',
        idempotency_key: 'demo-5',
        created_at: new Date(now - 86400000 * 3).toISOString(),
      },
      {
        id: 'sello-4',
        negocio_id: negocioId,
        sede_id: '22222222-2222-4222-8222-222222222221',
        cliente_id: clienteId,
        cartilla_id: cartillaId,
        cajero_id: null,
        dispositivo_id: null,
        cantidad: 1,
        tipo: 'visita',
        detalle: 'Cold Brew Citron · Miraflores',
        idempotency_key: 'demo-4',
        created_at: new Date(now - 86400000 * 5).toISOString(),
      },
      {
        id: 'sello-3',
        negocio_id: negocioId,
        sede_id: '22222222-2222-4222-8222-222222222222',
        cliente_id: clienteId,
        cartilla_id: cartillaId,
        cajero_id: null,
        dispositivo_id: null,
        cantidad: 1,
        tipo: 'visita',
        detalle: 'Latte de Avena & Alfajor · San Isidro',
        idempotency_key: 'demo-3',
        created_at: new Date(now - 86400000 * 8).toISOString(),
      },
      {
        id: 'sello-2',
        negocio_id: negocioId,
        sede_id: '22222222-2222-4222-8222-222222222221',
        cliente_id: clienteId,
        cartilla_id: cartillaId,
        cajero_id: null,
        dispositivo_id: null,
        cantidad: 1,
        tipo: 'visita',
        detalle: 'Americano Arábica · Miraflores',
        idempotency_key: 'demo-2',
        created_at: new Date(now - 86400000 * 11).toISOString(),
      },
      {
        id: 'sello-1',
        negocio_id: negocioId,
        sede_id: null,
        cliente_id: clienteId,
        cartilla_id: cartillaId,
        cajero_id: null,
        dispositivo_id: null,
        cantidad: 1,
        tipo: 'bienvenida',
        detalle: '1° Sello de Bienvenida al Club',
        idempotency_key: 'demo-1',
        created_at: new Date(now - 86400000 * 14).toISOString(),
      },
    ],
    canjes: [],
    cupones: [],
    ratedToday: null,
    mapsBonusClaimed: false,
  };
}

function buildDemoPromos(negocioId: string): Promocion[] {
  const now = Date.now();
  return [
    {
      id: 'promo-flat-white-combo',
      negocio_id: negocioId,
      titulo: 'Flat White + Croissant de Mantequilla',
      descripcion: 'Combo exclusivo de mañana para miembros del club Olivia Café. Incluye doble sello en tu visita.',
      precio_especial: 18.9,
      precio_regular: 26.0,
      sellos_extra: 2,
      imagen_url: '/src/assets/images/aitama_reward_cup_1794847436322.jpg',
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
      descripcion: 'Extracción en frío de 18h con naranja orgánica de Chanchamayo. Válido de 2:00 pm a 7:00 pm.',
      precio_especial: 12.5,
      precio_regular: 17.0,
      sellos_extra: 1,
      imagen_url: '/src/assets/images/aitama_cafe_hero_1794847435488.jpg',
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

export function useClientData() {
  const { negocio } = useTheme();
  const { user, clientSession, supabaseReady } = useAuth();

  const clienteId = clientSession?.cliente_id || user?.id || 'demo-client-1';
  const storageKey = `${LOCAL_STATE_PREFIX}${negocio.slug}_${clienteId}`;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cartilla, setCartilla] = useState<Cartilla | null>(null);
  const [sellos, setSellos] = useState<Sello[]>([]);
  const [canjes, setCanjes] = useState<Canje[]>([]);
  const [promos, setPromos] = useState<Promocion[]>([]);
  const [cupones, setCupones] = useState<Cupon[]>([]);
  const [cartaItems, setCartaItems] = useState<CartaItem[]>(() =>
    readLocalCartaItems(negocio.id).filter((i) => i.disponible)
  );
  const [happyHourStatus, setHappyHourStatus] = useState<HappyHourEvaluation>(() =>
    evaluateHappyHour(negocio.happy_hour_config, negocio.zona_horaria)
  );
  const [ratedToday, setRatedToday] = useState<number | null>(null);
  const [mapsBonusClaimed, setMapsBonusClaimed] = useState<boolean>(false);
  const [stampCelebration, setStampCelebration] = useState<StampCelebrationState | null>(null);

  useEffect(() => {
    const updateHh = () =>
      setHappyHourStatus(evaluateHappyHour(negocio.happy_hour_config, negocio.zona_horaria));
    updateHh();
    const timer = window.setInterval(updateHh, 30000);
    return () => window.clearInterval(timer);
  }, [negocio.happy_hour_config, negocio.zona_horaria]);

  const prevProgressRef = useRef<{
    clientId: string;
    sellosActuales: number;
    canjesHistoricos: number;
  } | null>(null);
  const lastBroadcastAtRef = useRef<string | null>(null);

  // Token QR rotativo cada 30 segundos
  const [qrState, setQrState] = useState<QrTokenState>({
    token: `OLI-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    secondsLeft: 30,
  });

  const dismissStampCelebration = useCallback(() => {
    setStampCelebration(null);
  }, []);

  const triggerStampCelebration = useCallback(
    (params: {
      kind: StampEventKind;
      nombreCliente: string;
      sellosActuales: number;
      sellosObjetivo: number;
      cantidadAgregada?: number;
      notifyIfBackground?: boolean;
    }) => {
      const msg = buildStampEncouragementMessage({
        negocioNombre: negocio.nombre,
        nombreCliente: params.nombreCliente,
        sellosActuales: params.sellosActuales,
        sellosObjetivo: params.sellosObjetivo,
        nombrePremio: negocio.nombre_premio,
        cantidadAgregada: params.cantidadAgregada || 1,
        kind: params.kind,
      });

      const soundKind =
        params.kind === 'redeem' ? 'redeem' : msg.isGoalReached ? 'goal' : 'stamp';
      void playStampFeedbackSound(soundKind);

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(msg.isGoalReached ? [100, 45, 130, 45, 140] : [80, 40, 120]);
      }

      setStampCelebration({
        id: `${Date.now()}`,
        kind: params.kind,
        title: msg.title,
        body: msg.body,
        badgeText: msg.badgeText,
        isGoalReached: msg.isGoalReached,
      });

      if (
        params.notifyIfBackground &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        void showLocalBrowserStampNotification(msg.title, msg.body, `/c/${negocio.slug}`);
      }
    },
    [negocio.nombre, negocio.nombre_premio, negocio.slug]
  );

  const persistDemoStore = useCallback(
    (next: DemoStore) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore quota errors
      }
    },
    [storageKey]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = getSupabaseClient();

    if (
      supabase &&
      supabaseReady &&
      clientSession?.cliente_id &&
      !clientSession.cliente_id.startsWith('demo-')
    ) {
      try {
        const [{ data: cliData, error: cliErr }, { data: carData, error: carErr }] =
          await Promise.all([
            supabase.from('clientes').select('*').eq('id', clientSession.cliente_id).maybeSingle(),
            supabase
              .from('cartillas')
              .select('*')
              .eq('cliente_id', clientSession.cliente_id)
              .eq('negocio_id', negocio.id)
              .maybeSingle(),
          ]);
        if (cliErr) throw cliErr;
        if (carErr) throw carErr;

        if (cliData && carData) {
          setCliente(cliData as Cliente);
          setCartilla(carData as Cartilla);

          const [{ data: sellosData }, { data: canjesData }, { data: promosData }, { data: cuponesData }, { data: cartaData }] =
            await Promise.all([
              supabase
                .from('sellos')
                .select('*')
                .eq('cliente_id', clientSession.cliente_id)
                .order('created_at', { ascending: false })
                .limit(40),
              supabase
                .from('canjes')
                .select('*')
                .eq('cliente_id', clientSession.cliente_id)
                .order('created_at', { ascending: false })
                .limit(20),
              supabase
                .from('promociones')
                .select('*')
                .eq('negocio_id', negocio.id)
                .eq('activa', true)
                .gt('vigencia_fin', new Date().toISOString())
                .order('vigencia_fin', { ascending: true }),
              supabase
                .from('cupones')
                .select('*')
                .eq('cliente_id', clientSession.cliente_id)
                .order('activado_at', { ascending: false }),
              supabase
                .from('carta_items')
                .select('*')
                .eq('negocio_id', negocio.id)
                .eq('disponible', true)
                .order('orden', { ascending: true }),
            ]);

          setSellos((sellosData as Sello[]) || []);
          setCanjes((canjesData as Canje[]) || []);
          setPromos((promosData as Promocion[]) || []);
          setCupones((cuponesData as Cupon[]) || []);
          setCartaItems(
            Array.isArray(cartaData) && cartaData.length > 0
              ? (cartaData as CartaItem[])
              : readLocalCartaItems(negocio.id).filter((i) => i.disponible)
          );
          setLoading(false);
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando tu cartilla.');
      }
    }

    // Modo local interactivo
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed: DemoStore = raw
        ? (JSON.parse(raw) as DemoStore)
        : buildInitialDemoStore(
            negocio.id,
            clienteId,
            clientSession?.nombre || 'María Quispe',
            clientSession?.celular || '+51987654321',
            negocio.sellos_para_premio,
            clientSession || undefined
          );
      if (!raw) persistDemoStore(parsed);
      setCliente(parsed.cliente);
      setCartilla(parsed.cartilla);
      setSellos(parsed.sellos);
      setCanjes(parsed.canjes);
      setCupones(parsed.cupones);
      setRatedToday(parsed.ratedToday);
      setMapsBonusClaimed(parsed.mapsBonusClaimed);
      setPromos(buildDemoPromos(negocio.id));
      setCartaItems(readLocalCartaItems(negocio.id).filter((i) => i.disponible));
    } catch {
      const fallback = buildInitialDemoStore(
        negocio.id,
        clienteId,
        clientSession?.nombre || 'María Quispe',
        clientSession?.celular || '+51987654321',
        negocio.sellos_para_premio,
        clientSession || undefined
      );
      setCliente(fallback.cliente);
      setCartilla(fallback.cartilla);
      setSellos(fallback.sellos);
      setPromos(buildDemoPromos(negocio.id));
      setCartaItems(readLocalCartaItems(negocio.id).filter((i) => i.disponible));
    } finally {
      setLoading(false);
    }
  }, [clientSession, clienteId, negocio.id, negocio.sellos_para_premio, persistDemoStore, storageKey, supabaseReady]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Rotación de token QR cada 30 segundos
  const refreshQrToken = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase && supabaseReady && cliente && !cliente.id.startsWith('demo-')) {
      try {
        const { data, error: rpcErr } = await supabase.rpc('generar_token_qr', {
          p_negocio_id: negocio.id,
          p_cliente_id: cliente.id,
        });
        if (!rpcErr && data) {
          const payload = data as { token: string; ttl_segundos?: number };
          setQrState({ token: payload.token, secondsLeft: payload.ttl_segundos || 30 });
          return;
        }
      } catch {
        // Fallback local token si falla red
      }
    }
    const randomPart = Math.random().toString(36).slice(2, 10).toUpperCase();
    setQrState({
      token: `OLI-${cartilla?.codigo_corto?.replace('#', '') || 'CARD'}-${randomPart}`,
      secondsLeft: 30,
    });
  }, [cartilla?.codigo_corto, cliente, negocio.id, supabaseReady]);

  useEffect(() => {
    void refreshQrToken();
  }, [refreshQrToken]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setQrState((prev) => {
        if (prev.secondsLeft <= 1) {
          void refreshQrToken();
          return { ...prev, secondsLeft: 30 };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [refreshQrToken]);

  // Detectar incrementos de sellos o canjes (Realtime) para reproducir sonido y mensaje de aliento
  useEffect(() => {
    if (!cliente || !cartilla) return;
    const prev = prevProgressRef.current;

    if (!prev || prev.clientId !== cliente.id) {
      prevProgressRef.current = {
        clientId: cliente.id,
        sellosActuales: cartilla.sellos_actuales,
        canjesHistoricos: cartilla.canjes_historicos,
      };
      return;
    }

    if (cartilla.canjes_historicos > prev.canjesHistoricos) {
      triggerStampCelebration({
        kind: 'redeem',
        nombreCliente: cliente.nombre,
        sellosActuales: cartilla.sellos_actuales,
        sellosObjetivo: cartilla.sellos_objetivo,
      });
    } else if (cartilla.sellos_actuales > prev.sellosActuales) {
      triggerStampCelebration({
        kind: 'stamp',
        nombreCliente: cliente.nombre,
        sellosActuales: cartilla.sellos_actuales,
        sellosObjetivo: cartilla.sellos_objetivo,
        cantidadAgregada: cartilla.sellos_actuales - prev.sellosActuales,
      });
    }

    prevProgressRef.current = {
      clientId: cliente.id,
      sellosActuales: cartilla.sellos_actuales,
      canjesHistoricos: cartilla.canjes_historicos,
    };
  }, [cartilla, cliente, triggerStampCelebration]);

  // Suscripción Realtime a cartillas para actualizar al instante cuando el cajero sella
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase || !supabaseReady || !cliente || cliente.id.startsWith('demo-')) return;

    const channel = supabase
      .channel(`cartilla-live-${cliente.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cartillas', filter: `cliente_id=eq.${cliente.id}` },
        () => {
          void loadData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [cliente, loadData, supabaseReady]);

  // Sincronización en vivo en modo demo entre Caja POS y Cartilla (BroadcastChannel + storage)
  useEffect(() => {
    if (!cliente || !cartilla || !cliente.id.startsWith('demo-')) return;

    const clientDigits = cliente.celular.replace(/\D/g, '').slice(-9);

    const applyBroadcast = (payload: DemoStampBroadcastPayload) => {
      if (!payload || !payload.createdAt || lastBroadcastAtRef.current === payload.createdAt) {
        return;
      }
      const matchesClient =
        payload.clienteId === cliente.id ||
        (payload.clientePhoneDigits && clientDigits && payload.clientePhoneDigits === clientDigits);
      if (!matchesClient) return;

      lastBroadcastAtRef.current = payload.createdAt;

      const nextCartilla: Cartilla =
        payload.kind === 'redeem'
          ? {
              ...cartilla,
              sellos_actuales: 0,
              premio_disponible: false,
              canjes_historicos: cartilla.canjes_historicos + 1,
              updated_at: payload.createdAt,
            }
          : {
              ...cartilla,
              sellos_actuales: payload.sellosActuales,
              sellos_historicos: cartilla.sellos_historicos + Math.max(1, payload.cantidadAgregada),
              premio_disponible: payload.sellosActuales >= cartilla.sellos_objetivo,
              updated_at: payload.createdAt,
            };

      const nextSellos =
        payload.kind === 'stamp'
          ? [
              {
                id: `sello-live-${Date.now()}`,
                negocio_id: negocio.id,
                sede_id: null,
                cliente_id: cliente.id,
                cartilla_id: cartilla.id,
                cajero_id: null,
                dispositivo_id: null,
                cantidad: Math.max(1, payload.cantidadAgregada),
                tipo: 'visita' as const,
                detalle: payload.detalle || 'Consumo en barra',
                idempotency_key: `live-${payload.createdAt}`,
                created_at: payload.createdAt,
              },
              ...sellos,
            ]
          : sellos;

      const nextCanjes: Canje[] =
        payload.kind === 'redeem'
          ? [
              {
                id: `canje-live-${Date.now()}`,
                negocio_id: negocio.id,
                sede_id: null,
                cliente_id: cliente.id,
                cartilla_id: cartilla.id,
                cajero_id: null,
                premio_entregado: payload.nombrePremio || negocio.nombre_premio,
                sellos_consumidos: cartilla.sellos_objetivo,
                verificado_otp: true,
                created_at: payload.createdAt,
              },
              ...canjes,
            ]
          : canjes;

      setCartilla(nextCartilla);
      setSellos(nextSellos);
      setCanjes(nextCanjes);
      persistDemoStore({
        cliente,
        cartilla: nextCartilla,
        sellos: nextSellos,
        canjes: nextCanjes,
        cupones,
        ratedToday,
        mapsBonusClaimed,
      });
    };

    let ch: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      ch = new BroadcastChannel(DEMO_STAMP_CHANNEL);
      ch.onmessage = (event: MessageEvent<DemoStampBroadcastPayload>) => {
        applyBroadcast(event.data);
      };
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === DEMO_STAMP_STORAGE_EVENT_KEY && e.newValue) {
        try {
          applyBroadcast(JSON.parse(e.newValue) as DemoStampBroadcastPayload);
        } catch {
          // Ignorar error de parseo
        }
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      ch?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, [
    canjes,
    cartilla,
    cliente,
    cupones,
    mapsBonusClaimed,
    negocio.id,
    negocio.nombre_premio,
    persistDemoStore,
    ratedToday,
    sellos,
  ]);

  const activarPromo = useCallback(
    async (promoId: string): Promise<{ cupon?: Cupon; error?: string }> => {
      if (!cliente) return { error: 'Sesión no disponible' };
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady && !cliente.id.startsWith('demo-')) {
        const { data, error: rpcErr } = await supabase.rpc('activar_promo', {
          p_negocio_id: negocio.id,
          p_promocion_id: promoId,
          p_cliente_id: cliente.id,
        });
        if (rpcErr) return { error: rpcErr.message };
        const created = data as Cupon;
        setCupones((prev) => [created, ...prev]);
        return { cupon: created };
      }

      const targetPromo = promos.find((p) => p.id === promoId);
      if (!targetPromo) return { error: 'Promoción no encontrada' };

      const usedCount = cupones.filter(
        (c) => c.promocion_id === promoId && (c.estado === 'activo' || c.estado === 'canjeado')
      ).length;
      if (usedCount >= targetPromo.limite_por_cliente) {
        return { error: `Ya alcanzaste el límite (${targetPromo.limite_por_cliente}) de esta promo.` };
      }

      const newCupon: Cupon = {
        id: `cup-${Date.now()}`,
        negocio_id: negocio.id,
        promocion_id: promoId,
        cliente_id: cliente.id,
        codigo_qr: `CUP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        estado: 'activo',
        activado_at: new Date().toISOString(),
        expira_at: targetPromo.vigencia_fin,
        canjeado_at: null,
      };
      const nextCupones = [newCupon, ...cupones];
      setCupones(nextCupones);
      if (cartilla) {
        persistDemoStore({
          cliente,
          cartilla,
          sellos,
          canjes,
          cupones: nextCupones,
          ratedToday,
          mapsBonusClaimed,
        });
      }
      return { cupon: newCupon };
    },
    [canjes, cartilla, cliente, cupones, mapsBonusClaimed, negocio.id, persistDemoStore, promos, ratedToday, sellos, supabaseReady]
  );

  const enviarEncuesta = useCallback(
    async (calificacion: number, comentario?: string) => {
      if (!cliente) return;
      setRatedToday(calificacion);
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady && !cliente.id.startsWith('demo-')) {
        await supabase.from('encuestas').insert({
          negocio_id: negocio.id,
          cliente_id: cliente.id,
          calificacion,
          comentario: comentario || null,
          redirigido_maps: calificacion === 5,
        });
      } else if (cartilla) {
        persistDemoStore({
          cliente,
          cartilla,
          sellos,
          canjes,
          cupones,
          ratedToday: calificacion,
          mapsBonusClaimed,
        });
      }
    },
    [canjes, cartilla, cliente, cupones, mapsBonusClaimed, negocio.id, persistDemoStore, sellos, supabaseReady]
  );

  const reclamarBonusMaps = useCallback(async () => {
    if (!cliente || !cartilla || mapsBonusClaimed) return;
    setMapsBonusClaimed(true);
    const nextCartilla: Cartilla = {
      ...cartilla,
      puntos_bonus: cartilla.puntos_bonus + 10,
    };
    setCartilla(nextCartilla);

    const supabase = getSupabaseClient();
    if (supabase && supabaseReady && !cliente.id.startsWith('demo-')) {
      await supabase
        .from('cartillas')
        .update({ puntos_bonus: nextCartilla.puntos_bonus })
        .eq('id', cartilla.id);
    } else {
      persistDemoStore({
        cliente,
        cartilla: nextCartilla,
        sellos,
        canjes,
        cupones,
        ratedToday,
        mapsBonusClaimed: true,
      });
    }
  }, [canjes, cartilla, cliente, cupones, mapsBonusClaimed, persistDemoStore, ratedToday, sellos, supabaseReady]);

  const activarPushYBonus = useCallback(async (): Promise<{ granted: boolean; bonusGiven: boolean; error?: string }> => {
    if (!cliente || !cartilla) return { granted: false, bonusGiven: false, error: 'Sin sesión' };
    if (typeof Notification === 'undefined') {
      return { granted: false, bonusGiven: false, error: 'Tu navegador no soporta notificaciones Web Push.' };
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { granted: false, bonusGiven: false, error: 'Permiso rechazado. Puedes activarlo desde los ajustes del sitio.' };
    }

    await registerClientPushSubscription(negocio.id, cliente.id);

    let bonusGiven = false;
    const supabase = getSupabaseClient();
    if (supabase && supabaseReady && !cliente.id.startsWith('demo-')) {
      await supabase
        .from('clientes')
        .update({ consentimiento_push: true })
        .eq('id', cliente.id);

      const { data } = await supabase.rpc('otorgar_bonus_instalacion', {
        p_negocio_id: negocio.id,
        p_cliente_id: cliente.id,
      });
      const res = data as { otorgado?: boolean } | null;
      bonusGiven = Boolean(res?.otorgado);
      await loadData();
    } else {
      const nextCliente: Cliente = { ...cliente, consentimiento_push: true };
      let nextCartilla = { ...cartilla };
      let nextSellos = [...sellos];
      if (!cartilla.bonus_instalacion_otorgado) {
        bonusGiven = true;
        const nuevoTotal = Math.min(cartilla.sellos_objetivo, cartilla.sellos_actuales + 1);
        nextCartilla = {
          ...cartilla,
          sellos_actuales: nuevoTotal,
          sellos_historicos: cartilla.sellos_historicos + 1,
          premio_disponible: nuevoTotal >= cartilla.sellos_objetivo,
          bonus_instalacion_otorgado: true,
        };
        nextSellos = [
          {
            id: `sello-pwa-${Date.now()}`,
            negocio_id: negocio.id,
            sede_id: null,
            cliente_id: cliente.id,
            cartilla_id: cartilla.id,
            cajero_id: null,
            dispositivo_id: null,
            cantidad: 1,
            tipo: 'instalacion_pwa',
            detalle: 'Bonus instalar App y activar alertas',
            idempotency_key: `pwa-${cliente.id}`,
            created_at: new Date().toISOString(),
          },
          ...sellos,
        ];
      }
      setCliente(nextCliente);
      setCartilla(nextCartilla);
      setSellos(nextSellos);
      persistDemoStore({
        cliente: nextCliente,
        cartilla: nextCartilla,
        sellos: nextSellos,
        canjes,
        cupones,
        ratedToday,
        mapsBonusClaimed,
      });
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([70, 40, 100]);
    }
    return { granted: true, bonusGiven };
  }, [canjes, cartilla, cliente, cupones, loadData, mapsBonusClaimed, negocio.id, persistDemoStore, ratedToday, sellos, supabaseReady]);

  const actualizarPerfil = useCallback(
    async (
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
    ) => {
      if (!cliente || !cartilla) return;
      const nextCliente: Cliente = {
        ...cliente,
        ...updates,
        fecha_baja: updates.baja_whatsapp ? new Date().toISOString() : cliente.fecha_baja,
      };
      setCliente(nextCliente);

      if (updates.consentimiento_push === false) {
        await unregisterClientPushSubscription();
      } else if (updates.consentimiento_push === true) {
        await registerClientPushSubscription(negocio.id, cliente.id);
      }

      const supabase = getSupabaseClient();
      if (supabase && supabaseReady && !cliente.id.startsWith('demo-')) {
        await supabase.from('clientes').update(updates).eq('id', cliente.id);
      } else {
        persistDemoStore({
          cliente: nextCliente,
          cartilla,
          sellos,
          canjes,
          cupones,
          ratedToday,
          mapsBonusClaimed,
        });
      }
    },
    [canjes, cartilla, cliente, cupones, mapsBonusClaimed, persistDemoStore, ratedToday, sellos, supabaseReady]
  );

  return {
    loading,
    error,
    cliente,
    cartilla,
    sellos,
    canjes,
    promos,
    cupones,
    cartaItems,
    happyHourStatus,
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
    reload: loadData,
  };
}
