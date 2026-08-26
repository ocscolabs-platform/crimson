-- OCSCO Project Crimson — Phase 6 / Batch 6B3 Insights media workflow.
--
-- This is an additive, Insights-specific media boundary. Private canonical
-- WebP objects are retained for history and restore. Published delivery
-- objects are copied into a separate bucket only for the exact Published
-- revision, and the sanitized public projection contains only stable public
-- artifact paths. Migrations 1-29 remain unchanged.

begin;

create table if not exists public.insights_media_assets (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.insights_articles(id) on delete cascade,
  revision_id uuid not null references public.insights_article_revisions(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('cover', 'inline')),
  storage_path text not null unique,
  source_mime_type text not null check (source_mime_type in ('image/avif', 'image/jpeg', 'image/png', 'image/webp')),
  source_byte_size integer not null check (source_byte_size > 0 and source_byte_size <= 2097152),
  normalized_mime_type text not null default 'image/webp' check (normalized_mime_type = 'image/webp'),
  normalized_byte_size integer not null check (normalized_byte_size > 0 and normalized_byte_size <= 2097152),
  width integer not null check (width > 0 and width <= 2400),
  height integer not null check (height > 0 and height <= 2400),
  alt_text text not null check (char_length(btrim(alt_text)) between 8 and 300),
  caption text check (caption is null or char_length(btrim(caption)) <= 300),
  status text not null default 'ready' check (status in ('ready', 'removed')),
  public_storage_path text,
  public_artifact_status text not null default 'not_created' check (public_artifact_status in ('not_created', 'ready', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz
);

alter table public.insights_article_revisions
  add column if not exists cover_media_id uuid references public.insights_media_assets(id) on delete restrict;

create table if not exists public.insights_revision_media (
  revision_id uuid not null references public.insights_article_revisions(id) on delete cascade,
  media_id uuid not null references public.insights_media_assets(id) on delete restrict,
  role text not null check (role in ('cover', 'inline')),
  created_at timestamptz not null default now(),
  primary key (revision_id, media_id, role)
);

create unique index if not exists insights_revision_one_cover_media_idx
  on public.insights_revision_media(revision_id)
  where role = 'cover';

create index if not exists insights_media_assets_article_idx
  on public.insights_media_assets(article_id, revision_id, created_at desc);

create index if not exists insights_media_assets_public_idx
  on public.insights_media_assets(public_storage_path)
  where public_artifact_status = 'ready';

drop trigger if exists insights_media_assets_set_updated_at on public.insights_media_assets;
create trigger insights_media_assets_set_updated_at
before update on public.insights_media_assets
for each row execute function public.cms_set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('insights-private-media', 'insights-private-media', false, 2097152, array['image/webp']::text[]),
  ('insights-published-media', 'insights-published-media', false, 2097152, array['image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.insights_media_assets enable row level security;
alter table public.insights_revision_media enable row level security;

revoke all on public.insights_media_assets, public.insights_revision_media from anon, authenticated;
grant select on public.insights_media_assets, public.insights_revision_media to authenticated;

drop policy if exists "Insights members can read authorized media metadata" on public.insights_media_assets;
create policy "Insights members can read authorized media metadata"
  on public.insights_media_assets for select to authenticated
  using (
    public.cms_can_access_insights()
    and exists (
      select 1 from public.insights_articles article
      where article.id = article_id
        and (public.cms_has_full_cms_access() or article.author_id = auth.uid())
    )
  );

drop policy if exists "Insights members can read authorized revision media" on public.insights_revision_media;
create policy "Insights members can read authorized revision media"
  on public.insights_revision_media for select to authenticated
  using (
    public.cms_can_access_insights()
    and exists (
      select 1
      from public.insights_article_revisions revision
      join public.insights_articles article on article.id = revision.article_id
      where revision.id = revision_id
        and (public.cms_has_full_cms_access() or article.author_id = auth.uid())
    )
  );

create or replace function public.insights_body_contains_text(p_node jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  child jsonb;
begin
  if jsonb_typeof(p_node) <> 'object' then return false; end if;
  if p_node->>'type' = 'text' and char_length(btrim(coalesce(p_node->>'text', ''))) > 0 then
    return true;
  end if;
  if jsonb_typeof(p_node->'content') = 'array' then
    for child in select value from jsonb_array_elements(p_node->'content') loop
      if public.insights_body_contains_text(child) then return true; end if;
    end loop;
  end if;
  return false;
end;
$$;

create or replace function public.insights_body_media_ids(p_node jsonb)
returns table(media_id uuid)
language plpgsql
immutable
set search_path = public
as $$
declare
  child jsonb;
  candidate uuid;
begin
  if jsonb_typeof(p_node) <> 'object' then return; end if;
  if p_node->>'type' = 'image' then
    begin
      candidate := nullif(p_node->'attrs'->>'mediaId', '')::uuid;
    exception when others then
      return;
    end;
    if candidate is not null then media_id := candidate; return next; end if;
  end if;
  if jsonb_typeof(p_node->'content') = 'array' then
    for child in select value from jsonb_array_elements(p_node->'content') loop
      return query select nested.media_id from public.insights_body_media_ids(child) nested;
    end loop;
  end if;
end;
$$;

create or replace function public.insights_body_media_is_valid(
  p_revision_id uuid,
  p_node jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  revision public.insights_article_revisions%rowtype;
  child jsonb;
  media_uuid uuid;
begin
  select * into revision from public.insights_article_revisions where id = p_revision_id;
  if revision.id is null or jsonb_typeof(p_node) <> 'object' then return false; end if;
  if p_node->>'type' = 'image' then
    begin media_uuid := nullif(p_node->'attrs'->>'mediaId', '')::uuid; exception when others then return false; end;
    if media_uuid is null or char_length(btrim(coalesce(p_node->'attrs'->>'alt', ''))) < 8 then return false; end if;
    return exists (
      select 1
      from public.insights_revision_media relation
      join public.insights_media_assets asset on asset.id = relation.media_id
      where relation.revision_id = p_revision_id
        and relation.media_id = media_uuid
        and relation.role = 'inline'
        and asset.article_id = revision.article_id
        and asset.revision_id = revision.id
        and asset.status = 'ready'
        and char_length(btrim(asset.alt_text)) >= 8
    );
  end if;
  if jsonb_typeof(p_node->'content') = 'array' then
    for child in select value from jsonb_array_elements(p_node->'content') loop
      if not public.insights_body_media_is_valid(p_revision_id, child) then return false; end if;
    end loop;
  end if;
  return true;
end;
$$;

create or replace function public.insights_revision_is_publishable(p_revision_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  revision public.insights_article_revisions%rowtype;
  body_version integer;
begin
  select * into revision from public.insights_article_revisions where id = p_revision_id;
  if revision.id is null then return false; end if;
  select * into article from public.insights_articles where id = revision.article_id;
  if article.id is null or char_length(btrim(revision.title)) = 0 then return false; end if;
  if revision.primary_category_id is null or not exists (
    select 1 from public.insights_categories category
    where category.id = revision.primary_category_id and category.is_active
  ) then return false; end if;
  if jsonb_typeof(revision.body) <> 'object' or revision.body->>'schema' <> 'insights-body' then return false; end if;
  begin body_version := (revision.body->>'version')::integer; exception when others then return false; end;
  if body_version not in (1, 2) or jsonb_typeof(revision.body->'doc') <> 'object' then return false; end if;
  if not public.insights_body_contains_text(revision.body->'doc') then return false; end if;
  if not public.insights_body_media_is_valid(revision.id, revision.body->'doc') then return false; end if;
  return exists (
    select 1
    from public.insights_revision_media relation
    join public.insights_media_assets asset on asset.id = relation.media_id
    where relation.revision_id = revision.id
      and relation.media_id = revision.cover_media_id
      and relation.role = 'cover'
      and asset.article_id = article.id
      and asset.revision_id = revision.id
      and asset.kind = 'cover'
      and asset.status = 'ready'
      and char_length(btrim(asset.alt_text)) >= 8
  );
end;
$$;

create or replace function public.insights_sanitize_public_node(
  p_revision_id uuid,
  p_node jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  child jsonb;
  media_uuid uuid;
  asset public.insights_media_assets%rowtype;
  public_children jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_node) <> 'object' then return '{}'::jsonb; end if;
  if p_node->>'type' = 'image' then
    begin media_uuid := nullif(p_node->'attrs'->>'mediaId', '')::uuid; exception when others then return '{}'::jsonb; end;
    select media.* into asset
    from public.insights_media_assets media
    join public.insights_revision_media relation on relation.media_id = media.id
    where relation.revision_id = p_revision_id
      and relation.media_id = media_uuid
      and relation.role = 'inline'
      and media.status = 'ready'
      and media.public_artifact_status = 'ready';
    if asset.id is null then return '{}'::jsonb; end if;
    return jsonb_build_object('type', 'image', 'attrs', jsonb_strip_nulls(jsonb_build_object(
      'src', asset.public_storage_path,
      'alt', asset.alt_text,
      'caption', asset.caption
    )));
  end if;
  if jsonb_typeof(p_node->'content') = 'array' then
    for child in select value from jsonb_array_elements(p_node->'content') loop
      public_children := public_children || jsonb_build_array(public.insights_sanitize_public_node(p_revision_id, child));
    end loop;
    result := jsonb_set(p_node - 'content', '{content}', public_children, true);
    return result;
  end if;
  return p_node;
end;
$$;

create or replace function public.insights_sanitize_public_body(p_revision_id uuid, p_body jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'schema', 'insights-body',
    'version', coalesce(nullif(p_body->>'version', '')::integer, 1),
    'doc', public.insights_sanitize_public_node(p_revision_id, p_body->'doc')
  );
$$;

create or replace function public.insights_is_public_media_path(p_object_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.insights_media_assets asset
    join public.insights_public_articles projection on projection.article_id = asset.article_id
    where asset.public_storage_path = p_object_path
      and asset.public_artifact_status = 'ready'
      and projection.published_at is not null
  );
$$;

drop policy if exists "Insights members can read private canonical media" on storage.objects;
create policy "Insights members can read private canonical media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'insights-private-media'
    and exists (
      select 1
      from public.insights_media_assets asset
      join public.insights_articles article on article.id = asset.article_id
      where asset.storage_path = name
        and asset.status = 'ready'
        and public.cms_can_access_insights()
        and (public.cms_has_full_cms_access() or article.author_id = auth.uid())
    )
  );

drop policy if exists "Published Insights media artifacts are public" on storage.objects;
create policy "Published Insights media artifacts are public"
  on storage.objects for select to public
  using (bucket_id = 'insights-published-media' and public.insights_is_public_media_path(name));

alter table public.insights_public_articles
  add column if not exists cover_image_path text,
  add column if not exists cover_image_alt text;

create or replace function public.insights_register_media(
  p_media_id uuid,
  p_article_id uuid,
  p_expected_updated_at timestamptz,
  p_kind text,
  p_storage_path text,
  p_source_mime_type text,
  p_source_byte_size integer,
  p_normalized_byte_size integer,
  p_width integer,
  p_height integer,
  p_alt_text text,
  p_caption text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  revision public.insights_article_revisions%rowtype;
begin
  if not public.cms_can_edit_insights() then raise exception 'This member cannot manage Insights media'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if not public.cms_has_full_cms_access() and article.author_id <> auth.uid() then raise exception 'Editors may only manage their own Insight media'; end if;
  if article.status <> 'draft' then raise exception 'Media can only be changed while the article is a Draft'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then raise exception 'The Insight changed. Reload before managing media'; end if;
  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status <> 'draft' then raise exception 'The active Draft revision is missing'; end if;
  if p_kind not in ('cover', 'inline') then raise exception 'Unsupported Insights media kind'; end if;
  if p_source_mime_type not in ('image/avif', 'image/jpeg', 'image/png', 'image/webp') then raise exception 'Unsupported source image type'; end if;
  if p_source_byte_size <= 0 or p_source_byte_size > 2097152 or p_normalized_byte_size <= 0 or p_normalized_byte_size > 2097152 then raise exception 'Image size is outside the approved limit'; end if;
  if p_width <= 0 or p_width > 2400 or p_height <= 0 or p_height > 2400 then raise exception 'Image dimensions are outside the approved limit'; end if;
  if char_length(btrim(coalesce(p_alt_text, ''))) < 8 then raise exception 'Meaningful alternative text is required'; end if;
  if p_storage_path <> format('articles/%s/revisions/%s/%s.webp', article.id, revision.id, p_media_id) then raise exception 'The media storage identity is invalid'; end if;

  insert into public.insights_media_assets (
    id, article_id, revision_id, created_by, kind, storage_path,
    source_mime_type, source_byte_size, normalized_byte_size,
    width, height, alt_text, caption
  ) values (
    p_media_id, article.id, revision.id, auth.uid(), p_kind, p_storage_path,
    p_source_mime_type, p_source_byte_size, p_normalized_byte_size,
    p_width, p_height, btrim(p_alt_text), nullif(btrim(p_caption), '')
  );

  if p_kind = 'cover' then
    delete from public.insights_revision_media where revision_id = revision.id and role = 'cover';
    insert into public.insights_revision_media (revision_id, media_id, role) values (revision.id, p_media_id, 'cover');
    update public.insights_article_revisions set cover_media_id = p_media_id, updated_at = now() where id = revision.id;
  else
    insert into public.insights_revision_media (revision_id, media_id, role) values (revision.id, p_media_id, 'inline');
  end if;
  update public.insights_articles set updated_at = now() where id = article.id;
  return p_media_id;
end;
$$;

create or replace function public.insights_remove_media(
  p_article_id uuid,
  p_expected_updated_at timestamptz,
  p_media_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  revision public.insights_article_revisions%rowtype;
  asset public.insights_media_assets%rowtype;
begin
  if not public.cms_can_edit_insights() then raise exception 'This member cannot manage Insights media'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if not public.cms_has_full_cms_access() and article.author_id <> auth.uid() then raise exception 'Editors may only manage their own Insight media'; end if;
  if article.status <> 'draft' then raise exception 'Media can only be changed while the article is a Draft'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then raise exception 'The Insight changed. Reload before managing media'; end if;
  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  select * into asset from public.insights_media_assets where id = p_media_id and article_id = article.id;
  if asset.id is null or not exists (select 1 from public.insights_revision_media where revision_id = revision.id and media_id = asset.id) then raise exception 'That media is not part of the active Draft'; end if;
  delete from public.insights_revision_media where revision_id = revision.id and media_id = asset.id;
  if revision.cover_media_id = asset.id then
    update public.insights_article_revisions set cover_media_id = null, updated_at = now() where id = revision.id;
  end if;
  update public.insights_media_assets set status = 'removed', removed_at = now(), updated_at = now() where id = asset.id;
  update public.insights_articles set updated_at = now() where id = article.id;
  return asset.id;
end;
$$;

create or replace function public.insights_update_media_alt(
  p_article_id uuid,
  p_expected_updated_at timestamptz,
  p_media_id uuid,
  p_alt_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  revision public.insights_article_revisions%rowtype;
begin
  if not public.cms_can_edit_insights() then raise exception 'This member cannot manage Insights media'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null or (not public.cms_has_full_cms_access() and article.author_id <> auth.uid()) then raise exception 'Media ownership could not be verified'; end if;
  if article.status <> 'draft' then raise exception 'Media can only be changed while the article is a Draft'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then raise exception 'The Insight changed. Reload before managing media'; end if;
  select * into revision from public.insights_article_revisions where id = article.active_revision_id;
  if not exists (select 1 from public.insights_revision_media where revision_id = revision.id and media_id = p_media_id) then raise exception 'That media is not part of the active Draft'; end if;
  if char_length(btrim(coalesce(p_alt_text, ''))) < 8 then raise exception 'Meaningful alternative text is required'; end if;
  update public.insights_media_assets set alt_text = btrim(p_alt_text), updated_at = now() where id = p_media_id and article_id = article.id and status = 'ready';
  update public.insights_articles set updated_at = now() where id = article.id;
  return p_media_id;
end;
$$;

drop function if exists public.insights_save_draft(uuid, timestamptz, text, text, jsonb, uuid, uuid[]);
create or replace function public.insights_save_draft(
  p_article_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_excerpt text,
  p_body jsonb,
  p_primary_category_id uuid,
  p_tag_ids uuid[] default null,
  p_cover_media_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  revision public.insights_article_revisions%rowtype;
  next_revision integer;
begin
  if not public.cms_can_edit_insights() then raise exception 'This member cannot edit Insights articles'; end if;
  if jsonb_typeof(p_body) <> 'object' then raise exception 'Insight body must be a JSON object'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if not public.cms_has_full_cms_access() and article.author_id <> auth.uid() then raise exception 'Editors may only edit their own Insight articles'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then raise exception 'The Insight changed. Reload before saving the Draft.'; end if;
  if article.status = 'review' then raise exception 'Review is immutable; withdraw it before saving a Draft'; end if;
  if article.active_revision_id is not null then select * into revision from public.insights_article_revisions where id = article.active_revision_id for update; end if;
  if revision.id is null or revision.status <> 'draft' then
    select coalesce(max(revision_number), 0) + 1 into next_revision from public.insights_article_revisions where article_id = article.id;
    insert into public.insights_article_revisions (article_id, revision_number, status, created_by) values (article.id, next_revision, 'draft', auth.uid()) returning * into revision;
  end if;
  if p_cover_media_id is not null and not exists (
    select 1 from public.insights_revision_media relation join public.insights_media_assets asset on asset.id = relation.media_id
    where relation.revision_id = revision.id and relation.media_id = p_cover_media_id and relation.role = 'cover' and asset.status = 'ready'
  ) then raise exception 'The selected Cover image is not part of this Draft'; end if;
  update public.insights_article_revisions
  set status = 'draft', title = coalesce(p_title, ''), excerpt = p_excerpt, body = p_body,
      primary_category_id = p_primary_category_id, cover_media_id = p_cover_media_id, updated_at = now()
  where id = revision.id;
  if p_tag_ids is not null then
    delete from public.insights_article_revision_tags where revision_id = revision.id;
    insert into public.insights_article_revision_tags (revision_id, tag_id)
    select revision.id, tag_id from unnest(p_tag_ids) as tag_id
    where exists (select 1 from public.insights_tags tag where tag.id = tag_id);
  end if;
  update public.insights_articles set active_revision_id = revision.id, status = 'draft', updated_at = now() where id = article.id;
  return revision.id;
end;
$$;

create or replace function public.insights_submit_for_review(
  p_article_id uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  revision public.insights_article_revisions%rowtype;
begin
  if not public.cms_can_submit_insights() then raise exception 'This member cannot submit Insights articles'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if not public.cms_has_full_cms_access() and article.author_id <> auth.uid() then raise exception 'Editors may only submit their own Insight articles'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then raise exception 'The Insight changed. Reload before submitting'; end if;
  if article.status <> 'draft' then raise exception 'Only a Draft can be submitted'; end if;
  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status <> 'draft' then raise exception 'The active Draft revision is missing'; end if;
  if not public.insights_revision_is_publishable(revision.id) then raise exception 'Add a valid Title, Body, Category, Cover, and image alternative text before Submit'; end if;
  update public.insights_article_revisions set status = 'review', updated_at = now() where id = revision.id;
  update public.insights_articles set status = 'review', submitted_at = now(), updated_at = now() where id = article.id;
  perform public.insights_write_audit(article.id, revision.id, 'submitted', 'draft', 'review');
  return revision.id;
end;
$$;

drop function if exists public.insights_publish_article(uuid, timestamptz);
create or replace function public.insights_publish_article(
  p_article_id uuid,
  p_expected_updated_at timestamptz,
  p_public_media jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  revision public.insights_article_revisions%rowtype;
  previous_revision_id uuid;
  display_name text;
  cover_id uuid;
  image_ref record;
  artifact jsonb;
  asset public.insights_media_assets%rowtype;
begin
  if not public.cms_can_publish_insights() then raise exception 'This member cannot publish Insights'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if public.cms_current_role() <> 'owner' and article.author_id <> auth.uid() then raise exception 'Trusted Publishers may only publish their own Insight articles'; end if;
  if public.cms_current_role() <> 'owner' and article.status <> 'draft' then raise exception 'Trusted Publishers may only publish their own Draft'; end if;
  if public.cms_current_role() = 'owner' and article.status not in ('draft', 'review') then raise exception 'Only a Draft or Review can be published'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then raise exception 'The Insight changed. Reload before publishing'; end if;
  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status not in ('draft', 'review') then raise exception 'The active revision cannot be published'; end if;
  if not public.insights_revision_is_publishable(revision.id) then raise exception 'Add a valid Title, Body, Category, Cover, and image alternative text before Publish'; end if;
  if jsonb_typeof(p_public_media) <> 'object' or jsonb_typeof(p_public_media->'cover') <> 'object' or jsonb_typeof(p_public_media->'inline') <> 'array' then raise exception 'Published media artifacts are incomplete'; end if;
  begin cover_id := (p_public_media->'cover'->>'media_id')::uuid; exception when others then raise exception 'Published Cover artifact identity is invalid'; end;
  if cover_id is distinct from revision.cover_media_id then raise exception 'Published Cover artifact does not match the active revision'; end if;
  select * into asset from public.insights_media_assets where id = cover_id and article_id = article.id and revision_id = revision.id and kind = 'cover' and status = 'ready';
  if asset.id is null or coalesce(p_public_media->'cover'->>'public_path', '') <> format('articles/%s/revisions/%s/%s.webp', article.id, revision.id, asset.id) then raise exception 'Published Cover artifact is invalid'; end if;
  update public.insights_media_assets set public_storage_path = p_public_media->'cover'->>'public_path', public_artifact_status = 'ready', updated_at = now() where id = asset.id;
  for image_ref in select distinct media_id from public.insights_body_media_ids(revision.body->'doc') loop
    select * into asset from public.insights_media_assets where id = image_ref.media_id and article_id = article.id and revision_id = revision.id and kind = 'inline' and status = 'ready';
    if asset.id is null then raise exception 'An inline image is not ready for Publish'; end if;
    select value into artifact from jsonb_array_elements(p_public_media->'inline') where value->>'media_id' = asset.id::text;
    if artifact is null or coalesce(artifact->>'public_path', '') <> format('articles/%s/revisions/%s/%s.webp', article.id, revision.id, asset.id) then raise exception 'An inline Published artifact is missing'; end if;
    update public.insights_media_assets set public_storage_path = artifact->>'public_path', public_artifact_status = 'ready', updated_at = now() where id = asset.id;
  end loop;
  select nullif(btrim(public_display_name), '') into display_name from public.cms_members where user_id = article.author_id;
  previous_revision_id := article.published_revision_id;
  if previous_revision_id is not null and previous_revision_id <> revision.id then
    update public.insights_article_revisions set status = 'archived', updated_at = now() where id = previous_revision_id and status = 'published';
  end if;
  update public.insights_article_revisions set status = 'published', published_at = now(), author_display_name_snapshot = coalesce(display_name, 'OCSCO Team'), updated_at = now() where id = revision.id;
  update public.insights_articles set status = 'published', active_revision_id = revision.id, published_revision_id = revision.id, last_published_revision_id = revision.id, published_at = now(), unpublished_at = null, updated_at = now() where id = article.id;
  insert into public.insights_public_articles (
    article_id, slug, revision_id, title, excerpt, body, author_display_name, category_name, category_slug, tags, published_at, cover_image_path, cover_image_alt
  )
  select current_article.id, current_article.slug, current_revision.id, current_revision.title, current_revision.excerpt,
    public.insights_sanitize_public_body(current_revision.id, current_revision.body), current_revision.author_display_name_snapshot,
    category.name, category.slug,
    coalesce((select jsonb_agg(jsonb_build_object('name', tag.name, 'slug', tag.slug) order by tag.name) from public.insights_article_revision_tags relation join public.insights_tags tag on tag.id = relation.tag_id where relation.revision_id = current_revision.id), '[]'::jsonb),
    current_revision.published_at, cover_asset.public_storage_path, cover_asset.alt_text
  from public.insights_articles current_article
  join public.insights_article_revisions current_revision on current_revision.id = current_article.published_revision_id
  join public.insights_media_assets cover_asset on cover_asset.id = current_revision.cover_media_id and cover_asset.public_artifact_status = 'ready'
  left join public.insights_categories category on category.id = current_revision.primary_category_id
  where current_article.id = article.id and current_revision.id = revision.id
  on conflict (article_id) do update set
    slug = excluded.slug, revision_id = excluded.revision_id, title = excluded.title, excerpt = excluded.excerpt,
    body = excluded.body, author_display_name = excluded.author_display_name, category_name = excluded.category_name,
    category_slug = excluded.category_slug, tags = excluded.tags, published_at = excluded.published_at,
    cover_image_path = excluded.cover_image_path, cover_image_alt = excluded.cover_image_alt;
  perform public.insights_write_audit(article.id, revision.id, case when previous_revision_id is null then 'published' else 'republished' end, article.status, 'published', jsonb_build_object('previous_revision_id', previous_revision_id));
  return revision.id;
end;
$$;

create or replace function public.insights_unpublish_article(
  p_article_id uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article public.insights_articles%rowtype;
  previous_revision_id uuid;
begin
  if not public.cms_can_unpublish_insights() then raise exception 'Only the owner can unpublish Insights'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then raise exception 'The Insight changed. Reload before unpublishing'; end if;
  if article.published_revision_id is null then raise exception 'The Insight is not currently published'; end if;
  previous_revision_id := article.published_revision_id;
  update public.insights_article_revisions set status = 'archived', updated_at = now() where id = previous_revision_id and status = 'published';
  update public.insights_articles set status = 'unpublished', published_revision_id = null, unpublished_at = now(), updated_at = now() where id = article.id;
  delete from public.insights_public_articles where article_id = article.id;
  perform public.insights_write_audit(article.id, previous_revision_id, 'unpublished', article.status, 'unpublished');
  return previous_revision_id;
end;
$$;

create or replace function public.insights_mark_media_artifacts_removed(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.cms_current_role() <> 'owner' then raise exception 'Only the owner can record media cleanup'; end if;
  update public.insights_media_assets set public_artifact_status = 'removed', updated_at = now()
  where revision_id = p_revision_id and public_artifact_status = 'ready';
end;
$$;

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
  restored_id uuid;
  next_revision integer;
begin
  if not public.cms_can_restore_insights() then raise exception 'Only the owner can restore Insights'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  select * into source_revision from public.insights_article_revisions where id = p_source_revision_id and article_id = article.id and status in ('published', 'archived') for update;
  if source_revision.id is null then raise exception 'That historical Insight revision cannot be restored'; end if;
  if article.active_revision_id is not null then
    select * into active_revision from public.insights_article_revisions where id = article.active_revision_id for update;
    if active_revision.status in ('draft', 'review') then update public.insights_article_revisions set status = 'archived', updated_at = now() where id = active_revision.id; end if;
  end if;
  select coalesce(max(revision_number), 0) + 1 into next_revision from public.insights_article_revisions where article_id = article.id;
  insert into public.insights_article_revisions (article_id, revision_number, status, title, excerpt, body, primary_category_id, cover_media_id, created_by)
  values (article.id, next_revision, 'draft', source_revision.title, source_revision.excerpt, source_revision.body, source_revision.primary_category_id, source_revision.cover_media_id, auth.uid()) returning id into restored_id;
  insert into public.insights_article_revision_tags (revision_id, tag_id) select restored_id, tag_id from public.insights_article_revision_tags where revision_id = source_revision.id;
  insert into public.insights_revision_media (revision_id, media_id, role) select restored_id, media_id, role from public.insights_revision_media where revision_id = source_revision.id;
  update public.insights_articles set active_revision_id = restored_id, status = 'draft', updated_at = now() where id = article.id;
  perform public.insights_write_audit(article.id, restored_id, 'restored', article.status, 'draft', jsonb_build_object('source_revision_id', source_revision.id));
  return restored_id;
end;
$$;

revoke all on function public.insights_body_contains_text(jsonb) from public;
revoke all on function public.insights_body_media_ids(jsonb) from public;
revoke all on function public.insights_body_media_is_valid(uuid, jsonb) from public;
revoke all on function public.insights_revision_is_publishable(uuid) from public;
revoke all on function public.insights_sanitize_public_node(uuid, jsonb) from public;
revoke all on function public.insights_sanitize_public_body(uuid, jsonb) from public;
revoke all on function public.insights_is_public_media_path(text) from public;
revoke all on function public.insights_register_media(uuid, uuid, timestamptz, text, text, text, integer, integer, integer, integer, text, text) from public;
revoke all on function public.insights_remove_media(uuid, timestamptz, uuid) from public;
revoke all on function public.insights_update_media_alt(uuid, timestamptz, uuid, text) from public;
revoke all on function public.insights_save_draft(uuid, timestamptz, text, text, jsonb, uuid, uuid[], uuid) from public;
revoke all on function public.insights_submit_for_review(uuid, timestamptz) from public;
revoke all on function public.insights_publish_article(uuid, timestamptz, jsonb) from public;
revoke all on function public.insights_unpublish_article(uuid, timestamptz) from public;
revoke all on function public.insights_mark_media_artifacts_removed(uuid) from public;
revoke all on function public.insights_restore_revision(uuid, uuid) from public;
grant execute on function public.insights_register_media(uuid, uuid, timestamptz, text, text, text, integer, integer, integer, integer, text, text) to authenticated;
grant execute on function public.insights_remove_media(uuid, timestamptz, uuid) to authenticated;
grant execute on function public.insights_update_media_alt(uuid, timestamptz, uuid, text) to authenticated;
grant execute on function public.insights_save_draft(uuid, timestamptz, text, text, jsonb, uuid, uuid[], uuid) to authenticated;
grant execute on function public.insights_submit_for_review(uuid, timestamptz) to authenticated;
grant execute on function public.insights_publish_article(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.insights_unpublish_article(uuid, timestamptz) to authenticated;
grant execute on function public.insights_mark_media_artifacts_removed(uuid) to authenticated;
grant execute on function public.insights_restore_revision(uuid, uuid) to authenticated;

drop view if exists public.insights_published_articles;
create view public.insights_published_articles
with (security_invoker = true)
as
select article_id, slug, revision_id, title, excerpt, body, author_display_name,
  category_name, category_slug, tags, published_at, cover_image_path, cover_image_alt
from public.insights_public_articles;

revoke all on public.insights_published_articles from public, anon, authenticated;
grant select on public.insights_published_articles to anon, authenticated;

comment on table public.insights_media_assets is
  'Insights-specific immutable canonical media metadata. Private WebP objects survive publication, unpublish, history, and restore.';
comment on table public.insights_revision_media is
  'Revision-scoped media associations. A revision renders the exact cover and inline media identities it references.';
comment on column public.insights_public_articles.cover_image_path is
  'Stable public Published artifact path only; never a private canonical path or signed URL.';

commit;
