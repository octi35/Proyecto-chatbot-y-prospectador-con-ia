-- ---------------------------------------------------------------------------
-- 003 · Free-form agent behavior control ("cómo debe actuar el agente")
-- Adds a plain-text field the business owner writes to steer the AI's persona,
-- rules and style. Injected into the system prompt at highest priority.
-- ---------------------------------------------------------------------------
alter table respondo_config
  add column if not exists custom_instructions text;
