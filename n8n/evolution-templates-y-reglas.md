# Plantillas Evolution API, Outbox y Reglas Anti-Spam — Olivia Café (Perú)

## 1. Arquitectura de Despacho (Prioridad Cero-Costo)
1. **Eventos transaccionales** (`cliente_registrado`, `sello_confirmado`, `premio_listo`, `canje_realizado`, `encuesta_respondida`, `baja_solicitada`) se insertan en `public.eventos_outbox` desde funciones `SECURITY DEFINER`.
2. **Despachador Outbox**:
   - Opción A: Supabase Edge Function `dispatch-outbox-cron`
   - Opción B: Endpoint Vercel `/api/webhooks/outbox` (protegido por `Authorization: Bearer $CRON_SECRET`)
3. **Prioridad de canal**:
   - Siempre intenta **Web Push VAPID** primero cuando el cliente tiene suscripción activa y la automatización permite `push` o `ambos`.
   - Solo consume **WhatsApp (Evolution API)** cuando `canal` es `whatsapp` o `ambos` sin suscripción push activa, y únicamente si `consentimiento_whatsapp = true` y `baja_whatsapp = false`.

## 2. Reglas Anti-Spam y Anti-Ban (Evolution API)
- **Ventana horaria obligatoria**: `09:00` a `20:00` (`America/Lima`). Mensajes generados fuera de horario se difieren automáticamente (`proximo_reintento_at + 1h`).
- **Tope diario por negocio**: `negocios.whatsapp_limite_diario` (por defecto `150` envíos/día verificables vía `public.verificar_cuota_whatsapp(negocio_id)`).
- **Espera aleatoria (*jitter*)**: `8` a `25` segundos entre mensajes consecutivos en n8n (`Espera Anti-Ban`).
- **Lotes acotados**: máximo `50` eventos por ejecución de outbox.
- **Baja automática (Ley 29733 Perú)**: cualquier mensaje entrante con `BAJA`, `STOP`, `SALIR`, `NO MAS` o `CANCELAR` actualiza `clientes.baja_whatsapp = true` al instante vía `/api/webhooks/evolution-inbound` o `supabase/functions/evolution-webhook`.

## 3. Plantillas Oficiales (Variables `{nombre}`, `{sellos}`, `{falta}`, `{premio}`, `{url}`)
- **Bienvenida**:
  `¡Hola {nombre}! Bienvenido a Olivia Café ☕ Ya tienes 1 sello de bienvenida. Mira tu cartilla aquí: {url}. Responde BAJA para no recibir más.`
- **A 1 sello del premio**:
  `¡{nombre}, te falta solo {falta} sello para tu {premio} gratis en Olivia Café! Pasa hoy por Miraflores o San Isidro.`
- **Premio listo**:
  `🎉 ¡Felicidades, {nombre}! Completaste {sellos} sellos. Tu {premio} te espera en Olivia Café. Muestra tu QR en caja. Responde BAJA para no recibir más.`
- **Cumpleaños**:
  `🎂 ¡Feliz cumpleaños, {nombre}! Esta semana Olivia Café te regala una porción de tarta artesanal gratis al mostrar tu cartilla: {url}. Responde BAJA para no recibir más.`
- **Reactivación (15 / 30 / 45 días)**:
  `¡Te extrañamos, {nombre}! Llevas {sellos} sellos en tu cartilla de Olivia Café. Te falta poco para tu {premio}. Responde BAJA para no recibir más.`
- **Encuesta 2h post-visita**:
  `Hola {nombre}, ¿cómo estuvo tu café hoy en Olivia Café? Responde del 1 al 5 ⭐. Responde BAJA para no recibir más.`

## 4. Importación en n8n
1. En n8n, crea las variables de entorno: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `CRON_SECRET`.
2. Importa los tres archivos de `/n8n/`:
   - `01-olivia-outbox-whatsapp-router.json`
   - `02-olivia-cumpleanos-y-reactivacion-cron.json`
   - `03-olivia-evolution-inbound-bajas-encuestas.json`
3. En Evolution API (instancia `olivia-lima-wa`), apunta el webhook de `MESSAGES_UPSERT` y `CONNECTION_UPDATE` hacia `https://TU-APP.vercel.app/api/webhooks/evolution-inbound`.
