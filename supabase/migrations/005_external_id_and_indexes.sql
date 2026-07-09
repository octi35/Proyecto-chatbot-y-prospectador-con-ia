-- ---------------------------------------------------------------------------
-- 005 · external_id (requerido por los webhooks) + índices de performance
--
-- Bugfix: el código de canales (WhatsApp/Instagram/Facebook/Email) busca e
-- inserta respondo_leads.external_id, pero ninguna migración creaba la columna.
-- Sin esto, los mensajes entrantes fallan en una base nueva.
--
-- Performance: índices para las consultas calientes —
--  · lookup del webhook por (external_id, origin) en cada mensaje entrante
--  · follow-ups automáticos por (owner_id, last_interaction) filtrando abiertos
--  · listado del CRM por (owner_id, created_at desc)
-- ---------------------------------------------------------------------------
alter table public.respondo_leads add column if not exists external_id text;

-- Lookup por canal (el path más caliente: corre por cada inbound)
create index if not exists idx_respondo_leads_external_origin
  on public.respondo_leads (external_id, origin);

-- Follow-ups: leads abiertos ordenados por última interacción, por cuenta
create index if not exists idx_respondo_leads_owner_last_interaction
  on public.respondo_leads (owner_id, last_interaction);

-- Listado del CRM (getLeads ordena por created_at con RLS por dueño)
create index if not exists idx_respondo_leads_owner_created
  on public.respondo_leads (owner_id, created_at desc);
