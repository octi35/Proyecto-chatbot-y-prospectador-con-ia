# Respondo — Chatea menos, Vendé más 🤖💬

**Tu vendedor con IA que nunca duerme.** Respondo atiende WhatsApp, Instagram,
Facebook y Email con un agente que responde como una persona, califica leads,
hace seguimientos y cierra ventas solo — con CRM incluido. Pensado para pymes,
tiendas y cualquier negocio que venda por chat.

## Qué hace

- 🤖 **Agente de ventas IA** — responde consultas, asesora, maneja objeciones y
  pide la venta. Entiende **texto, imágenes y notas de voz** en los canales reales.
  Controlás su comportamiento escribiéndole instrucciones en tus palabras.
- 📱 **Multicanal** — WhatsApp (API oficial de Meta), Instagram Direct, Facebook
  Messenger y Email, todos en una sola bandeja.
- 📊 **CRM integrado** — cada conversación crea o actualiza un lead con score de
  intención de compra, etapa del embudo, notas y historial completo.
- 🧑‍💼 **Handoff humano** — tomá cualquier chat cuando quieras; la IA se calla y
  te avisa. Asigná chats a tu equipo (roles admin/agente).
- 💳 **Cobros** — el agente genera links de pago reales de Mercado Pago.
- 📣 **Campañas** — difusiones masivas con plantillas aprobadas de Meta,
  seguimientos automáticos con IA (recupera carritos abandonados) y automatizaciones.
- 🛍️ **Catálogo sincronizado** — TiendaNube, Shopify o WooCommerce.
- 📈 **Métricas** — embudo, conversión, facturación, análisis con IA.
- 🔗 **QR de WhatsApp** — imprimilo en tu local: el cliente escanea y le escribe
  directo a tu agente.

## Stack

React 19 + TypeScript + Vite + Tailwind 4 (frontend) · Express + Supabase
(Postgres/Auth/RLS) · Gemini con fallback a OpenRouter y a un motor local de
reglas — **el bot nunca se queda mudo**.

## Correr en local

```bash
npm install
cp .env.example .env    # completá GEMINI_API_KEY (y Supabase si querés persistencia)
npm run dev             # http://localhost:3000
```

Tests y checks:

```bash
npm test                # suite de tests (helpers, botEngine, catálogo, API)
npm run lint            # typecheck
npm run build           # build de producción (frontend + server)
```

## Deploy a producción

Todo está en **[DEPLOY.md](DEPLOY.md)** — guía de 3 pasos: deploy en 1 click
(Render Blueprint / Railway / Docker), API keys + migraciones de Supabase, y la
vinculación de cada canal.

## Seguridad

- Las API keys viven **solo** en variables de entorno del servidor (`.env` está
  gitignoreado; el frontend nunca las ve).
- Webhooks de Meta verificados por firma HMAC (timing-safe, sobre el body crudo).
- Sesiones reales con Supabase Auth + aislamiento por usuario a nivel base de
  datos (RLS). El agente IA requiere sesión en producción.
- Rate limiting, límites de payload por ruta, timeouts y reintentos seguros en
  todas las llamadas salientes.
