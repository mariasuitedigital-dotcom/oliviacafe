# Guía de Despliegue en Producción y QA Físico — Olivia Café

---

## 1. Checklist de Variables de Entorno

### Frontend (Públicas — prefijo `VITE_`)
| Variable | Ejemplo / Origen | Notas |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Llave pública `anon` (protegida por RLS) |
| `VITE_DEFAULT_NEGOCIO_SLUG` | `olivia` | Tenant por defecto |
| `VITE_VAPID_PUBLIC_KEY` | `BEl6...` | Generada con `npx web-push generate-vapid-keys` |
| `VITE_ROOT_DEV_KEY` | `1982` | Clave maestra del desarrollador para consola Root (4 clics en logo MarIA) |

### Backend / Serverless / Edge Functions (Solo Servidor — NUNCA usar `VITE_`)
| Variable | Dónde va | Descripción |
|---|---|---|
| `APP_URL` | Vercel + Supabase | URL pública final (ej. `https://club.oliviacafe.pe`) |
| `SUPABASE_URL` | Vercel | Misma URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Llave maestra `service_role` |
| `VAPID_PUBLIC_KEY` | Vercel | Clave pública VAPID |
| `VAPID_PRIVATE_KEY` | Vercel | Clave privada VAPID (secreta) |
| `VAPID_SUBJECT` | Vercel | `mailto:soporte@oliviacafe.pe` |
| `CRON_SECRET` | Vercel + Supabase + n8n | Token largo aleatorio (`openssl rand -hex 32`) |
| `N8N_WEBHOOK_URL` | Vercel + Supabase | URL webhook de `01-olivia-outbox-whatsapp-router.json` |
| `N8N_INBOUND_WEBHOOK_URL` | Vercel + Supabase | URL webhook de `03-olivia-evolution-inbound-bajas-encuestas.json` |
| `N8N_WEBHOOK_SECRET` | Vercel + Supabase + n8n | Header compartido `x-olivia-secret` |
| `EVOLUTION_API_URL` | Vercel + n8n | URL base de tu servidor Evolution API |
| `EVOLUTION_API_KEY` | Vercel + n8n | API key global de Evolution API |
| `EVOLUTION_WEBHOOK_SECRET` | Vercel | Secreto opcional para validar `/api/webhooks/evolution-inbound` |

---

## 2. Paso a Paso en Supabase

### 2.1 Ejecutar migraciones en orden estricto
Desde **SQL Editor** en Supabase (o vía `supabase db push`), ejecuta los 8 archivos en `/supabase/migrations/`:
1. `001_schema.sql` — 19 tablas multi-negocio + vista `v_clientes_caja`.
2. `002_rls_and_roles.sql` — Políticas RLS estrictas por `negocio_id` y `app_metadata.role`.
3. `003_security_definer_rpcs.sql` — RPCs idempotentes (`registrar_cliente_rapido`, `generar_token_qr`, `validar_pin`, `dar_sello`, `canjear_premio`, `activar_promo`, `canjear_cupon`, `otorgar_bonus_instalacion`) + triggers de `eventos_outbox`.
4. `004_seed_aitama.sql` — Datos iniciales de **Olivia Café** (`olivia`), 2 sedes, cajas `OLIVIA-CAJA-01` / `OLIVIA-CAJA-02`, 6 automatizaciones y 2 promos.
5. `005_pos_search_rpc.sql` — Búsqueda segura con teléfono enmascarado (`buscar_cliente_caja`, `buscar_cupon_caja`).
6. `006_outbox_cron_and_templates.sql` — Cuota diaria WhatsApp, cumpleaños/reactivaciones diarias y encuestas 2h post-visita.
7. `007_root_admin_pos_8digit_otp.sql` — Claves de 8 dígitos para dueños (aprovisionados por Root), creación de usuarios POS por el Admin y validación de OTP obligatorio por WhatsApp en el primer ingreso.
8. `008_pos_apply_promo.sql` — Listado y aplicación directa de promociones activas desde la Caja POS (`listar_promociones_caja`, `aplicar_promo_caja`).

### 2.2 Crear cuentas de Root (`superadmin`), Dueño (`owner`) y POS (`cashier`)
1. Crea primero tu usuario desarrollador (`superadmin`) y el usuario dueño en **Authentication → Users** (ej. `root@oliviacafe.pe` y `dueno@oliviacafe.pe`).
2. Asigna el rol `superadmin` al desarrollador para poder invocar `root_crear_dueno`, o usa la consola **Acceso Root (Desarrollador)** desde `/admin`:
```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"role":"superadmin","negocio_id":"11111111-1111-4111-8111-111111111111"}'::jsonb
WHERE email = 'root@oliviacafe.pe';

INSERT INTO public.perfiles (id, negocio_id, rol, nombre_completo, email, activo)
SELECT id, '11111111-1111-4111-8111-111111111111', 'superadmin', 'Root Desarrollador', email, true
FROM auth.users WHERE email = 'root@oliviacafe.pe';
```
3. Desde la consola Root (o invocando `SELECT public.root_crear_dueno(...)`), el desarrollador genera la **clave de 8 dígitos** y registra el WhatsApp OTP (`+519...`) del dueño (`primer_ingreso_pendiente = true`).
4. Una vez dentro del **Panel Admin**, el dueño crea los **usuarios POS** desde **Equipo y POS** (clave numérica 4–8 dígitos + WhatsApp OTP). Tanto el dueño como cada usuario POS recibirán un código OTP de 6 dígitos en su **primer ingreso**.

### 2.3 Desplegar Edge Functions
```bash
supabase functions deploy validar-pin-pos --no-verify-jwt
supabase functions deploy dispatch-outbox-cron --no-verify-jwt
supabase functions deploy evolution-webhook --no-verify-jwt

supabase secrets set \
  CRON_SECRET="..." \
  APP_URL="https://club.oliviacafe.pe" \
  N8N_WEBHOOK_URL="https://n8n.tudominio.com/webhook/olivia-outbox" \
  N8N_INBOUND_WEBHOOK_URL="https://n8n.tudominio.com/webhook/olivia-whatsapp-inbound" \
  N8N_WEBHOOK_SECRET="..."
```

---

## 3. Paso a Paso en Vercel

1. **Generar claves VAPID** en tu terminal local:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Importa el repositorio en **Vercel**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Carga todas las variables de la sección 1 en **Settings → Environment Variables**.
4. Verifica después del deploy que respondan correctamente:
   - `https://TU-DOMINIO/c/olivia` → Manifiesto `/c/manifest.webmanifest` y SW `/c/sw.js` (`Service-Worker-Allowed: /c/`).
   - `https://TU-DOMINIO/caja` → Manifiesto `/caja/manifest.webmanifest` y SW `/caja/sw.js` (`Service-Worker-Allowed: /caja/`).
   - `https://TU-DOMINIO/admin` → Manifiesto `/admin/manifest.webmanifest` y SW `/admin/sw.js` (`Service-Worker-Allowed: /admin/`).

---

## 4. Paso a Paso en n8n y Evolution API

1. En **n8n**, define las variables de entorno (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `CRON_SECRET`).
2. Importa los 3 archivos de `/n8n/`:
   - `01-olivia-outbox-whatsapp-router.json`
   - `02-olivia-cumpleanos-y-reactivacion-cron.json`
   - `03-olivia-evolution-inbound-bajas-encuestas.json`
3. Activa los 3 workflows.
4. En **Evolution API**, crea la instancia `olivia-lima-wa`, vincula el WhatsApp Business del local por QR y apunta su Webhook (`MESSAGES_UPSERT`, `CONNECTION_UPDATE`) a:
   `https://TU-DOMINIO/api/webhooks/evolution-inbound` (con header `x-evolution-secret`).

---

## 5. Checklist de QA en Dispositivos Físicos

### A. Android (Chrome)
- [ ] Abrir `/c/olivia`, registrarse con nombre, celular `+519...` y cumpleaños (< 15s).
- [ ] Confirmar que aparece el **modal obligatorio de instalación** sin botón de cierre.
- [ ] Instalar PWA en pantalla de inicio y verificar apertura en modo `standalone` (sin barra de navegador).
- [ ] Confirmar Web Push activo y recibir notificación de prueba desde `/api/push/test`.
- [ ] Verificar que el QR de la cartilla rota cada 30s con contador regresivo.
- [ ] En otro Android/tablet con `/caja`, emparejar con `OLIVIA-CAJA-01`, ingresar PIN, escanear QR del cliente y dar **+1 Sello Hoy**.
- [ ] Activar **Modo Avión** en `/caja`, asignar un sello offline, verificar que aparece en la pestaña **Cola**, reconectar internet y confirmar sincronización única (`idempotency_key`).

### B. iPhone / iPad (Safari iOS 16.4+)
- [ ] Abrir `/c/olivia` en Safari y seguir el modal obligatorio: **Compartir → Agregar a pantalla de inicio**.
- [ ] Abrir la app **desde el ícono instalado en pantalla de inicio** (requisito obligatorio de Apple para Push en iOS).
- [ ] Verificar guardado de tarjeta en **Perfil** y cierre/reapertura manteniendo sesión.
- [ ] Probar flujo completo de encuesta: calificación `<= 3★` guarda feedback privado sin abrir Maps; `5★` muestra botón a Google Maps (`+10 pts`).

### C. Desktop (Chrome / Edge / macOS / Windows)
- [ ] Verificar pantalla de inicio limpia con imagen arriba y botones de cliente abajo.
- [ ] Hacer **3 clics seguidos en el logo de Olivia Café** para revelar acceso **Soy Negocio** (`Caja POS` / `Panel Admin`).
- [ ] Ingresar a `/admin`, revisar **Resumen Ejecutivo**, **Exportar CSV** (abrir en Excel confirmando tildes UTF-8), editar una **Automatización** viendo la vista previa en vivo, y probar cambio de color en **Ajustes** verificando actualización en vivo.
- [ ] Confirmar que los 3 Service Workers (`/c/sw.js`, `/caja/sw.js`, `/admin/sw.js`) permanecen aislados sin interferir entre sí.
