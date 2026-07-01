-- ============================================================================
-- Respondo — esquema de base de datos (Supabase / PostgreSQL)
-- ----------------------------------------------------------------------------
-- Idempotente: se puede correr sobre una base existente sin romper nada
-- (CREATE TABLE IF NOT EXISTS no altera tablas ya creadas).
--
-- Cómo aplicarlo:
--   Supabase Dashboard → SQL Editor → pegar este archivo → Run.
--
-- Nota sobre RLS: la app usa la anon key directamente desde el server para
-- leer y escribir. Estas tablas quedan SIN Row Level Security (igual que el
-- estado actual que ya funciona). Si más adelante activás RLS, vas a necesitar
-- políticas que permitan las operaciones del backend.
-- ============================================================================

create extension if not exists "pgcrypto";  -- para gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Trigger genérico: mantiene updated_at al día en cada UPDATE
-- ---------------------------------------------------------------------------
create or replace function respondo_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- CONFIG (una sola fila con la configuración del agente/negocio)
-- ---------------------------------------------------------------------------
create table if not exists respondo_config (
  id                     uuid primary key default gen_random_uuid(),
  business_name          text not null default 'Mi Negocio',
  business_type          text default '',
  catalog                text default '',
  tone                   text default 'Argentino/Cercano',
  logo_url               text,
  custom_greeting        text,
  auto_follow_up_minutes integer default 15,
  sync_store             text default 'Ninguna',
  bot_persona_name       text,
  forbidden_topics       text,
  working_hours_start    integer,
  working_hours_end      integer,
  quick_replies          jsonb default '[]'::jsonb,
  strict_mode            boolean default false,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

drop trigger if exists trg_respondo_config_updated on respondo_config;
create trigger trg_respondo_config_updated before update on respondo_config
  for each row execute function respondo_set_updated_at();

-- ---------------------------------------------------------------------------
-- LEADS (prospectos / contactos del CRM)
-- ---------------------------------------------------------------------------
create table if not exists respondo_leads (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  phone                text default '',
  status               text default 'Nuevo',      -- Nuevo | Contactado | Presupuestado | Cerrado
  origin               text default 'WhatsApp',   -- WhatsApp | Instagram | Facebook | Email
  last_interaction     timestamptz default now(),
  score                integer default 65,
  notes                text default '',
  category             text,
  avatar               text,
  total_spent          numeric default 0,
  conversation_history jsonb default '[]'::jsonb,  -- [{ role, text, timestamp }]
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

drop trigger if exists trg_respondo_leads_updated on respondo_leads;
create trigger trg_respondo_leads_updated before update on respondo_leads
  for each row execute function respondo_set_updated_at();

create index if not exists idx_respondo_leads_updated  on respondo_leads (updated_at desc);
create index if not exists idx_respondo_leads_created   on respondo_leads (created_at desc);
create index if not exists idx_respondo_leads_status    on respondo_leads (status);
create index if not exists idx_respondo_leads_phone     on respondo_leads (phone);

-- ---------------------------------------------------------------------------
-- CAMPAIGNS (difusiones masivas)
-- ---------------------------------------------------------------------------
create table if not exists respondo_campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  template      text default '',
  segment       text default '',
  status        text default 'Borrador',
  sent_count    integer default 0,
  read_count    integer default 0,
  replies_count integer default 0,
  date_created  text,
  scheduled_at  timestamptz,
  media_url     text,
  media_type    text,
  created_at    timestamptz default now()
);

create index if not exists idx_respondo_campaigns_created on respondo_campaigns (created_at desc);

-- ---------------------------------------------------------------------------
-- AUTOMATIONS (reglas: si pasa X → hacer Y)
-- ---------------------------------------------------------------------------
create table if not exists respondo_automations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  enabled         boolean default true,
  trigger         text not null,
  trigger_value   text,
  action          text not null,
  action_value    text,
  times_triggered integer default 0,
  created_at      timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- WA TEMPLATES (plantillas aprobadas de WhatsApp / Meta)
-- ---------------------------------------------------------------------------
create table if not exists respondo_wa_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  language   text default 'es_AR',
  category   text default 'MARKETING',  -- MARKETING | UTILITY | AUTHENTICATION
  body       text default '',
  status     text default 'PENDIENTE',  -- PENDIENTE | APROBADA | RECHAZADA
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- CHAT EVENTS (telemetría para analytics: mensajes, canales, acciones IA)
-- ---------------------------------------------------------------------------
create table if not exists respondo_chat_events (
  id         uuid primary key default gen_random_uuid(),
  event_type text,
  channel    text,
  payload    jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_respondo_chat_events_created on respondo_chat_events (created_at desc);
create index if not exists idx_respondo_chat_events_channel on respondo_chat_events (channel);

-- ============================================================================
-- SEED opcional (descomentar para arrancar con datos de ejemplo en una base
-- vacía). La app ya trae datos demo en el front si la tabla está vacía.
-- ============================================================================
-- insert into respondo_config (business_name, business_type, tone)
--   values ('Mi Negocio', 'Indumentaria', 'Argentino/Cercano')
--   on conflict do nothing;
