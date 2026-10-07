-- OCSCO Project ZERO — Work CMS Update v1 Task 1.
-- Add one recoverable Owner-only unpublish path for effectively Published
-- Upcoming Work. The existing revision, publication-trigger, audit, RLS, and
-- direct-write boundaries remain authoritative.

create or replace function public.cms_unpublish_upcoming_case_study(p_case_study_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.case_studies%rowtype;
  review_revision_id uuid;
begin
  if auth.uid() is null or not public.cms_has_role(array['owner']::text[]) then
    raise exception 'Only the owner can unpublish Upcoming Work';
  end if;

  if p_case_study_id is null then
    raise exception 'An Upcoming Work record is required';
  end if;

  select * into target
  from public.case_studies
  where id = p_case_study_id
  for update;

  if target.id is null then
    raise exception 'The Upcoming Work record does not exist';
  end if;

  if target.project_type <> 'upcoming' then
    raise exception 'Only Upcoming Work can be unpublished through this action';
  end if;

  if target.status <> 'published'
    or target.published_at is null
    or target.published_at > now()
  then
    raise exception 'Only effectively Published Upcoming Work can be unpublished';
  end if;

  -- Preserve any active private edits; otherwise snapshot the complete current
  -- base row. In both cases the existing revision publisher receives a valid
  -- Review revision that can republish the record later.
  review_revision_id := public.cms_save_revision(
    'case_study',
    target.id::text,
    'review',
    '{}'::jsonb
  );

  update public.case_studies
  set status = 'review',
      published_at = null
  where id = target.id
    and status = 'published'
    and published_at is not null
    and published_at <= now();

  if not found then
    raise exception 'The Upcoming Work record could not be unpublished safely';
  end if;

  return review_revision_id;
end;
$$;

revoke all on function public.cms_unpublish_upcoming_case_study(uuid) from public;
grant execute on function public.cms_unpublish_upcoming_case_study(uuid) to authenticated;

comment on function public.cms_unpublish_upcoming_case_study(uuid) is
  'Owner-only recoverable unpublish for effectively Published Upcoming Work; preserves a Review revision for the existing publisher.';
