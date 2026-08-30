-- OCSCO Project Crimson — Batch 4A1 Design Settings v1 storage contract.
-- Additive staging/Production-compatible schema change. No CMS controls or
-- public CSS application are introduced by this migration.

begin;

alter table public.site_settings
  add column if not exists design_settings jsonb not null default '{
    "version": 1,
    "colors": {
      "ink": "#0a0a0a",
      "graphite": "#1a1a1a",
      "green": "#00c853",
      "white": "#ffffff",
      "snow": "#f7f7f7",
      "muted": "#9e9e9e",
      "border": "#e8e8e8",
      "copy": "#505050"
    }
  }'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.site_settings'::regclass
      and conname = 'site_settings_design_settings_object_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_design_settings_object_check
      check (jsonb_typeof(design_settings) = 'object');
  end if;
end;
$$;

create or replace function public.cms_design_settings_v1_is_valid(p_design_settings jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  key_name text;
begin
  if jsonb_typeof(p_design_settings) <> 'object'
    or p_design_settings->>'version' <> '1'
    or jsonb_typeof(p_design_settings->'colors') <> 'object'
  then
    return false;
  end if;

  if (select count(*) from jsonb_object_keys(p_design_settings)) <> 2
    or (select count(*) from jsonb_object_keys(p_design_settings->'colors')) <> 8
  then
    return false;
  end if;

  for key_name in select jsonb_object_keys(p_design_settings->'colors') loop
    if key_name not in ('ink', 'graphite', 'green', 'white', 'snow', 'muted', 'border', 'copy')
      or jsonb_typeof(p_design_settings->'colors'->key_name) <> 'string'
      or (p_design_settings->'colors'->>key_name) !~ '^#[0-9A-Fa-f]{6}$'
    then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.cms_design_settings_v1_is_valid(jsonb) from public;
grant execute on function public.cms_design_settings_v1_is_valid(jsonb) to authenticated;

-- The generic cms_save_revision path already serializes the complete
-- site_settings row and merges partial payloads. Replace only the current
-- authoritative publisher so a valid design_settings object is carried into
-- the singleton row while older revisions preserve the existing value.
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
  page_slug text;
  phase5_document boolean := false;
begin
  if not public.cms_has_role(array['owner']::text[]) then
    raise exception 'Only the owner can publish CMS revisions';
  end if;

  if exists (
    select 1
    from public.cms_revisions candidate
    join public.pages candidate_page
      on candidate_page.id::text = candidate.entity_key
    where candidate.id = p_revision_id
      and candidate.entity_type = 'page'
      and public.cms_page_document_is_target(candidate_page.slug)
  ) then
    raise exception 'PageDocument publication requires the dedicated Publish RPC';
  end if;

  select * into revision
  from public.cms_revisions
  where id = p_revision_id and status = 'review'
  for update;

  if revision.id is null then
    raise exception 'Only a review revision can be published';
  end if;

  if revision.entity_type = 'page' then
    entity_id := revision.entity_key::uuid;
    select slug into page_slug from public.pages where id = entity_id for update;
    if public.cms_page_document_is_target(page_slug) then
      raise exception 'PageDocument publication requires the dedicated Publish RPC';
    end if;
    if jsonb_typeof(revision.payload->'content') = 'object' then
      perform public.cms_validate_phase5_page_revision_payload(page_slug, revision.payload, true);
      phase5_document := true;
    elsif jsonb_typeof(revision.payload->'content') <> 'array' then
      raise exception 'Page revision content must be a legacy array or a complete PageDocument';
    end if;
  end if;

  if revision.entity_type = 'site_settings' then
    if revision.payload ? 'design_settings'
      and not public.cms_design_settings_v1_is_valid(revision.payload->'design_settings')
    then
      raise exception 'Design Settings must be a valid v1 document';
    end if;
    update public.site_settings
    set site_name = revision.payload->>'site_name',
        positioning_statement = nullif(revision.payload->>'positioning_statement', ''),
        default_seo_title = nullif(revision.payload->>'default_seo_title', ''),
        default_seo_description = nullif(revision.payload->>'default_seo_description', ''),
        default_og_image_path = nullif(revision.payload->>'default_og_image_path', ''),
        primary_contact_path = coalesce(nullif(revision.payload->>'primary_contact_path', ''), '/contact'),
        design_settings = coalesce(revision.payload->'design_settings', design_settings)
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
      delete from public.case_study_services where case_study_id = entity_id;
      insert into public.case_study_services (case_study_id, service_id)
      select entity_id, value::uuid
      from jsonb_array_elements_text(revision.payload->'service_ids') as item(value)
      where exists (
        select 1 from public.services
        where services.id = value::uuid and services.status = 'published'
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

commit;
