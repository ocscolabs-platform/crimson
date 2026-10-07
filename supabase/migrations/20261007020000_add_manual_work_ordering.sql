-- OCSCO Project Crimson: Owner-controlled manual Work ordering.
--
-- The complete Work Library is the ordering authority. The RPC validates that
-- the caller supplied every current Case Study exactly once, then writes a
-- dense order atomically. Published rows receive one narrow trigger exception
-- for sort_order only; ordinary published-content edits remain guarded.

create or replace function public.cms_prepare_case_study_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  revision_publish boolean;
  work_reorder boolean;
begin
  revision_publish := public.cms_has_role(array['owner']::text[])
    and exists (
      select 1
      from public.cms_revisions
      where entity_type = 'case_study'
        and entity_key = new.id::text
        and status = 'review'
    );

  work_reorder := false;
  if tg_op = 'UPDATE' then
    work_reorder := coalesce(current_setting('app.cms_work_reorder', true), '') = 'on'
      and public.cms_has_role(array['owner']::text[])
      and old.sort_order is distinct from new.sort_order
      and old.project_name is not distinct from new.project_name
      and old.slug is not distinct from new.slug
      and old.client_visibility is not distinct from new.client_visibility
      and old.summary is not distinct from new.summary
      and old.challenge is not distinct from new.challenge
      and old.approach is not distinct from new.approach
      and old.deliverables is not distinct from new.deliverables
      and old.outcomes is not distinct from new.outcomes
      and old.featured_image_path is not distinct from new.featured_image_path
      and old.featured_image_alt is not distinct from new.featured_image_alt
      and old.supporting_media is not distinct from new.supporting_media
      and old.project_type is not distinct from new.project_type
      and old.project_category is not distinct from new.project_category
      and old.external_url is not distinct from new.external_url
      and old.is_featured is not distinct from new.is_featured
      and old.media_status is not distinct from new.media_status
      and old.media_reviewed_at is not distinct from new.media_reviewed_at
      and old.status is not distinct from new.status
      and old.published_at is not distinct from new.published_at
      and old.last_reviewed_at is not distinct from new.last_reviewed_at;
  end if;

  if new.status in ('published', 'archived')
    and not public.cms_has_role(array['owner']::text[])
  then
    raise exception 'Only an owner can publish or archive case studies';
  end if;

  if tg_op = 'UPDATE' then
    if new.status = 'published' and old.status not in ('review', 'published') then
      raise exception 'Move the case study to review before publishing it';
    end if;

    if old.status = 'published'
      and new.status = 'published'
      and not revision_publish
      and not work_reorder
      and (
        old.project_name is distinct from new.project_name
        or old.slug is distinct from new.slug
        or old.client_visibility is distinct from new.client_visibility
        or old.summary is distinct from new.summary
        or old.challenge is distinct from new.challenge
        or old.approach is distinct from new.approach
        or old.deliverables is distinct from new.deliverables
        or old.outcomes is distinct from new.outcomes
        or old.featured_image_path is distinct from new.featured_image_path
        or old.featured_image_alt is distinct from new.featured_image_alt
        or old.supporting_media is distinct from new.supporting_media
        or old.project_type is distinct from new.project_type
        or old.project_category is distinct from new.project_category
        or old.external_url is distinct from new.external_url
        or old.is_featured is distinct from new.is_featured
        or old.sort_order is distinct from new.sort_order
        or old.media_status is distinct from new.media_status
        or old.media_reviewed_at is distinct from new.media_reviewed_at
      )
    then
      raise exception 'Move the case study to review before changing published content';
    end if;
  end if;

  if new.status = 'published' then
    new.published_at = coalesce(new.published_at, now());
    if tg_op = 'INSERT' or old.status <> 'published' then
      new.last_reviewed_at = now();
    end if;
  else
    new.published_at = null;
    if tg_op = 'UPDATE' and old.status = 'published' and new.status = 'review' then
      new.last_reviewed_at = null;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.cms_prepare_case_study_publication() from public;
grant execute on function public.cms_prepare_case_study_publication() to authenticated;

comment on function public.cms_prepare_case_study_publication() is
  'Owners publish Case Studies through revisions. The manual Work-order RPC may change only sort_order on Published rows.';

create or replace function public.cms_reorder_case_studies(
  p_ordered_case_study_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  supplied_count integer;
  distinct_count integer;
begin
  if auth.uid() is null
    or not public.cms_has_role(array['owner']::text[])
  then
    raise exception 'Only the owner can reorder Work';
  end if;

  if p_ordered_case_study_ids is null then
    raise exception 'The complete Work order is required';
  end if;

  if array_position(p_ordered_case_study_ids, null) is not null then
    raise exception 'The Work order cannot contain null IDs';
  end if;

  select count(*), count(distinct ordered.case_study_id)
  into supplied_count, distinct_count
  from unnest(p_ordered_case_study_ids) as ordered(case_study_id);

  if supplied_count <> distinct_count then
    raise exception 'The Work order cannot contain duplicate IDs';
  end if;

  -- Serialize the authoritative-set check with Case Study creates, deletes,
  -- publication, and other reorder requests.
  lock table public.case_studies in share row exclusive mode;

  if exists (
    select 1
    from unnest(p_ordered_case_study_ids) as ordered(case_study_id)
    left join public.case_studies as case_study
      on case_study.id = ordered.case_study_id
    where case_study.id is null
  ) then
    raise exception 'The Work order contains an unknown ID';
  end if;

  if exists (
    select 1
    from public.case_studies as case_study
    where not (case_study.id = any(p_ordered_case_study_ids))
  ) then
    raise exception 'The Work order is missing a current Work record';
  end if;

  if supplied_count <> (select count(*) from public.case_studies) then
    raise exception 'The Work order must contain every current Work record exactly once';
  end if;

  perform set_config('app.cms_work_reorder', 'on', true);

  with desired as (
    select
      ordered.case_study_id,
      (ordered.ordinality - 1)::integer as sort_order
    from unnest(p_ordered_case_study_ids) with ordinality
      as ordered(case_study_id, ordinality)
  )
  update public.case_studies as case_study
  set sort_order = desired.sort_order
  from desired
  where case_study.id = desired.case_study_id
    and case_study.sort_order is distinct from desired.sort_order;

  perform set_config('app.cms_work_reorder', 'off', true);

  -- Keep only the single active private Draft/Review revision aligned so a
  -- later publish cannot restore a stale order. Published/archived history is
  -- immutable and is intentionally excluded.
  with desired as (
    select
      ordered.case_study_id,
      (ordered.ordinality - 1)::integer as sort_order
    from unnest(p_ordered_case_study_ids) with ordinality
      as ordered(case_study_id, ordinality)
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
    and revision.entity_key = desired.case_study_id::text
    and revision.status in ('draft', 'review')
    and revision.payload->'sort_order' is distinct from to_jsonb(desired.sort_order);
end;
$$;

revoke all on function public.cms_reorder_case_studies(uuid[]) from public;
grant execute on function public.cms_reorder_case_studies(uuid[]) to authenticated;

comment on function public.cms_reorder_case_studies(uuid[]) is
  'Owner-only atomic dense ordering for the complete Case Study Work Library; active private revisions stay aligned.';
