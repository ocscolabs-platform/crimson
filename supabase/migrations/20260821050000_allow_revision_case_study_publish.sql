-- OCSCO Project Crimson: allow the revision publisher through the legacy guard.
--
-- The revision publisher intentionally updates a published base row with the
-- reviewed payload while keeping its status as published. The original
-- staging trigger treats that shape as an unsafe direct edit. Keep the guard
-- for all ordinary writes, but allow the owner RPC path when a review revision
-- exists for the same case study.

create or replace function public.cms_prepare_case_study_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  revision_publish boolean;
begin
  revision_publish := public.cms_has_role(array['owner']::text[])
    and exists (
      select 1
      from public.cms_revisions
      where entity_type = 'case_study'
        and entity_key = new.id::text
        and status = 'review'
    );

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
  'Owners publish case studies through the revision RPC. Direct published edits remain blocked.';
