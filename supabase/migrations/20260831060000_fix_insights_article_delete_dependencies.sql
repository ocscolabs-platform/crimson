-- OCSCO Project Crimson — fix the narrow Owner Insights article delete order.
--
-- Published articles remain protected by the live-revision guard. For an
-- unpublished article, clear article-owned restrictive references and remove
-- dependent rows before deleting the article. Shared Categories, Tags, and
-- unrelated media are never touched.

begin;

create or replace function public.insights_delete_article(
  p_article_id uuid,
  p_expected_updated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  private_paths jsonb;
  public_paths jsonb;
begin
  if public.cms_current_role() <> 'owner' then
    raise exception 'Only the Owner can delete Insights articles';
  end if;

  select * into article
  from public.insights_articles
  where id = p_article_id
  for update;
  if article.id is null then
    raise exception 'The Insight article does not exist';
  end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before deleting';
  end if;
  if article.published_revision_id is not null then
    raise exception 'Unpublish this article before deleting it';
  end if;

  select coalesce(jsonb_agg(asset.storage_path), '[]'::jsonb)
    into private_paths
  from public.insights_media_assets asset
  where asset.article_id = article.id;

  select coalesce(jsonb_agg(asset.public_storage_path) filter (where asset.public_storage_path is not null), '[]'::jsonb)
    into public_paths
  from public.insights_media_assets asset
  where asset.article_id = article.id;

  -- Remove any stale projection before its restrictive revision reference can
  -- prevent article-owned revision cleanup.
  delete from public.insights_public_articles
  where article_id = article.id;

  -- Break the article -> revision and revision -> media restrictive edges.
  update public.insights_article_revisions
  set cover_media_id = null
  where article_id = article.id;

  delete from public.insights_revision_media
  where revision_id in (
    select id from public.insights_article_revisions where article_id = article.id
  );

  delete from public.insights_article_revision_tags
  where revision_id in (
    select id from public.insights_article_revisions where article_id = article.id
  );

  -- Only media owned by this article is returned for Storage cleanup by the
  -- server action. Shared taxonomy and unrelated media remain untouched.
  delete from public.insights_media_assets
  where article_id = article.id;

  update public.insights_articles
  set active_revision_id = null,
      published_revision_id = null,
      last_published_revision_id = null
  where id = article.id;

  delete from public.insights_article_revisions
  where article_id = article.id;

  delete from public.insights_articles
  where id = article.id;

  return jsonb_build_object(
    'private_paths', private_paths,
    'public_paths', public_paths
  );
end;
$$;

revoke all on function public.insights_delete_article(uuid, timestamptz) from public;
grant execute on function public.insights_delete_article(uuid, timestamptz) to authenticated;

comment on function public.insights_delete_article(uuid, timestamptz) is
  'Owner-only Insights deletion. Published articles must be explicitly unpublished first; article-owned references and dependents are removed in safe order and returned media paths are cleanup targets.';

commit;
