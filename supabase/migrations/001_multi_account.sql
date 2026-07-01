-- ============================================================
-- 001 — Multi-cuenta (APLICADA el 2026-07-01 vía Claude Code)
-- Solo toca tablas respondo_*. No afecta al resto del proyecto.
--
-- Qué hace:
--  1) Agrega owner_id (uuid → auth.users) a las 6 tablas respondo_*
--  2) Usuarios autenticados: solo ven/editan SUS filas (RLS por dueño)
--  3) Rol anon (server/webhooks): mantiene acceso total HASTA que se
--     configure SUPABASE_SERVICE_ROLE_KEY; entonces conviene borrar las
--     políticas *_anon_server (ver 002_lock_anon.sql, pendiente).
-- ============================================================

alter table public.respondo_config      add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.respondo_leads       add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.respondo_campaigns   add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.respondo_automations add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.respondo_wa_templates add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table public.respondo_chat_events add column if not exists owner_id uuid references auth.users(id) on delete cascade;

create index if not exists idx_respondo_config_owner      on public.respondo_config(owner_id);
create index if not exists idx_respondo_leads_owner       on public.respondo_leads(owner_id);
create index if not exists idx_respondo_campaigns_owner   on public.respondo_campaigns(owner_id);
create index if not exists idx_respondo_automations_owner on public.respondo_automations(owner_id);
create index if not exists idx_respondo_wa_templates_owner on public.respondo_wa_templates(owner_id);
create index if not exists idx_respondo_chat_events_owner on public.respondo_chat_events(owner_id);

drop policy if exists "respondo_config_server_all" on public.respondo_config;
create policy "respondo_config_anon_server" on public.respondo_config for all to anon using (true) with check (true);
create policy "respondo_config_owner" on public.respondo_config for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "respondo_leads_server_all" on public.respondo_leads;
create policy "respondo_leads_anon_server" on public.respondo_leads for all to anon using (true) with check (true);
create policy "respondo_leads_owner" on public.respondo_leads for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "respondo_campaigns_server_all" on public.respondo_campaigns;
create policy "respondo_campaigns_anon_server" on public.respondo_campaigns for all to anon using (true) with check (true);
create policy "respondo_campaigns_owner" on public.respondo_campaigns for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "allow all respondo_automations" on public.respondo_automations;
create policy "respondo_automations_anon_server" on public.respondo_automations for all to anon using (true) with check (true);
create policy "respondo_automations_owner" on public.respondo_automations for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "allow all respondo_wa_templates" on public.respondo_wa_templates;
create policy "respondo_wa_templates_anon_server" on public.respondo_wa_templates for all to anon using (true) with check (true);
create policy "respondo_wa_templates_owner" on public.respondo_wa_templates for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "respondo_chat_events_server_all" on public.respondo_chat_events;
create policy "respondo_chat_events_anon_server" on public.respondo_chat_events for all to anon using (true) with check (true);
create policy "respondo_chat_events_owner" on public.respondo_chat_events for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
