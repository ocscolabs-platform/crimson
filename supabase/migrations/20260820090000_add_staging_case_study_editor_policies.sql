-- OCSCO Project Crimson controlled case-study editor.
-- Apply in crimson-staging only after the case-study audit and media-contract
-- migrations. This enables update-only content editing; it does not add
-- insert, delete, relationship, media-upload, or Production policies.

grant update on public.case_studies to authenticated;

create policy "cms members can review case studies"
  on public.case_studies for select
  to authenticated
  using (
    public.cms_has_role(array['owner', 'editor', 'reviewer']::text[])
    and (
      status <> 'archived'
      or public.cms_has_role(array['owner']::text[])
    )
  );

create policy "owners can update case studies"
  on public.case_studies for update
  to authenticated
  using (public.cms_has_role(array['owner']::text[]))
  with check (public.cms_has_role(array['owner']::text[]));

create policy "editors can update draft or review case studies"
  on public.case_studies for update
  to authenticated
  using (
    public.cms_has_role(array['editor']::text[])
    and status in ('draft', 'review')
  )
  with check (
    public.cms_has_role(array['editor']::text[])
    and status in ('draft', 'review')
  );

create or replace function public.cms_prepare_case_study_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists case_studies_prepare_publication on public.case_studies;

create trigger case_studies_prepare_publication
before update on public.case_studies
for each row
execute function public.cms_prepare_case_study_publication();

comment on table public.case_studies is
  'Staging case-study content. Owner/editor updates are controlled; inserts, deletes, relationships, and media uploads remain separate workflows.';

comment on function public.cms_prepare_case_study_publication() is
  'Owners publish/archive case studies. Published content must move through review before edits or republishing.';
