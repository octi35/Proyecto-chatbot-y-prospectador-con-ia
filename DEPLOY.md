# 🚀 Puesta en marcha — de cero a vender en 3 pasos

La app es **un solo servicio Node**: Express sirve la API, los webhooks y el
frontend compilado. No hay nada más que hostear.

---

## Paso 1 — Deploy (elegí UNA opción)

### Opción A · Render (recomendada, 1 click)
1. Pusheá el repo a GitHub.
2. En [render.com](https://render.com): **New → Blueprint** → conectá el repo.
   Render lee el `render.yaml` incluido y crea todo solo.
3. Cuando termine, copiá la URL (ej: `https://respondo.onrender.com`) y pegala
   en la variable `APP_URL`.

### Opción B · Railway
**New Project → Deploy from GitHub repo**. Railway detecta Node:
- Build: `npm ci && npm run build` · Start: `npm start`

### Opción C · Docker (VPS propio, Fly.io, etc.)
```bash
docker build -t respondo .
docker run -p 3000:3000 --env-file .env respondo
```

---

## Paso 2 — API keys + base de datos

### Variables de entorno (en el dashboard del hosting)
Mínimas para operar:

| Variable | Para qué | Dónde conseguirla |
|---|---|---|
| `GEMINI_API_KEY` | El cerebro del agente | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Base de datos y login | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Webhooks/schedulers (recomendada) | Ídem (service_role — **nunca** en el frontend) |
| `APP_URL` | Webhooks de Meta | La URL de tu deploy |

Opcionales: `OPENROUTER_API_KEY` (fallback de IA), `MP_ACCESS_TOKEN` (links de
pago reales), tienda (`TIENDANUBE_*`/`SHOPIFY_*`/`WOO_*`). La lista completa
comentada está en `.env.example`.

### Migraciones de Supabase (una sola vez)
En Supabase → **SQL Editor**, corré en orden (son `if not exists`, seguras de repetir):
1. `supabase/schema.sql` — solo si la base está vacía
2. `supabase/migrations/001_multi_account.sql`
3. `supabase/migrations/002_handoff.sql`
4. `supabase/migrations/003_custom_instructions.sql`
5. `supabase/migrations/004_team_members.sql`
6. `supabase/migrations/005_external_id_and_indexes.sql` ← **crítica** para los canales

---

## Paso 3 — Vincular los canales

Todo se hace desde **Integraciones** dentro de la app: cada canal tiene su
asistente paso a paso con la URL de webhook ya armada y botón de copiar.

### WhatsApp (API oficial de Meta — sin riesgo de baneo)
1. [developers.facebook.com](https://developers.facebook.com) → creá una app
   **Business** → producto **WhatsApp**.
2. Copiá `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` → pegalos como variables
   de entorno → redeploy.
3. En Meta → WhatsApp → Configuration → **Webhook**: pegá
   `https://TU-APP/webhook/whatsapp` + tu `WEBHOOK_VERIFY_TOKEN` y suscribí `messages`.
4. Probalo desde Integraciones → "Enviar test".

> 💡 **El QR**: en Integraciones → **QR de tu WhatsApp** generás un QR con tu
> número. Lo imprimís en el mostrador o lo subís a redes; el cliente lo escanea
> y le escribe directo a tu agente. *(La vinculación del número a Meta es por
> token — el QR estilo "WhatsApp Web" es la vía no oficial y arriesga baneo.)*

### Instagram + Facebook Messenger
1. En la misma app de Meta agregá el producto **Messenger** (sirve para ambos).
2. Copiá el `FB_PAGE_TOKEN` de tu página (e `IG_TOKEN` si usás uno separado).
3. Webhook: `https://TU-APP/webhook/messenger` con el mismo verify token;
   suscribí `messages` para la página y la cuenta de Instagram.

### Email / Gmail
El canal de email funciona con **Resend** (u otro proveedor de inbound):
1. [resend.com](https://resend.com) → API key → `RESEND_API_KEY` + `EMAIL_USER`.
2. Para RECIBIR consultas: configurá el inbound de tu proveedor
   (Resend/SendGrid/Mailgun/Postmark) apuntando a `https://TU-APP/webhook/email`.
   Acepta JSON, form-urlencoded y multipart.
3. ¿Usás Gmail? Redirigí (forwarding) tu casilla de Gmail a la dirección de
   inbound del proveedor y el agente responde desde `EMAIL_USER`.

---

## Checklist final

- [ ] `GET https://TU-APP/api/health` → `status: ok` y tus integraciones en `true`
- [ ] Registro + login funcionan (el agente IA requiere sesión en producción)
- [ ] Migraciones 001→005 corridas en Supabase
- [ ] Webhook de WhatsApp verificado (Meta lo muestra en verde)
- [ ] Mensaje real de prueba: escribile a tu número y mirá cómo entra al CRM
- [ ] QR descargado e impreso 🎉

## Notas

- El scheduler de seguimientos corre dentro del mismo proceso (no hace falta cron externo).
- Los logs son JSON (pino) con `X-Request-Id` y tiempos; Render los muestra en vivo.
- Escalado: una instancia alcanza para empezar; el rate limiter es en memoria (por instancia).
- Build local: `npm run build` → `npm start` (sirve todo en `:3000`).
