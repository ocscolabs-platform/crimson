-- Add the display and outcome fields required by the approved Services slice.
-- Apply this migration to staging after 20260820000000_create_cms_foundation.sql.

alter table public.services
  add column card_name text,
  add column outcome text;
