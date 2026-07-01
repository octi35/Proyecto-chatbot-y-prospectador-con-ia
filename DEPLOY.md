# Deploy a producción

La app es un solo servicio Node: Express sirve la API + el frontend compilado.

## Build local (verificado)

```bash
npm run build    # vite build (frontend → dist/) + esbuild (server → dist/server.cjs)
npm start        # node dist/server.cjs  (NODE_ENV=production)
```

## Opción recomendada: Render (o Railway — mismos pasos)

1. Subí el repo a GitHub (`git push`).
2. En [render.com](https://render.com): **New → Web Service** → conectá el repo.
3. Configuración:
   - **Build command:** `npm install && npm run build`
   - **Start command:** `npm start`
   - **Environment:** Node 22
4. Variables de entorno (pegá las de tu `.env`):
   - `NODE_ENV=production`
   - `GEMINI_API_KEY`, `OPENROUTER_API_KEY` (opcional)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_URL=https://tu-app.onrender.com` ← la URL que te da Render
   - `MP_ACCESS_TOKEN` (pagos reales)
   - WhatsApp/Meta cuando los tengas: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`
   - Tienda (si sincronizás catálogo): `TIENDANUBE_*` / `SHOPIFY_*` / `WOO_*`
5. Deploy. Con `APP_URL` público ya no necesitás túnel: apuntá los webhooks de Meta a
   `https://tu-app.onrender.com/webhook/whatsapp`.

## Checklist post-deploy

- [ ] `GET /api/health` responde `status: ok` con las integraciones esperadas en `true`
- [ ] Login/registro funcionan (Supabase Auth)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` cargada → correr `supabase/migrations/003_lock_anon.sql`
      (pendiente de crear) para cerrar el acceso anon
- [ ] Webhooks de Meta verificados contra la URL de producción
- [ ] Dominio propio (opcional): agregalo en Render → Custom Domains y actualizá `APP_URL`

## Notas

- El scheduler de seguimientos corre dentro del mismo proceso (no hace falta cron externo).
- Los logs son JSON (pino); Render los muestra en vivo en la pestaña Logs.
- Escalado: una instancia alcanza para empezar; el rate limiter es en memoria (por instancia).
