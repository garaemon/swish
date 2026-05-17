-- The initial migration shipped 'gemini-3.1-flash-light' as the default
-- (from the project blueprint), but that model name does not exist in
-- Gemini. Switch to gemini-2.5-flash and migrate existing rows that
-- still hold the placeholder.
alter table public.user_settings
  alter column ai_model set default 'gemini-2.5-flash';

update public.user_settings
   set ai_model = 'gemini-2.5-flash'
 where ai_model = 'gemini-3.1-flash-light';
