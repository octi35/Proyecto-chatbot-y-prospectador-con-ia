-- ---------------------------------------------------------------------------
-- 004 · Equipo / multi-usuario (roles + asignación de chats)
-- El dueño (owner_id) define miembros de su equipo con un rol. Los chats del
-- CRM ya tienen assigned_to (texto) — ahora se puede elegir de esta lista.
-- ---------------------------------------------------------------------------
create table if not exists public.respondo_team_members (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references auth.users(id) on delete cascade,
  email      text not null,
  name       text default '',
  role       text default 'agente',   -- 'admin' | 'agente'
  created_at timestamptz default now(),
  unique (owner_id, email)
);

create index if not exists idx_respondo_team_owner on public.respondo_team_members(owner_id);

alter table public.respondo_team_members enable row level security;

drop policy if exists "respondo_team_anon_server" on public.respondo_team_members;
create policy "respondo_team_anon_server" on public.respondo_team_members
  for all to anon using (true) with check (true);

drop policy if exists "respondo_team_owner" on public.respondo_team_members;
create policy "respondo_team_owner" on public.respondo_team_members
  for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
