-- OCSCO Project ZERO — Batch 2B Scheduled Publishing v1, Step 1.
-- Add only the durable state contract and authenticated lifecycle actions.
-- Automatic execution, claims/leases, UI controls, and scheduler infrastructure
-- remain deferred to the separately approved execution step.

alter table public.insights_articles
  add column if not exists scheduled_publish_at timestamptz;

alter table public.insights_articles
  drop constraint if exists insights_articles_status_check;

alter table public.insights_articles
  add constraint insights_articles_status_check
  check (status in ('draft', 'review', 'scheduled', 'published', 'unpublished'));

create index if not exists insights_articles_scheduled_due_idx
  on public.insights_articles(scheduled_publish_at, updated_at)
  where status = 'scheduled' and scheduled_publish_at is not null;

alter table public.insights_workflow_audit_log
  drop constraint if exists insights_workflow_audit_log_action_check;

alter table public.insights_workflow_audit_log
  add constraint insights_workflow_audit_log_action_check
  check (action in (
    'created', 'submitted', 'withdrawn_to_draft', 'returned_to_draft',
    'published', 'unpublished', 'restored', 'republished',
    'scheduled', 'rescheduled', 'cancelled'
  ));

create or replace function public.insights_schedule_article(
  p_article_id uuid,
  p_scheduled_publish_at timestamptz,
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
  if not public.cms_can_publish_insights() then
    raise exception 'This member cannot schedule Insights';
  end if;
  if public.cms_current_role() <> 'owner' then
    raise exception 'Only the owner can schedule a Review';
  end if;
  if p_scheduled_publish_at is null or p_scheduled_publish_at <= now() then
    raise exception 'Scheduled publication time must be in the future';
  end if;

  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before scheduling';
  end if;
  if article.status <> 'review' then raise exception 'Only a Review can be scheduled'; end if;

  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status <> 'review' then raise exception 'The active Review revision is missing'; end if;
  if not public.insights_revision_is_publishable(revision.id) then raise exception 'The active Review is not publishable'; end if;

  update public.insights_articles
  set status = 'scheduled', scheduled_publish_at = p_scheduled_publish_at, updated_at = now()
  where id = article.id;
  perform public.insights_write_audit(
    article.id, revision.id, 'scheduled', 'review', 'scheduled',
    jsonb_build_object('scheduled_publish_at', p_scheduled_publish_at)
  );
  return revision.id;
end;
$$;

create or replace function public.insights_reschedule_article(
  p_article_id uuid,
  p_scheduled_publish_at timestamptz,
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
  if not public.cms_can_publish_insights() then
    raise exception 'This member cannot reschedule Insights';
  end if;
  if public.cms_current_role() <> 'owner' then
    raise exception 'Only the owner can reschedule a Scheduled article';
  end if;
  if p_scheduled_publish_at is null or p_scheduled_publish_at <= now() then
    raise exception 'Scheduled publication time must be in the future';
  end if;

  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before rescheduling';
  end if;
  if article.status <> 'scheduled' then raise exception 'Only a Scheduled article can be rescheduled'; end if;

  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status <> 'review' then raise exception 'The scheduled Review revision is missing'; end if;
  if not public.insights_revision_is_publishable(revision.id) then raise exception 'The scheduled Review is no longer publishable'; end if;

  update public.insights_articles
  set scheduled_publish_at = p_scheduled_publish_at, updated_at = now()
  where id = article.id;
  perform public.insights_write_audit(
    article.id, revision.id, 'rescheduled', 'scheduled', 'scheduled',
    jsonb_build_object('scheduled_publish_at', p_scheduled_publish_at)
  );
  return revision.id;
end;
$$;

create or replace function public.insights_cancel_scheduled_article(
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
  if not public.cms_can_publish_insights() then
    raise exception 'This member cannot cancel an Insights schedule';
  end if;
  if public.cms_current_role() <> 'owner' then
    raise exception 'Only the owner can cancel an Insights schedule';
  end if;

  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before cancelling';
  end if;
  if article.status <> 'scheduled' then raise exception 'Only a Scheduled article can be cancelled'; end if;

  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status <> 'review' then raise exception 'The scheduled Review revision is missing'; end if;

  update public.insights_articles
  set status = 'review', scheduled_publish_at = null, updated_at = now()
  where id = article.id;
  perform public.insights_write_audit(article.id, revision.id, 'cancelled', 'scheduled', 'review');
  return revision.id;
end;
$$;

-- Keep the existing publication path authoritative. The only compatibility
-- change is allowing an Owner to publish a Scheduled reviewed revision now;
-- public media preparation and validation remain unchanged.
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
  if public.cms_current_role() = 'owner' and article.status not in ('draft', 'review', 'scheduled') then raise exception 'Only a Draft, Review, or Scheduled article can be published'; end if;
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
  update public.insights_articles set status = 'published', scheduled_publish_at = null, active_revision_id = revision.id, published_revision_id = revision.id, last_published_revision_id = revision.id, published_at = now(), unpublished_at = null, updated_at = now() where id = article.id;
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

revoke all on function public.insights_schedule_article(uuid, timestamptz, timestamptz) from public;
revoke all on function public.insights_reschedule_article(uuid, timestamptz, timestamptz) from public;
revoke all on function public.insights_cancel_scheduled_article(uuid, timestamptz) from public;
revoke all on function public.insights_publish_article(uuid, timestamptz, jsonb) from public;
grant execute on function public.insights_schedule_article(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.insights_reschedule_article(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.insights_cancel_scheduled_article(uuid, timestamptz) to authenticated;
grant execute on function public.insights_publish_article(uuid, timestamptz, jsonb) to authenticated;
