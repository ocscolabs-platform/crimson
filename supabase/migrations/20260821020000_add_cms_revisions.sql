-- OCSCO Project Crimson revision-based CMS publishing.
--
-- This migration is intentionally additive. Apply it only after the editor
-- code has been switched to the revision RPCs for every content type. Until
-- that rollout is complete, the existing staging editor and promotion bridge
-- remain the active write paths.

create table if not exists public.cms_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
    'site_settings',
    'navigation_item',
    'page',
    'page_section',
    'service',
    'case_study'
  )),
  entity_key text not null,
  status text not null check (status in ('draft', 'review', 'published', 'archived')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cms_revisions_entity_history_idx
  on public.cms_revisions(entity_type, entity_key, created_at desc);

create unique index if not exists cms_revisions_one_active_edit_idx
  on public.cms_revisions(entity_type, entity_key)
  where status in ('draft', 'review');

drop trigger if exists cms_revisions_set_updated_at on public.cms_revisions;
create trigger cms_revisions_set_updated_at
before update on public.cms_revisions
for each row execute function public.cms_set_updated_at();

alter table public.cms_revisions enable row level security;
revoke all on public.cms_revisions from anon, authenticated;
grant select on public.cms_revisions to authenticated;

drop policy if exists "cms members can read revisions" on public.cms_revisions;
create policy "cms members can read revisions"
  on public.cms_revisions for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

create or replace function public.cms_revision_entity_exists(
  p_entity_type text,
  p_entity_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_entity_type = 'site_settings' then
    return exists (select 1 from public.site_settings where id = p_entity_key);
  elsif p_entity_type = 'navigation_item' then
    return exists (select 1 from public.navigation_items where id = p_entity_key::uuid);
  elsif p_entity_type = 'page' then
    return exists (select 1 from public.pages where id = p_entity_key::uuid);
  elsif p_entity_type = 'page_section' then
    return exists (select 1 from public.page_sections where id = p_entity_key::uuid);
  elsif p_entity_type = 'service' then
    return exists (select 1 from public.services where id = p_entity_key::uuid);
  elsif p_entity_type = 'case_study' then
    return exists (select 1 from public.case_studies where id = p_entity_key::uuid);
  end if;

  return false;
exception
  when invalid_text_representation then
    return false;
end;
$$;

revoke all on function public.cms_revision_entity_exists(text, text) from public;
grant execute on function public.cms_revision_entity_exists(text, text) to authenticated;

create or replace function public.cms_save_revision(
  p_entity_type text,
  p_entity_key text,
  p_status text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  current_payload jsonb;
  merged_payload jsonb;
begin
  if not public.cms_has_role(array['owner', 'editor']::text[]) then
    raise exception 'Only owners and editors can save CMS revisions';
  end if;

  if p_status not in ('draft', 'review') then
    raise exception 'Revisions may only be saved as draft or review';
  end if;

  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Revision payload must be a JSON object';
  end if;

  if not public.cms_revision_entity_exists(p_entity_type, p_entity_key) then
    raise exception 'The CMS entity does not exist';
  end if;

  -- A partial payload is accepted so each editor can change only its own
  -- fields while preserving the rest of the current record.
  if p_entity_type = 'site_settings' then
    select to_jsonb(s) into current_payload
    from public.site_settings s where s.id = p_entity_key;
  elsif p_entity_type = 'navigation_item' then
    select to_jsonb(n) into current_payload
    from public.navigation_items n where n.id = p_entity_key::uuid;
  elsif p_entity_type = 'page' then
    select to_jsonb(p) into current_payload
    from public.pages p where p.id = p_entity_key::uuid;
  elsif p_entity_type = 'page_section' then
    select to_jsonb(ps) into current_payload
    from public.page_sections ps where ps.id = p_entity_key::uuid;
  elsif p_entity_type = 'service' then
    select to_jsonb(s) into current_payload
    from public.services s where s.id = p_entity_key::uuid;
  elsif p_entity_type = 'case_study' then
    select to_jsonb(c) into current_payload
    from public.case_studies c where c.id = p_entity_key::uuid;
  end if;

  merged_payload := coalesce(current_payload, '{}'::jsonb) || p_payload;
  merged_payload := jsonb_set(merged_payload, '{status}', to_jsonb(p_status), true);

  select id into existing_id
  from public.cms_revisions
  where entity_type = p_entity_type
    and entity_key = p_entity_key
    and status in ('draft', 'review')
  for update;

  if existing_id is null then
    insert into public.cms_revisions (entity_type, entity_key, status, payload, created_by)
    values (p_entity_type, p_entity_key, p_status, merged_payload, auth.uid())
    returning id into existing_id;
  else
    update public.cms_revisions
    set status = p_status,
        payload = merged_payload
    where id = existing_id;
  end if;

  return existing_id;
end;
$$;

revoke all on function public.cms_save_revision(text, text, text, jsonb) from public;
grant execute on function public.cms_save_revision(text, text, text, jsonb) to authenticated;

create or replace function public.cms_publish_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  revision public.cms_revisions%rowtype;
  entity_id uuid;
  entity_updated boolean;
begin
  if not public.cms_has_role(array['owner']::text[]) then
    raise exception 'Only the owner can publish CMS revisions';
  end if;

  select * into revision
  from public.cms_revisions
  where id = p_revision_id and status = 'review'
  for update;

  if revision.id is null then
    raise exception 'Only a review revision can be published';
  end if;

  if revision.entity_type = 'site_settings' then
    update public.site_settings
    set site_name = revision.payload->>'site_name',
        positioning_statement = nullif(revision.payload->>'positioning_statement', ''),
        default_seo_title = nullif(revision.payload->>'default_seo_title', ''),
        default_seo_description = nullif(revision.payload->>'default_seo_description', ''),
        default_og_image_path = nullif(revision.payload->>'default_og_image_path', ''),
        primary_contact_path = coalesce(nullif(revision.payload->>'primary_contact_path', ''), '/contact')
    where id = revision.entity_key;
    entity_updated := found;
  elsif revision.entity_type = 'navigation_item' then
    entity_id := revision.entity_key::uuid;
    update public.navigation_items
    set label = revision.payload->>'label',
        href = revision.payload->>'href',
        navigation_group = coalesce(revision.payload->>'navigation_group', navigation_group),
        sort_order = coalesce((revision.payload->>'sort_order')::integer, 0),
        is_visible = coalesce((revision.payload->>'is_visible')::boolean, true)
    where id = entity_id;
    entity_updated := found;
  elsif revision.entity_type = 'page_section' then
    entity_id := revision.entity_key::uuid;
    update public.page_sections
    set section_key = revision.payload->>'section_key',
        label = revision.payload->>'label',
        sort_order = coalesce((revision.payload->>'sort_order')::integer, 0),
        is_visible = coalesce((revision.payload->>'is_visible')::boolean, true)
    where id = entity_id;
    entity_updated := found;
  elsif revision.entity_type = 'service' then
    entity_id := revision.entity_key::uuid;
    update public.services
    set name = revision.payload->>'name',
        short_description = nullif(revision.payload->>'short_description', ''),
        detailed_description = nullif(revision.payload->>'detailed_description', ''),
        audience = nullif(revision.payload->>'audience', ''),
        deliverables = coalesce(revision.payload->'deliverables', '[]'::jsonb),
        process_summary = nullif(revision.payload->>'process_summary', ''),
        card_name = nullif(revision.payload->>'card_name', ''),
        outcome = nullif(revision.payload->>'outcome', ''),
        cta_label = nullif(revision.payload->>'cta_label', ''),
        cta_href = nullif(revision.payload->>'cta_href', ''),
        status = 'published',
        published_at = coalesce(published_at, now()),
        last_reviewed_at = now()
    where id = entity_id;
    entity_updated := found;
  elsif revision.entity_type = 'page' then
    entity_id := revision.entity_key::uuid;
    update public.pages
    set title = revision.payload->>'title',
        page_purpose = nullif(revision.payload->>'page_purpose', ''),
        audience = nullif(revision.payload->>'audience', ''),
        seo_title = nullif(revision.payload->>'seo_title', ''),
        seo_description = nullif(revision.payload->>'seo_description', ''),
        og_image_path = nullif(revision.payload->>'og_image_path', ''),
        content = coalesce(revision.payload->'content', '[]'::jsonb),
        cta_label = nullif(revision.payload->>'cta_label', ''),
        cta_href = nullif(revision.payload->>'cta_href', ''),
        status = 'published',
        published_at = coalesce(published_at, now()),
        last_reviewed_at = now()
    where id = entity_id;
    entity_updated := found;
  elsif revision.entity_type = 'case_study' then
    entity_id := revision.entity_key::uuid;
    update public.case_studies
    set project_name = revision.payload->>'project_name',
        client_visibility = coalesce(revision.payload->>'client_visibility', client_visibility),
        project_type = coalesce(revision.payload->>'project_type', project_type),
        project_category = nullif(revision.payload->>'project_category', ''),
        external_url = nullif(revision.payload->>'external_url', ''),
        is_featured = coalesce((revision.payload->>'is_featured')::boolean, false),
        sort_order = coalesce((revision.payload->>'sort_order')::integer, 0),
        summary = nullif(revision.payload->>'summary', ''),
        challenge = nullif(revision.payload->>'challenge', ''),
        approach = nullif(revision.payload->>'approach', ''),
        deliverables = coalesce(revision.payload->'deliverables', '[]'::jsonb),
        outcomes = coalesce(revision.payload->'outcomes', '[]'::jsonb),
        featured_image_path = nullif(revision.payload->>'featured_image_path', ''),
        featured_image_alt = nullif(revision.payload->>'featured_image_alt', ''),
        supporting_media = coalesce(revision.payload->'supporting_media', '[]'::jsonb),
        media_status = coalesce(revision.payload->>'media_status', media_status),
        media_reviewed_at = nullif(revision.payload->>'media_reviewed_at', '')::timestamptz,
        status = 'published',
        published_at = coalesce(published_at, now()),
        last_reviewed_at = now()
    where id = entity_id;
    entity_updated := found;

    if revision.payload ? 'service_ids' then
      delete from public.case_study_services
      where case_study_id = entity_id;

      insert into public.case_study_services (case_study_id, service_id)
      select entity_id, value::uuid
      from jsonb_array_elements_text(revision.payload->'service_ids') as item(value)
      where exists (
        select 1 from public.services
        where services.id = value::uuid
          and services.status = 'published'
      );
    end if;
  else
    raise exception 'Publishing is not wired for this content type yet';
  end if;

  if entity_updated is false or entity_updated is null then
    raise exception 'The CMS entity could not be published';
  end if;

  update public.cms_revisions
  set status = 'published', published_at = now()
  where id = revision.id;

  return revision.id;
end;
$$;

revoke all on function public.cms_publish_revision(uuid) from public;
grant execute on function public.cms_publish_revision(uuid) to authenticated;

create or replace function public.cms_restore_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  revision public.cms_revisions%rowtype;
begin
  if not public.cms_has_role(array['owner']::text[]) then
    raise exception 'Only the owner can restore CMS revisions';
  end if;

  select * into revision
  from public.cms_revisions
  where id = p_revision_id and status in ('published', 'archived')
  for update;

  if revision.id is null then
    raise exception 'That revision cannot be restored';
  end if;

  return public.cms_save_revision(
    revision.entity_type,
    revision.entity_key,
    'review',
    revision.payload
  );
end;
$$;

revoke all on function public.cms_restore_revision(uuid) from public;
grant execute on function public.cms_restore_revision(uuid) to authenticated;

comment on table public.cms_revisions is
  'Canonical CMS revision ledger. Draft and review edits are private; only an owner publish RPC changes public content.';
