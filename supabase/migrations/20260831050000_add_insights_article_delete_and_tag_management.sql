-- OCSCO Project Crimson — narrow Owner Insights article deletion and tags.
--
-- Article deletion is allowed only after publication has been explicitly
-- removed. The RPC returns the article-owned media paths so the server action
-- can clean the corresponding Storage objects without exposing a service key.

begin;

grant insert, delete on public.insights_tags to authenticated;

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

  update public.insights_article_revisions
  set cover_media_id = null
  where article_id = article.id;

  delete from public.insights_articles where id = article.id;

  return jsonb_build_object(
    'private_paths', private_paths,
    'public_paths', public_paths
  );
end;
$$;

revoke all on function public.insights_delete_article(uuid, timestamptz) from public;
grant execute on function public.insights_delete_article(uuid, timestamptz) to authenticated;

comment on function public.insights_delete_article(uuid, timestamptz) is
  'Owner-only Insights deletion. Published articles must be explicitly unpublished first; returned media paths are article-owned cleanup targets.';

commit;
