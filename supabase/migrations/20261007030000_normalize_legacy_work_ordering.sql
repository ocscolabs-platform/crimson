-- OCSCO Project Crimson: normalize legacy duplicate Work ordering in place.
--
-- Environments are intentionally independent. Only when this environment's
-- current Work Library contains a duplicate sort_order do we derive its own
-- legacy presentation order and persist dense manual positions.

do $$
begin
  lock table public.case_studies in share row exclusive mode;

  if not exists (
    select 1
    from public.case_studies
    group by sort_order
    having count(*) > 1
  ) then
    return;
  end if;

  -- The migration role, rather than a CMS user, performs this one-time
  -- normalization. Disable only the publication guard; updated_at and the
  -- immutable audit trigger remain active throughout the data change.
  execute 'alter table public.case_studies disable trigger case_studies_prepare_publication';

  begin
    with desired as (
      select
        id,
        (
          row_number() over (
            order by is_featured desc, sort_order asc, created_at asc, slug asc
          ) - 1
        )::integer as sort_order
      from public.case_studies
    )
    update public.case_studies as case_study
    set sort_order = desired.sort_order
    from desired
    where case_study.id = desired.id
      and case_study.sort_order is distinct from desired.sort_order;

    -- Align only active private work. Historical Published/Archived revision
    -- payloads remain immutable.
    with desired as (
      select id, sort_order
      from public.case_studies
    )
    update public.cms_revisions as revision
    set payload = jsonb_set(
      revision.payload,
      '{sort_order}',
      to_jsonb(desired.sort_order),
      true
    )
    from desired
    where revision.entity_type = 'case_study'
      and revision.entity_key = desired.id::text
      and revision.status in ('draft', 'review')
      and revision.payload->'sort_order' is distinct from to_jsonb(desired.sort_order);
  exception when others then
    execute 'alter table public.case_studies enable trigger case_studies_prepare_publication';
    raise;
  end;

  execute 'alter table public.case_studies enable trigger case_studies_prepare_publication';
end;
$$;
