-- OCSCO Project Crimson public work presentation fields.
-- Apply to each environment before enabling CMS-backed Work delivery.

alter table public.case_studies
  add column if not exists project_type text not null default 'case-study',
  add column if not exists project_category text,
  add column if not exists external_url text,
  add column if not exists is_featured boolean not null default false,
  add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_studies_project_type_check'
  ) then
    alter table public.case_studies
      add constraint case_studies_project_type_check
      check (project_type in ('case-study', 'prototype', 'upcoming'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'case_studies_external_url_check'
  ) then
    alter table public.case_studies
      add constraint case_studies_external_url_check
      check (external_url is null or external_url ~ '^https://');
  end if;
end $$;

create index if not exists case_studies_featured_order_idx
  on public.case_studies(is_featured desc, sort_order, created_at);
