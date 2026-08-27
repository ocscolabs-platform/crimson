-- Phase 6B1 prerequisite: secure pre-publication Insights slug editing.
-- This is metadata editing, not a workflow transition, so it does not write
-- to insights_workflow_audit_log.

create or replace function public.insights_update_article_slug(
  p_article_id uuid,
  p_expected_updated_at timestamptz,
  p_slug text
)
returns table (
  article_id uuid,
  slug text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
begin
  if not public.cms_can_edit_insights() then
    raise exception 'This member cannot edit Insights article metadata';
  end if;

  if p_article_id is null then
    raise exception 'The Insight article identity is required';
  end if;

  if p_expected_updated_at is null then
    raise exception 'The Insight article timestamp is required';
  end if;

  if p_slug is null
    or p_slug <> btrim(p_slug)
    or char_length(p_slug) not between 1 and 120
    or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Article slug must use lowercase letters, numbers, and hyphens';
  end if;

  select *
  into article
  from public.insights_articles
  where id = p_article_id
  for update;

  if article.id is null then
    raise exception 'The Insight article does not exist';
  end if;

  if not public.cms_has_full_cms_access() and article.author_id <> auth.uid() then
    raise exception 'Editors may only edit their own Insight article metadata';
  end if;

  if article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before updating the slug';
  end if;

  if article.status <> 'draft' then
    raise exception 'Only a Draft Insight can have its slug updated';
  end if;

  -- Batch 6A archives a Published revision during Unpublish. Therefore the
  -- durable first-publication signal is the article's retained published_at or
  -- last_published_revision_id, with the historical Published-row check kept
  -- as a defensive invariant for any future transition implementation.
  if article.published_at is not null
    or article.last_published_revision_id is not null
    or exists (
      select 1
      from public.insights_article_revisions revision
      where revision.article_id = article.id
        and revision.status = 'published'
    ) then
    raise exception 'Published Insight slugs are immutable';
  end if;

  update public.insights_articles as target
  set slug = p_slug,
      updated_at = now()
  where target.id = article.id
  returning target.id, target.slug, target.updated_at
  into article_id, slug, updated_at;

  return next;
exception
  when unique_violation then
    raise exception 'That Insight slug is already in use';
end;
$$;

revoke all on function public.insights_update_article_slug(uuid, timestamptz, text) from public;
grant execute on function public.insights_update_article_slug(uuid, timestamptz, text) to authenticated;

comment on function public.insights_update_article_slug(uuid, timestamptz, text) is
  'Owner or the article owner may update a never-published Draft slug with optimistic concurrency. Published slugs remain frozen forever.';
