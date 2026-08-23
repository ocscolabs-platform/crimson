-- OCSCO Project Crimson Phase 5B Slice 1 compatibility foundation.
--
-- Expand-only change: retain legacy array content and permit future validated
-- PageDocument objects. Existing rows are intentionally not changed here.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pages'::regclass
      and conname = 'pages_content_check'
  ) then
    alter table public.pages drop constraint pages_content_check;
  end if;

  alter table public.pages
    add constraint pages_content_check
    check (jsonb_typeof(content) in ('array', 'object'));
end;
$$;
