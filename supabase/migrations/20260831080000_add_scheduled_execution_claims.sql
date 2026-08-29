-- OCSCO Project ZERO — Scheduled Publishing v1, Step 3.
-- Add only a short-lived claim/lease and a protected manual execution path.
-- No recurring trigger, queue, worker, or scheduler is enabled here.

alter table public.insights_articles
  add column if not exists scheduler_claim_token uuid,
  add column if not exists scheduler_claim_expires_at timestamptz;

create index if not exists insights_articles_scheduler_due_claim_idx
  on public.insights_articles(scheduled_publish_at, scheduler_claim_expires_at, updated_at)
  where status = 'scheduled' and scheduled_publish_at is not null;

create or replace function public.insights_clear_scheduler_claim_on_manual_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'scheduled'
    and (new.status is distinct from old.status or new.scheduled_publish_at is distinct from old.scheduled_publish_at) then
    new.scheduler_claim_token := null;
    new.scheduler_claim_expires_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists insights_clear_scheduler_claim_on_manual_change on public.insights_articles;
create trigger insights_clear_scheduler_claim_on_manual_change
before update on public.insights_articles
for each row execute function public.insights_clear_scheduler_claim_on_manual_change();

create or replace function public.insights_claim_due_scheduled_article(
  p_claim_token uuid,
  p_lease_seconds integer default 120
)
returns table (
  article_id uuid,
  revision_id uuid,
  scheduled_publish_at timestamptz,
  claim_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate record;
  expires_at timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Scheduler execution requires the service role';
  end if;
  if p_claim_token is null then
    raise exception 'Scheduler claim token is required';
  end if;

  with due_article as (
    select article.id, article.active_revision_id, article.scheduled_publish_at
    from public.insights_articles as article
    where article.status = 'scheduled'
      and article.scheduled_publish_at is not null
      and article.scheduled_publish_at <= now()
      and (article.scheduler_claim_expires_at is null or article.scheduler_claim_expires_at <= now())
    order by article.scheduled_publish_at, article.updated_at, article.id
    for update skip locked
    limit 1
  )
  select * into candidate from due_article;

  if not found then
    return;
  end if;

  expires_at := now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 120), 300)));
  update public.insights_articles
  set scheduler_claim_token = p_claim_token,
      scheduler_claim_expires_at = expires_at
  where id = candidate.id;

  return query select candidate.id, candidate.active_revision_id, candidate.scheduled_publish_at, expires_at;
end;
$$;

create or replace function public.insights_release_scheduled_claim(
  p_article_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Scheduler execution requires the service role';
  end if;
  update public.insights_articles
  set scheduler_claim_token = null,
      scheduler_claim_expires_at = null
  where id = p_article_id
    and scheduler_claim_token = p_claim_token;
  return found;
end;
$$;

-- One shared publication implementation serves both the existing manual RPC and
-- the scheduler RPC. The scheduler branch adds its claim, due-time, status, and
-- active-reviewed-revision checks before entering the same artifact/projection
-- boundary used by manual publishing.
create or replace function public.insights_finalize_article_publication(
  p_article_id uuid,
  p_expected_updated_at timestamptz,
  p_public_media jsonb,
  p_expected_revision_id uuid default null,
  p_scheduler_claim_token uuid default null
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
  if p_scheduler_claim_token is null then
    if not public.cms_can_publish_insights() then raise exception 'This member cannot publish Insights'; end if;
  elsif auth.role() <> 'service_role' then
    raise exception 'Scheduler execution requires the service role';
  end if;

  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before publishing';
  end if;

  if p_scheduler_claim_token is not null then
    if article.status <> 'scheduled' then raise exception 'The Scheduled article is no longer eligible'; end if;
    if article.scheduled_publish_at is null or article.scheduled_publish_at > now() then
      raise exception 'The Scheduled article is not due';
    end if;
    if article.scheduler_claim_token is distinct from p_scheduler_claim_token
      or article.scheduler_claim_expires_at is null
      or article.scheduler_claim_expires_at <= now() then
      raise exception 'The scheduler claim is no longer valid';
    end if;
    if p_expected_revision_id is null or article.active_revision_id is distinct from p_expected_revision_id then
      raise exception 'The Scheduled article revision changed';
    end if;
  else
    if public.cms_current_role() <> 'owner' and article.author_id <> auth.uid() then
      raise exception 'Trusted Publishers may only publish their own Insight articles';
    end if;
    if public.cms_current_role() <> 'owner' and article.status <> 'draft' then
      raise exception 'Trusted Publishers may only publish their own Draft';
    end if;
    if public.cms_current_role() = 'owner' and article.status not in ('draft', 'review', 'scheduled') then
      raise exception 'Only a Draft, Review, or Scheduled article can be published';
    end if;
  end if;

  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status not in ('draft', 'review') then raise exception 'The active revision cannot be published'; end if;
  if p_scheduler_claim_token is not null and revision.status <> 'review' then
    raise exception 'The Scheduled article revision is no longer a Review';
  end if;
  if not public.insights_revision_is_publishable(revision.id) then
    raise exception 'Add a valid Title, Body, Category, Cover, and image alternative text before Publish';
  end if;
  if jsonb_typeof(p_public_media) <> 'object' or jsonb_typeof(p_public_media->'cover') <> 'object' or jsonb_typeof(p_public_media->'inline') <> 'array' then
    raise exception 'Published media artifacts are incomplete';
  end if;
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
  update public.insights_articles set status = 'published', scheduled_publish_at = null, scheduler_claim_token = null, scheduler_claim_expires_at = null, active_revision_id = revision.id, published_revision_id = revision.id, last_published_revision_id = revision.id, published_at = now(), unpublished_at = null, updated_at = now() where id = article.id;
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
  perform public.insights_write_audit(
    article.id,
    revision.id,
    case when previous_revision_id is null then 'published' else 'republished' end,
    article.status,
    'published',
    case when p_scheduler_claim_token is null then jsonb_build_object('previous_revision_id', previous_revision_id) else jsonb_build_object('previous_revision_id', previous_revision_id, 'execution', 'scheduled') end
  );
  return revision.id;
end;
$$;

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
begin
  return public.insights_finalize_article_publication(p_article_id, p_expected_updated_at, p_public_media);
end;
$$;

create or replace function public.insights_publish_scheduled_article(
  p_article_id uuid,
  p_claim_token uuid,
  p_expected_revision_id uuid,
  p_public_media jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Scheduler execution requires the service role';
  end if;
  return public.insights_finalize_article_publication(p_article_id, null, p_public_media, p_expected_revision_id, p_claim_token);
end;
$$;

revoke all on function public.insights_claim_due_scheduled_article(uuid, integer) from public;
revoke all on function public.insights_release_scheduled_claim(uuid, uuid) from public;
revoke all on function public.insights_finalize_article_publication(uuid, timestamptz, jsonb, uuid, uuid) from public;
revoke all on function public.insights_publish_article(uuid, timestamptz, jsonb) from public;
revoke all on function public.insights_publish_scheduled_article(uuid, uuid, uuid, jsonb) from public;
grant execute on function public.insights_claim_due_scheduled_article(uuid, integer) to service_role;
grant execute on function public.insights_release_scheduled_claim(uuid, uuid) to service_role;
grant execute on function public.insights_publish_scheduled_article(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.insights_publish_article(uuid, timestamptz, jsonb) to authenticated;
