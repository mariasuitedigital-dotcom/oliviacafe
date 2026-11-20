import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/src/shared/lib/supabase';
import { useTheme } from '@/src/shared/theme/ThemeProvider';
import type {
  CanalMensaje,
  CartaItem,
  Negocio,
  NivelConfig,
  NivelLealtad,
  Promocion,
  Sede,
} from '@/src/types/database';
import {
  readLocalCartaItems,
  writeLocalCartaItems,
} from '@/src/shared/utils/loyaltyExtras';
import {
  createPosUserByAdminLocal,
  listLocalAccounts,
  resetAccountOtpActivationLocal,
  toggleAccountActiveLocal,
} from '@/src/shared/auth/accessProvisioning';

export interface AdminClienteRow {
  id: string;
  nombre: string;
  celular: string;
  sellos_actuales: number;
  sellos_objetivo: number;
  sellos_historicos: number;
  canjes_historicos: number;
  nivel: NivelLealtad;
  total_visitas: number;
  ultima_visita_at: string;
  consentimiento_whatsapp: boolean;
  consentimiento_push: boolean;
  baja_whatsapp: boolean;
  fecha_nacimiento_dia: number | null;
  fecha_nacimiento_mes: number | null;
  total_referidos_exitosos: number;
}

export interface AdminAutomatizacion {
  id: string;
  tipo: string;
  nombre_visible: string;
  activo: boolean;
  canal: CanalMensaje;
  plantilla: string;
}

export interface AdminDispositivo {
  id: string;
  sede_id: string;
  sede_nombre: string;
  nombre: string;
  codigo_emparejamiento: string;
  emparejado: boolean;
  activo: boolean;
  ultimo_acceso_at: string | null;
}

export interface AdminCajero {
  id: string;
  sede_id: string;
  sede_nombre: string;
  nombre_completo: string;
  celular_otp: string | null;
  primer_ingreso_pendiente: boolean;
  activo: boolean;
  pin_configurado: boolean;
}

export interface AdminAuditoriaRow {
  id: string;
  accion: string;
  detalle: string;
  alerta_fraude: boolean;
  created_at: string;
}

export interface AdminEncuestaRow {
  id: string;
  cliente_nombre: string;
  calificacion: number;
  comentario: string | null;
  created_at: string;
}

export interface AdminCampana {
  id: string;
  titulo: string;
  audiencia: string;
  canal: CanalMensaje;
  total_destinatarios: number;
  enviados: number;
  created_at: string;
}

interface AdminDemoStore {
  sedes: Sede[];
  clientes: AdminClienteRow[];
  promociones: Promocion[];
  automatizaciones: AdminAutomatizacion[];
  dispositivos: AdminDispositivo[];
  cajeros: AdminCajero[];
  auditoria: AdminAuditoriaRow[];
  encuestas: AdminEncuestaRow[];
  campanas: AdminCampana[];
  evolutionStatus: 'conectado' | 'qr_pendiente' | 'desconectado';
}

const ADMIN_DEMO_KEY = 'olivia_admin_demo_store_v1';

function buildInitialAdminDemoStore(negocio: Negocio): AdminDemoStore {
  const now = Date.now();
  return {
    sedes: [
      {
        id: '22222222-2222-4222-8222-222222222221',
        negocio_id: negocio.id,
        nombre: 'Local Principal · Miraflores',
        direccion: 'Av. La Mar 1240, Miraflores, Lima',
        telefono: '+51 1 445 8920',
        activo: true,
        created_at: new Date(now - 86400000 * 60).toISOString(),
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        negocio_id: negocio.id,
        nombre: 'Barra Express · San Isidro',
        direccion: 'Calle Miguel Dasso 185, San Isidro, Lima',
        telefono: '+51 1 422 3310',
        activo: true,
        created_at: new Date(now - 86400000 * 30).toISOString(),
      },
    ],
    clientes: [
      {
        id: 'demo-client-1',
        nombre: 'María Quispe',
        celular: '+51987654321',
        sellos_actuales: 6,
        sellos_objetivo: negocio.sellos_para_premio,
        sellos_historicos: 16,
        canjes_historicos: 1,
        nivel: 'Plata',
        total_visitas: 6,
        ultima_visita_at: new Date(now - 86400000 * 2).toISOString(),
        consentimiento_whatsapp: true,
        consentimiento_push: true,
        baja_whatsapp: false,
        fecha_nacimiento_dia: 15,
        fecha_nacimiento_mes: 5,
        total_referidos_exitosos: 2,
      },
    ],
    promociones: [
      {
        id: 'promo-flat-white-combo',
        negocio_id: negocio.id,
        titulo: 'Flat White + Croissant de Mantequilla',
        descripcion: 'Combo exclusivo de mañana para miembros del club. Incluye 2 sellos en tu cartilla.',
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
        negocio_id: negocio.id,
        titulo: 'Cold Brew Citron de Tarde',
        descripcion: 'Extracción en frío 18h con naranja orgánica de Chanchamayo.',
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
    ],
    automatizaciones: [
      {
        id: 'auto-1',
        tipo: 'bienvenida',
        nombre_visible: 'Bienvenida al Club',
        activo: true,
        canal: 'whatsapp',
        plantilla:
          '¡Hola {nombre}! Bienvenido a Olivia Café ☕ Ya tienes 1 sello de bienvenida. Mira tu cartilla aquí: {url}. Responde BAJA para no recibir más.',
      },
      {
        id: 'auto-2',
        tipo: 'casi_premio',
        nombre_visible: 'A 1 sello del premio',
        activo: true,
        canal: 'push',
        plantilla: '¡{nombre}, te falta solo {falta} sello para tu {premio} gratis en Olivia Café!',
      },
      {
        id: 'auto-3',
        tipo: 'premio_listo',
        nombre_visible: 'Premio listo para canjear',
        activo: true,
        canal: 'whatsapp',
        plantilla:
          '🎉 ¡Felicidades, {nombre}! Completaste {sellos} sellos. Tu {premio} te espera en Olivia Café. Responde BAJA para no recibir más.',
      },
      {
        id: 'auto-4',
        tipo: 'cumpleanos',
        nombre_visible: 'Regalo de Cumpleaños',
        activo: true,
        canal: 'whatsapp',
        plantilla:
          '🎂 ¡Feliz cumpleaños, {nombre}! Pasa por Olivia Café esta semana y disfruta una porción de tarta artesanal gratis. Responde BAJA para no recibir más.',
      },
      {
        id: 'auto-5',
        tipo: 'reactivacion_15',
        nombre_visible: 'Reactivación 15 días sin visita',
        activo: true,
        canal: 'whatsapp',
        plantilla:
          '¡Te extrañamos, {nombre}! Llevas {sellos} sellos en tu cartilla de Olivia Café. Vuelve esta semana por tu café de especialidad.',
      },
      {
        id: 'auto-6',
        tipo: 'encuesta_visita',
        nombre_visible: 'Encuesta 2h post-visita (desde 3er sello)',
        activo: true,
        canal: 'push',
        plantilla: 'Hola {nombre}, ¿cómo estuvo tu café hoy en Olivia Café? Calíficanos del 1 al 5 ⭐.',
      },
    ],
    dispositivos: [
      {
        id: '33333333-3333-4333-8333-333333333331',
        sede_id: '22222222-2222-4222-8222-222222222221',
        sede_nombre: 'Local Principal · Miraflores',
        nombre: 'Caja 01 · Barra Miraflores',
        codigo_emparejamiento: 'OLIVIA-CAJA-01',
        emparejado: true,
        activo: true,
        ultimo_acceso_at: new Date(now - 1800000).toISOString(),
      },
      {
        id: '33333333-3333-4333-8333-333333333332',
        sede_id: '22222222-2222-4222-8222-222222222222',
        sede_nombre: 'Barra Express · San Isidro',
        nombre: 'Caja 02 · San Isidro',
        codigo_emparejamiento: 'OLIVIA-CAJA-02',
        emparejado: false,
        activo: true,
        ultimo_acceso_at: null,
      },
    ],
    cajeros: listLocalAccounts()
      .filter((a) => a.rol === 'cashier')
      .map((a) => ({
        id: a.id,
        sede_id: a.sede_id || '22222222-2222-4222-8222-222222222221',
        sede_nombre: a.sede_nombre,
        nombre_completo: a.nombre_completo,
        celular_otp: a.celular_otp,
        primer_ingreso_pendiente: a.primer_ingreso_pendiente,
        activo: a.activo,
        pin_configurado: true,
      })),
    auditoria: [
      {
        id: 'aud-1',
        accion: 'dar_sello',
        detalle: 'Carlos M. asignó +1 sello en Caja 01 · Miraflores',
        alerta_fraude: false,
        created_at: new Date(now - 3600000 * 2).toISOString(),
      },
      {
        id: 'aud-2',
        accion: 'pin_invalido',
        detalle: 'Intento de PIN incorrecto en Caja 02 · San Isidro',
        alerta_fraude: false,
        created_at: new Date(now - 3600000 * 6).toISOString(),
      },
      {
        id: 'aud-3',
        accion: 'rafaga_sellos',
        detalle: 'Alerta preventiva: verificación automática de intervalo mínimo superada correctamente',
        alerta_fraude: true,
        created_at: new Date(now - 86400000 * 2).toISOString(),
      },
    ],
    encuestas: [
      {
        id: 'enc-1',
        cliente_nombre: 'Lucía Fernández',
        calificacion: 5,
        comentario: 'Excelente Flat White y atención súper rápida.',
        created_at: new Date(now - 3600000 * 4).toISOString(),
      },
      {
        id: 'enc-2',
        cliente_nombre: 'Diego Salgado',
        calificacion: 3,
        comentario: 'El Cold Brew estuvo bueno, pero faltó hielo en hora punta.',
        created_at: new Date(now - 86400000 * 3).toISOString(),
      },
    ],
    campanas: [
      {
        id: 'camp-1',
        titulo: 'Reactivación Tardes de Café',
        audiencia: 'inactivos_15',
        canal: 'whatsapp',
        total_destinatarios: 32,
        enviados: 32,
        created_at: new Date(now - 86400000 * 5).toISOString(),
      },
    ],
    evolutionStatus: 'conectado',
  };
}

export function useAdminData(supabaseReady: boolean) {
  const { negocio, setNegocioOverride } = useTheme();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<AdminDemoStore>(() => buildInitialAdminDemoStore(negocio));
  const [cartaItems, setCartaItems] = useState<CartaItem[]>(() => readLocalCartaItems(negocio.id));
  const [actionToast, setActionToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setActionToast(msg);
    window.setTimeout(() => setActionToast(null), 3500);
  }, []);

  const persistStore = useCallback((next: AdminDemoStore) => {
    setStore(next);
    try {
      localStorage.setItem(ADMIN_DEMO_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabaseClient();

    if (supabase && supabaseReady) {
      try {
        const [
          { data: sedesData },
          { data: clientesData },
          { data: promosData },
          { data: autosData },
          { data: dispData },
          { data: staffData },
          { data: audData },
          { data: encData },
          { data: cartaData },
        ] = await Promise.all([
          supabase.from('sedes').select('*').eq('negocio_id', negocio.id),
          supabase
            .from('clientes')
            .select(
              'id, nombre, celular, total_visitas, ultima_visita_at, consentimiento_whatsapp, consentimiento_push, baja_whatsapp, fecha_nacimiento_dia, fecha_nacimiento_mes, total_referidos_exitosos, cartillas(sellos_actuales, sellos_objetivo, sellos_historicos, canjes_historicos, nivel)'
            )
            .eq('negocio_id', negocio.id)
            .order('ultima_visita_at', { ascending: false })
            .limit(200),
          supabase
            .from('promociones')
            .select('*')
            .eq('negocio_id', negocio.id)
            .order('vigencia_fin', { ascending: false }),
          supabase.from('automatizaciones').select('*').eq('negocio_id', negocio.id),
          supabase.from('dispositivos').select('*').eq('negocio_id', negocio.id),
          supabase
            .from('perfiles')
            .select('id, sede_id, nombre_completo, celular_otp, primer_ingreso_pendiente, activo, pin_hash')
            .eq('negocio_id', negocio.id)
            .in('rol', ['cashier', 'owner']),
          supabase
            .from('auditoria_seguridad')
            .select('*')
            .eq('negocio_id', negocio.id)
            .order('created_at', { ascending: false })
            .limit(40),
          supabase
            .from('encuestas')
            .select('id, calificacion, comentario, created_at, clientes(nombre)')
            .eq('negocio_id', negocio.id)
            .order('created_at', { ascending: false })
            .limit(25),
          supabase
            .from('carta_items')
            .select('*')
            .eq('negocio_id', negocio.id)
            .order('orden', { ascending: true }),
        ]);

        const sedesList = (sedesData as Sede[]) || [];
        const sedeNameMap = new Map(sedesList.map((s) => [s.id, s.nombre]));

        const mappedClientes: AdminClienteRow[] = ((clientesData || []) as Array<Record<string, unknown>>).map(
          (row) => {
            const cartillaArr = Array.isArray(row.cartillas) ? row.cartillas : [row.cartillas];
            const c = (cartillaArr[0] || {}) as Record<string, unknown>;
            return {
              id: String(row.id),
              nombre: String(row.nombre || 'Cliente'),
              celular: String(row.celular || ''),
              sellos_actuales: Number(c.sellos_actuales ?? 0),
              sellos_objetivo: Number(c.sellos_objetivo ?? negocio.sellos_para_premio),
              sellos_historicos: Number(c.sellos_historicos ?? 0),
              canjes_historicos: Number(c.canjes_historicos ?? 0),
              nivel: (c.nivel as NivelLealtad) || 'Bambú',
              total_visitas: Number(row.total_visitas ?? 0),
              ultima_visita_at: String(row.ultima_visita_at || new Date().toISOString()),
              consentimiento_whatsapp: Boolean(row.consentimiento_whatsapp),
              consentimiento_push: Boolean(row.consentimiento_push),
              baja_whatsapp: Boolean(row.baja_whatsapp),
              fecha_nacimiento_dia: (row.fecha_nacimiento_dia as number | null) ?? null,
              fecha_nacimiento_mes: (row.fecha_nacimiento_mes as number | null) ?? null,
              total_referidos_exitosos: Number(row.total_referidos_exitosos ?? 0),
            };
          }
        );

        if (Array.isArray(cartaData) && cartaData.length > 0) {
          setCartaItems(cartaData as CartaItem[]);
          writeLocalCartaItems(negocio.id, cartaData as CartaItem[]);
        } else {
          setCartaItems(readLocalCartaItems(negocio.id));
        }

        setStore((prev) => ({
          ...prev,
          sedes: sedesList.length > 0 ? sedesList : prev.sedes,
          clientes: mappedClientes,
          promociones: (promosData as Promocion[]) || [],
          automatizaciones: (autosData as AdminAutomatizacion[]) || prev.automatizaciones,
          dispositivos: ((dispData || []) as Array<Record<string, unknown>>).map((d) => ({
            id: String(d.id),
            sede_id: String(d.sede_id),
            sede_nombre: sedeNameMap.get(String(d.sede_id)) || 'Sede',
            nombre: String(d.nombre),
            codigo_emparejamiento: String(d.codigo_emparejamiento),
            emparejado: Boolean(d.emparejado),
            activo: Boolean(d.activo),
            ultimo_acceso_at: (d.ultimo_acceso_at as string | null) ?? null,
          })),
          cajeros: ((staffData || []) as Array<Record<string, unknown>>).map((s) => ({
            id: String(s.id),
            sede_id: String(s.sede_id || ''),
            sede_nombre: sedeNameMap.get(String(s.sede_id)) || 'Todas las sedes',
            nombre_completo: String(s.nombre_completo),
            celular_otp: (s.celular_otp as string | null) ?? null,
            primer_ingreso_pendiente: Boolean(s.primer_ingreso_pendiente ?? true),
            activo: Boolean(s.activo),
            pin_configurado: Boolean(s.pin_hash),
          })),
          auditoria: ((audData || []) as Array<Record<string, unknown>>).map((a) => ({
            id: String(a.id),
            accion: String(a.accion),
            detalle: typeof a.detalle === 'string' ? a.detalle : JSON.stringify(a.detalle || {}),
            alerta_fraude: Boolean(a.alerta_fraude),
            created_at: String(a.created_at),
          })),
          encuestas: ((encData || []) as Array<Record<string, unknown>>).map((e) => ({
            id: String(e.id),
            cliente_nombre: String(
              ((e.clientes as Record<string, unknown> | null)?.nombre as string) || 'Cliente'
            ),
            calificacion: Number(e.calificacion),
            comentario: (e.comentario as string | null) ?? null,
            created_at: String(e.created_at),
          })),
          evolutionStatus: (negocio.evolution_status as AdminDemoStore['evolutionStatus']) || 'conectado',
        }));
        setLoading(false);
        return;
      } catch {
        // Fallback to demo store if not connected or empty
      }
    }

    try {
      const syncedCajeros: AdminCajero[] = listLocalAccounts()
        .filter((a) => a.rol === 'cashier')
        .map((a) => ({
          id: a.id,
          sede_id: a.sede_id || '22222222-2222-4222-8222-222222222221',
          sede_nombre: a.sede_nombre,
          nombre_completo: a.nombre_completo,
          celular_otp: a.celular_otp,
          primer_ingreso_pendiente: a.primer_ingreso_pendiente,
          activo: a.activo,
          pin_configurado: true,
        }));
      const raw = localStorage.getItem(ADMIN_DEMO_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AdminDemoStore;
        setStore({ ...parsed, cajeros: syncedCajeros });
      } else {
        const init = buildInitialAdminDemoStore(negocio);
        localStorage.setItem(ADMIN_DEMO_KEY, JSON.stringify(init));
        setStore(init);
      }
      setCartaItems(readLocalCartaItems(negocio.id));
    } catch {
      setStore(buildInitialAdminDemoStore(negocio));
      setCartaItems(readLocalCartaItems(negocio.id));
    } finally {
      setLoading(false);
    }
  }, [negocio, supabaseReady]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const exportClientesCsv = useCallback(() => {
    const headers = [
      'Nombre',
      'Celular',
      'Sellos_Actuales',
      'Objetivo',
      'Nivel',
      'Visitas',
      'Canjes',
      'WhatsApp_OK',
      'Push_OK',
      'Baja_WA',
    ];
    const rows = store.clientes.map((c) => [
      `"${c.nombre.replace(/"/g, '""')}"`,
      c.celular,
      c.sellos_actuales,
      c.sellos_objetivo,
      c.nivel,
      c.total_visitas,
      c.canjes_historicos,
      c.consentimiento_whatsapp ? 'SI' : 'NO',
      c.consentimiento_push ? 'SI' : 'NO',
      c.baja_whatsapp ? 'SI' : 'NO',
    ]);
    const csv = `\uFEFF${[headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `clientes-${negocio.slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    notify(`CSV descargado (${store.clientes.length} clientes).`);
  }, [negocio.slug, notify, store.clientes]);

  const crearPromocion = useCallback(
    async (input: {
      titulo: string;
      descripcion: string;
      precio_especial: number;
      precio_regular: number | null;
      sellos_extra: number;
      limite_por_cliente: number;
      dias_vigencia: number;
      audiencia: string;
      canal: CanalMensaje;
      imagen_url?: string;
    }) => {
      const now = Date.now();
      const newPromo: Promocion = {
        id: `promo-${now}`,
        negocio_id: negocio.id,
        titulo: input.titulo,
        descripcion: input.descripcion,
        precio_especial: input.precio_especial,
        precio_regular: input.precio_regular,
        sellos_extra: input.sellos_extra,
        imagen_url:
          input.imagen_url || '/src/assets/images/aitama_reward_cup_1794847436322.jpg',
        vigencia_inicio: new Date(now).toISOString(),
        vigencia_fin: new Date(now + 86400000 * input.dias_vigencia).toISOString(),
        limite_por_cliente: input.limite_por_cliente,
        stock_total: 100,
        stock_usado: 0,
        audiencia: input.audiencia,
        canal: input.canal,
        activa: true,
      };

      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        const { data } = await supabase
          .from('promociones')
          .insert({
            negocio_id: negocio.id,
            titulo: input.titulo,
            descripcion: input.descripcion,
            precio_especial: input.precio_especial,
            precio_regular: input.precio_regular,
            sellos_extra: input.sellos_extra,
            vigencia_fin: newPromo.vigencia_fin,
            limite_por_cliente: input.limite_por_cliente,
            audiencia: input.audiencia,
            canal: input.canal,
            imagen_url: newPromo.imagen_url,
          })
          .select()
          .single();
        if (data) {
          persistStore({ ...store, promociones: [data as Promocion, ...store.promociones] });
          notify('Promoción publicada para tus clientes.');
          return;
        }
      }

      persistStore({ ...store, promociones: [newPromo, ...store.promociones] });
      notify('Promoción publicada para tus clientes.');
    },
    [negocio.id, notify, persistStore, store, supabaseReady]
  );

  const actualizarPromocion = useCallback(
    async (
      promoId: string,
      input: {
        titulo: string;
        descripcion: string;
        precio_especial: number;
        precio_regular: number | null;
        sellos_extra: number;
        imagen_url?: string;
      }
    ) => {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase
          .from('promociones')
          .update({
            titulo: input.titulo,
            descripcion: input.descripcion,
            precio_especial: input.precio_especial,
            precio_regular: input.precio_regular,
            sellos_extra: input.sellos_extra,
            imagen_url: input.imagen_url || undefined,
          })
          .eq('id', promoId);
      }
      persistStore({
        ...store,
        promociones: store.promociones.map((p) =>
          p.id === promoId
            ? {
                ...p,
                titulo: input.titulo,
                descripcion: input.descripcion,
                precio_especial: input.precio_especial,
                precio_regular: input.precio_regular,
                sellos_extra: input.sellos_extra,
                imagen_url: input.imagen_url || p.imagen_url,
              }
            : p
        ),
      });
      notify('Promoción actualizada exitosamente.');
    },
    [notify, persistStore, store, supabaseReady]
  );

  const eliminarPromocion = useCallback(
    async (promoId: string) => {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase.from('promociones').delete().eq('id', promoId);
      }
      persistStore({
        ...store,
        promociones: store.promociones.filter((p) => p.id !== promoId),
      });
      notify('Promoción eliminada.');
    },
    [notify, persistStore, store, supabaseReady]
  );

  const togglePromocion = useCallback(
    async (promoId: string) => {
      const target = store.promociones.find((p) => p.id === promoId);
      if (!target) return;
      const nextActive = !target.activa;

      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase.from('promociones').update({ activa: nextActive }).eq('id', promoId);
      }

      persistStore({
        ...store,
        promociones: store.promociones.map((p) =>
          p.id === promoId ? { ...p, activa: nextActive } : p
        ),
      });
      notify(nextActive ? 'Promoción activada.' : 'Promoción pausada.');
    },
    [notify, persistStore, store, supabaseReady]
  );

  const lanzarCampana = useCallback(
    async (input: {
      titulo: string;
      mensaje: string;
      audiencia: 'todos' | 'inactivos_15' | 'casi_premio';
      canal: CanalMensaje;
    }) => {
      const targetClientes = store.clientes.filter((c) => {
        if (input.audiencia === 'casi_premio') {
          return c.sellos_actuales >= c.sellos_objetivo - 2;
        }
        if (input.audiencia === 'inactivos_15') {
          const daysAgo = (Date.now() - new Date(c.ultima_visita_at).getTime()) / 86400000;
          return daysAgo >= 15;
        }
        return true;
      });

      const cappedCount =
        input.canal === 'whatsapp'
          ? Math.min(targetClientes.length, negocio.whatsapp_limite_diario)
          : targetClientes.length;

      const newCamp: AdminCampana = {
        id: `camp-${Date.now()}`,
        titulo: input.titulo,
        audiencia: input.audiencia,
        canal: input.canal,
        total_destinatarios: cappedCount,
        enviados: cappedCount,
        created_at: new Date().toISOString(),
      };

      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase.from('campanas').insert({
          negocio_id: negocio.id,
          nombre: input.titulo,
          segmento: input.audiencia,
          canal: input.canal,
          titulo_push: input.titulo,
          mensaje_plantilla: input.mensaje,
          estado: 'completada',
          total_objetivo: cappedCount,
          total_enviados: cappedCount,
        });
        await supabase.from('eventos_outbox').insert({
          negocio_id: negocio.id,
          tipo_evento: 'campana_masiva',
          payload: {
            titulo: input.titulo,
            mensaje: input.mensaje,
            audiencia: input.audiencia,
            canal: input.canal,
            cliente_ids: targetClientes.slice(0, cappedCount).map((c) => c.id),
          },
        });
      }

      persistStore({ ...store, campanas: [newCamp, ...store.campanas] });
      notify(`Campaña enviada a ${cappedCount} clientes vía ${input.canal.toUpperCase()}.`);
    },
    [negocio.id, negocio.whatsapp_limite_diario, notify, persistStore, store, supabaseReady]
  );

  const updateAutomatizacion = useCallback(
    async (
      id: string,
      updates: Partial<Pick<AdminAutomatizacion, 'activo' | 'canal' | 'plantilla'>>
    ) => {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase.from('automatizaciones').update(updates).eq('id', id);
      }
      persistStore({
        ...store,
        automatizaciones: store.automatizaciones.map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
      });
      notify('Automatización actualizada.');
    },
    [notify, persistStore, store, supabaseReady]
  );

  const toggleEvolutionStatus = useCallback(
    async (status: AdminDemoStore['evolutionStatus']) => {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase.from('negocios').update({ evolution_status: status }).eq('id', negocio.id);
      }
      persistStore({ ...store, evolutionStatus: status });
      notify(
        status === 'conectado'
          ? 'WhatsApp conectado en Evolution API.'
          : 'Escanea el QR desde tu WhatsApp Business.'
      );
    },
    [negocio.id, notify, persistStore, store, supabaseReady]
  );

  const crearDispositivo = useCallback(
    async (nombre: string, sedeId: string) => {
      const codigo = `OLIVIA-CAJA-${String(store.dispositivos.length + 1).padStart(2, '0')}`;
      const sedeNombre = store.sedes.find((s) => s.id === sedeId)?.nombre || 'Sede Principal';

      const newDisp: AdminDispositivo = {
        id: `disp-${Date.now()}`,
        sede_id: sedeId,
        sede_nombre: sedeNombre,
        nombre,
        codigo_emparejamiento: codigo,
        emparejado: false,
        activo: true,
        ultimo_acceso_at: null,
      };

      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        const { data } = await supabase
          .from('dispositivos')
          .insert({
            negocio_id: negocio.id,
            sede_id: sedeId,
            nombre,
            codigo_emparejamiento: codigo,
          })
          .select()
          .single();
        if (data) newDisp.id = String((data as Record<string, unknown>).id);
      }

      persistStore({ ...store, dispositivos: [...store.dispositivos, newDisp] });
      notify(`Terminal creada · Código: ${codigo}`);
    },
    [negocio.id, notify, persistStore, store, supabaseReady]
  );

  const crearCajero = useCallback(
    async (input: {
      nombreCompleto: string;
      sedeId: string;
      celularOtp: string;
      clavePos: string;
    }) => {
      const sedeNombre = store.sedes.find((s) => s.id === input.sedeId)?.nombre || 'Sede Principal';
      const supabase = getSupabaseClient();

      if (supabase && supabaseReady) {
        const { error } = await supabase.rpc('admin_crear_usuario_pos', {
          p_negocio_id: negocio.id,
          p_sede_id: input.sedeId,
          p_nombre: input.nombreCompleto,
          p_celular_otp: input.celularOtp,
          p_clave_pos: input.clavePos,
        });
        if (error) {
          notify(error.message);
          return;
        }
        await loadData();
        notify(`Usuario POS ${input.nombreCompleto} creado. Se pedirá OTP en su primer ingreso.`);
        return;
      }

      const res = createPosUserByAdminLocal({
        negocio_id: negocio.id,
        sede_id: input.sedeId,
        sede_nombre: sedeNombre,
        nombre_completo: input.nombreCompleto,
        celular_otp: input.celularOtp,
        clave_pos: input.clavePos,
      });

      if (!res.ok || !res.account) {
        notify(res.error || 'No se pudo crear el usuario POS.');
        return;
      }

      const newCajero: AdminCajero = {
        id: res.account.id,
        sede_id: input.sedeId,
        sede_nombre: sedeNombre,
        nombre_completo: res.account.nombre_completo,
        celular_otp: res.account.celular_otp,
        primer_ingreso_pendiente: true,
        activo: true,
        pin_configurado: true,
      };
      persistStore({ ...store, cajeros: [...store.cajeros, newCajero] });
      notify(
        `Usuario POS ${input.nombreCompleto} creado (clave ${input.clavePos}). Pedirá OTP en su 1.er ingreso.`
      );
    },
    [loadData, negocio.id, notify, persistStore, store, supabaseReady]
  );

  const resetCajeroOtp = useCallback(
    async (id: string) => {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase
          .from('perfiles')
          .update({ primer_ingreso_pendiente: true })
          .eq('id', id);
      } else {
        resetAccountOtpActivationLocal(id);
      }
      persistStore({
        ...store,
        cajeros: store.cajeros.map((c) =>
          c.id === id ? { ...c, primer_ingreso_pendiente: true } : c
        ),
      });
      notify('Se exigirá activación OTP en el próximo ingreso del usuario POS.');
    },
    [notify, persistStore, store, supabaseReady]
  );

  const toggleCajero = useCallback(
    async (id: string) => {
      const target = store.cajeros.find((c) => c.id === id);
      const nextActive = target ? !target.activo : true;
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase.from('perfiles').update({ activo: nextActive }).eq('id', id);
      } else {
        toggleAccountActiveLocal(id);
      }
      persistStore({
        ...store,
        cajeros: store.cajeros.map((c) => (c.id === id ? { ...c, activo: nextActive } : c)),
      });
      notify('Estado del usuario POS actualizado.');
    },
    [notify, persistStore, store, supabaseReady]
  );

  const saveNegocioConfig = useCallback(
    async (
      updates: Partial<
        Pick<
          Negocio,
          | 'nombre'
          | 'subtitulo'
          | 'color_primario'
          | 'color_secundario'
          | 'sellos_para_premio'
          | 'nombre_premio'
          | 'intervalo_minimo_sellos_min'
          | 'niveles_config'
          | 'otp_requerido_login'
          | 'otp_requerido_canje'
          | 'whatsapp_contacto_numero'
          | 'whatsapp_limite_diario'
          | 'horario_envio_inicio'
          | 'horario_envio_fin'
          | 'google_maps_url'
          | 'texto_privacidad'
          | 'referidos_activo'
          | 'referidos_sellos_invitador'
          | 'referidos_sellos_invitado'
          | 'happy_hour_config'
          | 'ticket_promedio_pen'
          | 'costo_premio_pen'
        >
      >
    ) => {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase.from('negocios').update(updates).eq('id', negocio.id);
      }
      setNegocioOverride(updates as Partial<Negocio>);
      notify('Configuración del negocio guardada.');
    },
    [negocio.id, notify, setNegocioOverride, supabaseReady]
  );

  const crearCartaItem = useCallback(
    async (input: {
      categoria: string;
      nombre: string;
      descripcion: string;
      precio: number;
      maridaje: string;
      recomendado: boolean;
      imagen_url?: string;
    }) => {
      const nextOrden = cartaItems.length + 1;
      const newItem: CartaItem = {
        id: `carta-${Date.now()}`,
        negocio_id: negocio.id,
        categoria: input.categoria,
        nombre: input.nombre,
        descripcion: input.descripcion || '',
        precio: input.precio,
        imagen_url: input.imagen_url || null,
        recomendado: input.recomendado,
        maridaje: input.maridaje || '',
        disponible: true,
        orden: nextOrden,
      };
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        const { data } = await supabase
          .from('carta_items')
          .insert({
            negocio_id: negocio.id,
            categoria: input.categoria,
            nombre: input.nombre,
            descripcion: input.descripcion || '',
            precio: input.precio,
            imagen_url: input.imagen_url || null,
            recomendado: input.recomendado,
            maridaje: input.maridaje || '',
            disponible: true,
            orden: nextOrden,
          })
          .select()
          .single();
        if (data) newItem.id = String((data as Record<string, unknown>).id);
      }
      const next = [...cartaItems, newItem];
      setCartaItems(next);
      writeLocalCartaItems(negocio.id, next);
      notify(`"${input.nombre}" agregado a la Carta Digital.`);
    },
    [cartaItems, negocio.id, notify, supabaseReady]
  );

  const actualizarCartaItem = useCallback(
    async (
      id: string,
      input: {
        categoria: string;
        nombre: string;
        descripcion: string;
        precio: number;
        maridaje: string;
        recomendado: boolean;
        imagen_url?: string;
      }
    ) => {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase
          .from('carta_items')
          .update({
            categoria: input.categoria,
            nombre: input.nombre,
            descripcion: input.descripcion || '',
            precio: input.precio,
            maridaje: input.maridaje || '',
            recomendado: input.recomendado,
            imagen_url: input.imagen_url || null,
          })
          .eq('id', id);
      }
      const next = cartaItems.map((item) =>
        item.id === id
          ? {
              ...item,
              categoria: input.categoria,
              nombre: input.nombre,
              descripcion: input.descripcion || '',
              precio: input.precio,
              maridaje: input.maridaje || '',
              recomendado: input.recomendado,
              imagen_url: input.imagen_url || item.imagen_url,
            }
          : item
      );
      setCartaItems(next);
      writeLocalCartaItems(negocio.id, next);
      notify('Producto de carta actualizado.');
    },
    [cartaItems, negocio.id, notify, supabaseReady]
  );

  const toggleCartaItem = useCallback(
    async (id: string) => {
      const target = cartaItems.find((i) => i.id === id);
      if (!target) return;
      const nextDisp = !target.disponible;
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase.from('carta_items').update({ disponible: nextDisp }).eq('id', id);
      }
      const next = cartaItems.map((item) =>
        item.id === id ? { ...item, disponible: nextDisp } : item
      );
      setCartaItems(next);
      writeLocalCartaItems(negocio.id, next);
      notify(nextDisp ? 'Producto visible en carta.' : 'Producto marcado como agotado.');
    },
    [cartaItems, negocio.id, notify, supabaseReady]
  );

  const eliminarCartaItem = useCallback(
    async (id: string) => {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase.from('carta_items').delete().eq('id', id);
      }
      const next = cartaItems.filter((item) => item.id !== id);
      setCartaItems(next);
      writeLocalCartaItems(negocio.id, next);
      notify('Producto eliminado de la Carta Digital.');
    },
    [cartaItems, negocio.id, notify, supabaseReady]
  );

  const updateNiveles = useCallback(
    async (niveles: NivelConfig[]) => {
      await saveNegocioConfig({ niveles_config: niveles });
    },
    [saveNegocioConfig]
  );

  const crearSede = useCallback(
    async (input: { nombre: string; direccion: string; telefono: string }) => {
      const newSede: Sede = {
        id: `sede-${Date.now()}`,
        negocio_id: negocio.id,
        nombre: input.nombre,
        direccion: input.direccion,
        telefono: input.telefono,
        activo: true,
        created_at: new Date().toISOString(),
      };
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        const { data } = await supabase
          .from('sedes')
          .insert({
            negocio_id: negocio.id,
            nombre: input.nombre,
            direccion: input.direccion,
            telefono: input.telefono,
            activo: true,
          })
          .select()
          .single();
        if (data) newSede.id = String((data as Record<string, unknown>).id);
      }
      persistStore({ ...store, sedes: [...store.sedes, newSede] });
      notify(`Sede "${input.nombre}" creada.`);
    },
    [negocio.id, notify, persistStore, store, supabaseReady]
  );

  const actualizarSede = useCallback(
    async (id: string, input: { nombre: string; direccion: string; telefono: string }) => {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase
          .from('sedes')
          .update({
            nombre: input.nombre,
            direccion: input.direccion,
            telefono: input.telefono,
          })
          .eq('id', id);
      }
      persistStore({
        ...store,
        sedes: store.sedes.map((s) => (s.id === id ? { ...s, ...input } : s)),
      });
      notify('Sede actualizada.');
    },
    [notify, persistStore, store, supabaseReady]
  );

  const toggleSede = useCallback(
    async (id: string) => {
      const target = store.sedes.find((s) => s.id === id);
      if (!target) return;
      const nextActive = !target.activo;
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase.from('sedes').update({ activo: nextActive }).eq('id', id);
      }
      persistStore({
        ...store,
        sedes: store.sedes.map((s) => (s.id === id ? { ...s, activo: nextActive } : s)),
      });
      notify(nextActive ? 'Sede activada.' : 'Sede pausada.');
    },
    [notify, persistStore, store, supabaseReady]
  );

  const eliminarSede = useCallback(
    async (id: string) => {
      const supabase = getSupabaseClient();
      if (supabase && supabaseReady) {
        await supabase.from('sedes').delete().eq('id', id);
      }
      persistStore({
        ...store,
        sedes: store.sedes.filter((s) => s.id !== id),
      });
      notify('Sede eliminada.');
    },
    [notify, persistStore, store, supabaseReady]
  );

  return {
    loading,
    negocio,
    sedes: store.sedes,
    clientes: store.clientes,
    promociones: store.promociones,
    automatizaciones: store.automatizaciones,
    dispositivos: store.dispositivos,
    cajeros: store.cajeros,
    auditoria: store.auditoria,
    encuestas: store.encuestas,
    campanas: store.campanas,
    cartaItems,
    evolutionStatus: store.evolutionStatus,
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
  };
}
