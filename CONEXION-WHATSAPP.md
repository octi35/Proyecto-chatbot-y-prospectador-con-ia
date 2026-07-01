# Conectar WhatsApp real (y otros canales) a Respondo

El código de webhooks y envío ya está listo en `server.ts`. Solo faltan **tus credenciales de Meta** y una **URL pública** para los webhooks. Esta guía te lleva de punta a punta.

> Verificá el estado de conexión en la app: pestaña **Integraciones** (lee `/api/health` en vivo).

---

## 1. Exponer tu servidor con una URL pública (túnel)

Los webhooks de Meta necesitan una URL `https://` accesible desde internet. En local, usá un túnel:

**Opción A — Cloudflare (sin cuenta):**
```bash
# instalá cloudflared una vez, luego:
cloudflared tunnel --url http://localhost:3000
```
Te da una URL tipo `https://algo-al-azar.trycloudflare.com`.

**Opción B — ngrok:**
```bash
ngrok http 3000
```

Copiá esa URL y ponela en `.env`:
```
APP_URL="https://algo-al-azar.trycloudflare.com"
```

---

## 2. Crear la app de WhatsApp en Meta

1. Entrá a https://developers.facebook.com/ → **My Apps** → **Create App** → tipo **Business**.
2. Agregá el producto **WhatsApp**.
3. En **WhatsApp → API Setup** vas a ver:
   - **Temporary access token** → `WHATSAPP_TOKEN` (para probar; dura 24 h).
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
   - Un número de prueba y la opción de agregar tu celular como destinatario.
4. En **App Settings → Basic** copiá el **App Secret** → `WHATSAPP_APP_SECRET`.

Poné todo en `.env`:
```
WHATSAPP_TOKEN="EAAG..."
WHATSAPP_PHONE_NUMBER_ID="123456789012345"
WHATSAPP_APP_SECRET="abc123..."
WEBHOOK_VERIFY_TOKEN="respondo-verify-secret"   # inventá uno y anotalo
```

> Para producción (token que no expira) creá un **System User** en Business Settings y generá un token permanente con permisos `whatsapp_business_messaging` y `whatsapp_business_management`.

---

## 3. Configurar el webhook en Meta

1. Reiniciá el server para que tome el `.env` (`npm run dev`).
2. En **WhatsApp → Configuration → Webhook** → **Edit**:
   - **Callback URL:** `https://TU-APP_URL/webhook/whatsapp`
   - **Verify token:** el mismo `WEBHOOK_VERIFY_TOKEN` de tu `.env`.
   - Clic en **Verify and save** (el server responde el challenge automáticamente).
3. En **Webhook fields** suscribite a **`messages`**.

Listo: cuando alguien le escriba a tu número, Respondo recibe el mensaje, la IA responde y el lead entra al CRM automáticamente.

---

## 4. Probar

- Desde la app: **Integraciones → WhatsApp → Enviar test** (usa `/api/test-webhook`).
- O escribile al número de prueba desde tu celular y mirá cómo el agente responde y aparece el lead en el **CRM → Bandeja**.

---

## Otros canales (mismo patrón)

| Canal | Variables en `.env` | Callback URL |
|-------|--------------------|--------------|
| Messenger | `FB_PAGE_TOKEN` | `https://TU-APP_URL/webhook/messenger` |
| Instagram | `IG_TOKEN` (o usa `FB_PAGE_TOKEN`) | `https://TU-APP_URL/webhook/messenger` |
| Email | `EMAIL_USER`, `RESEND_API_KEY` | `https://TU-APP_URL/webhook/email` |

Messenger e Instagram comparten webhook (Meta manda `object=page` o `object=instagram`). Suscribite al campo **`messages`** en cada producto.

---

## Checklist rápido

- [ ] `APP_URL` con la URL del túnel
- [ ] `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`
- [ ] Server reiniciado (`npm run dev`)
- [ ] Webhook verificado en Meta + suscripto a `messages`
- [ ] Test enviado desde Integraciones → ✅

Cuando tengas las credenciales, pegámelas en el `.env` (o pasámelas) y verificamos juntos que entren y salgan mensajes reales.

---

## ¿Y conectar con QR como WhatsApp Web? (evaluación honesta)

**No existe un QR "oficial".** Las integraciones por QR usan librerías no oficiales
(whatsapp-web.js / Baileys) que automatizan WhatsApp Web. Funcionan, pero **violan los
Términos de Servicio de WhatsApp** y Meta puede **banear el número** — riesgo inaceptable
para el número principal de un negocio.

Opciones de menor a mayor fricción, todas legales:

| Opción | Cómo se siente | Legal | Estado |
|--------|---------------|-------|--------|
| **Embedded Signup vía BSP** (360dialog, Twilio) | Unos clics dentro de la app, sin consola de Meta. Lo más parecido a "escanear y listo". | ✅ Oficial | Recomendado para simplificar el alta |
| **Cloud API directa de Meta** | Seguís esta guía una vez (~30 min) | ✅ Oficial | **Ya implementado en Respondo** |
| QR no oficial (whatsapp-web.js) | Escaneás un QR y listo | ❌ Viola ToS, riesgo de baneo | Solo si aceptás el riesgo, como canal secundario |

**Recomendación:** Cloud API (ya está lista) o, si querés onboarding de un clic para
clientes finales, integrar el Embedded Signup de 360dialog más adelante.
