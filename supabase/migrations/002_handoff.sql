-- ============================================================
-- 002 — Handoff humano (APLICADA el 2026-07-01 vía Claude Code)
-- Solo tabla respondo_leads.
--  - ai_paused: cuando true, la IA NO responde a este lead (lo tomó un humano)
--  - assigned_to: email/nombre del agente humano asignado al chat
-- ============================================================
alter table public.respondo_leads add column if not exists ai_paused boolean default false;
alter table public.respondo_leads add column if not exists assigned_to text;
