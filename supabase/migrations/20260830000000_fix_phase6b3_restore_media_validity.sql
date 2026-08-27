-- OCSCO Project Crimson — Phase 6 / Batch 6B3 Restore media validity fix.
--
-- Migration #31 passed the full Insights body envelope to helpers that accept
-- a document node. Those helpers recurse through `content`, not the envelope
-- `doc`, so restored bodies retained historical inline media IDs. The final
-- publishability guard correctly rejected that invalid Draft. This additive
-- correction traverses and rewrites only body.doc before validation.

begin;

create or replace function public.insights_restore_revision(
  p_article_id uuid,
  p_source_revision_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  source_revision public.insights_article_revisions%rowtype;
  active_revision public.insights_article_revisions%rowtype;
  source_media record;
  restored_id uuid;
  restored_media_id uuid;
  restored_cover_media_id uuid;
  next_revision integer;
  media_mapping jsonb := '{}'::jsonb;
  restored_body jsonb;
begin
  if not public.cms_can_restore_insights() then raise exception 'Only the owner can restore Insights'; end if;

  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;

  select * into source_revision
  from public.insights_article_revisions
  where id = p_source_revision_id
    and article_id = article.id
    and status in ('published', 'archived')
  for update;
  if source_revision.id is null then raise exception 'That historical Insight revision cannot be restored'; end if;

  if article.active_revision_id is not null then
    select * into active_revision from public.insights_article_revisions where id = article.active_revision_id for update;
    if active_revision.status in ('draft', 'review') then
      update public.insights_article_revisions set status = 'archived', updated_at = now() where id = active_revision.id;
    end if;
  end if;

  select coalesce(max(revision_number), 0) + 1 into next_revision
  from public.insights_article_revisions
  where article_id = article.id;

  insert into public.insights_article_revisions (
    article_id, revision_number, status, title, excerpt, body,
    primary_category_id, cover_media_id, created_by
  ) values (
    article.id, next_revision, 'draft', source_revision.title, source_revision.excerpt,
    source_revision.body, source_revision.primary_category_id, null, auth.uid()
  ) returning id into restored_id;

  insert into public.insights_article_revision_tags (revision_id, tag_id)
  select restored_id, tag_id
  from public.insights_article_revision_tags
  where revision_id = source_revision.id;

  for source_media in
    select distinct
      asset.id, asset.article_id, asset.revision_id, asset.kind, asset.storage_path,
      asset.source_mime_type, asset.source_byte_size, asset.normalized_mime_type,
      asset.normalized_byte_size, asset.width, asset.height, asset.alt_text, asset.caption,
      asset.status
    from public.insights_media_assets asset
    join public.insights_revision_media relation on relation.media_id = asset.id
    where relation.revision_id = source_revision.id
      and asset.article_id = article.id
    order by asset.id
  loop
    if source_media.revision_id <> source_revision.id or source_media.status <> 'ready' then
      raise exception 'Historical media is not a ready source for Restore';
    end if;

    restored_media_id := gen_random_uuid();
    media_mapping := media_mapping || jsonb_build_object(source_media.id::text, restored_media_id::text);

    insert into public.insights_media_assets (
      id, article_id, revision_id, created_by, kind, storage_path,
      source_mime_type, source_byte_size, normalized_mime_type,
      normalized_byte_size, width, height, alt_text, caption
    ) values (
      restored_media_id, article.id, restored_id, auth.uid(), source_media.kind, source_media.storage_path,
      source_media.source_mime_type, source_media.source_byte_size, source_media.normalized_mime_type,
      source_media.normalized_byte_size, source_media.width, source_media.height,
      source_media.alt_text, source_media.caption
    );

    insert into public.insights_revision_media (revision_id, media_id, role)
    select restored_id, restored_media_id, relation.role
    from public.insights_revision_media relation
    where relation.revision_id = source_revision.id
      and relation.media_id = source_media.id;

    if source_revision.cover_media_id = source_media.id then
      restored_cover_media_id := restored_media_id;
    end if;
  end loop;

  if source_revision.cover_media_id is not null and restored_cover_media_id is null then
    raise exception 'Historical Cover media could not be restored';
  end if;

  -- These helpers operate on a document node. Migration #31 passed the body
  -- envelope, which left historical inline IDs in the restored Draft.
  if exists (
    select 1
    from public.insights_body_media_ids(source_revision.body->'doc') referenced
    where not (media_mapping ? referenced.media_id::text)
  ) then
    raise exception 'Historical inline media could not be restored';
  end if;

  restored_body := jsonb_set(
    source_revision.body,
    '{doc}',
    public.insights_rewrite_restore_media_ids(source_revision.body->'doc', media_mapping),
    true
  );
  update public.insights_article_revisions
  set body = restored_body, cover_media_id = restored_cover_media_id, updated_at = now()
  where id = restored_id;

  -- Validate the complete new Draft with the unchanged canonical contract.
  if not public.insights_revision_is_publishable(restored_id) then
    raise exception 'Restored media is not valid for the new Draft revision';
  end if;

  update public.insights_articles
  set active_revision_id = restored_id, status = 'draft', submitted_at = null, published_at = null, updated_at = now()
  where id = article.id;

  perform public.insights_write_audit(
    article.id, restored_id, 'restored', article.status, 'draft',
    jsonb_build_object('source_revision_id', source_revision.id)
  );
  return restored_id;
end;
$$;

revoke all on function public.insights_restore_revision(uuid, uuid) from public;
grant execute on function public.insights_restore_revision(uuid, uuid) to authenticated;

commit;
