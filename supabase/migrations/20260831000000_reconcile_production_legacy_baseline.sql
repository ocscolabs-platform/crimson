-- OCSCO Project Crimson — Migration #33
-- Filename/version: 20260831000000_reconcile_production_legacy_baseline.sql
-- Production legacy-baseline reconciliation / forward-only adoption.
--
-- This is a self-contained, fail-closed adoption migration. It is a no-op
-- against the canonical Phase 6 shape already present in staging. On the
-- audited legacy shape, it runs the validated Phase 5/6 contract bundle
-- against the existing rows, then locks direct client writes. Any unexpected
-- shape aborts before a mutation is attempted. It contains no environment
-- identifiers, account identifiers, or seed content.

begin;

do $phase6_guard$
declare
  canonical_shape boolean;
  audited_legacy_shape boolean;
  required_base boolean;
  invalid_pages integer;
begin
  canonical_shape :=
    to_regclass('public.insights_articles') is not null
    and to_regclass('public.insights_article_revisions') is not null
    and to_regclass('public.insights_public_articles') is not null
    and to_regclass('public.insights_media_assets') is not null
    and to_regclass('public.insights_revision_media') is not null
    and exists (
      select 1 from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname = 'insights_revision_is_publishable'
    )
    and exists (
      select 1 from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname = 'insights_restore_revision'
    )
    and exists (
      select 1 from storage.buckets
      where id = 'insights-private-media'
        and public = false
    )
    and exists (
      select 1 from storage.buckets
      where id = 'insights-published-media'
        and public = false
    );

  if canonical_shape then
    return;
  end if;

  required_base :=
    to_regclass('public.inquiries') is not null
    and to_regclass('public.pages') is not null
    and to_regclass('public.page_sections') is not null
    and to_regclass('public.services') is not null
    and to_regclass('public.case_studies') is not null
    and to_regclass('public.case_study_services') is not null
    and to_regclass('public.navigation_items') is not null
    and to_regclass('public.site_settings') is not null
    and to_regclass('public.cms_members') is not null
    and to_regclass('public.cms_revisions') is not null
    and to_regclass('public.cms_audit_log') is not null
    and to_regclass('public.cms_global_audit_log') is not null;

  audited_legacy_shape :=
    required_base
    and to_regclass('storage.buckets') is not null
    and not exists (
      select 1 from pg_attribute
      where attrelid = 'public.pages'::regclass
        and attname = 'published_revision_id'
        and not attisdropped
    )
    and not exists (
      select 1 from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname in (
          'cms_validate_phase5_page_document',
          'cms_page_document_publish',
          'cms_page_document_restore'
        )
    )
    and not exists (
      select 1 from pg_class
      where relnamespace = 'public'::regnamespace
        and relname like 'insights_%'
    )
    and not exists (
      select 1 from storage.buckets
      where id in ('insights-private-media', 'insights-published-media')
    );

  if not audited_legacy_shape then
    raise exception
      'Migration #33 refused: database is neither canonical Phase 6 nor the audited legacy baseline';
  end if;

  select count(*) into invalid_pages
  from public.pages
  where jsonb_typeof(content) is distinct from 'array';

  if invalid_pages <> 0 then
    raise exception
      'Migration #33 refused: % legacy page rows have incompatible content',
      invalid_pages;
  end if;

  if (select count(*) from public.pages) <> 5 then
    raise exception
      'Migration #33 refused: expected exactly five preserved legacy pages';
  end if;

  execute $phase6_reconciliation$
-- ===== adopted canonical 20260823000000_expand_pages_content_compatibility.sql =====
-- OCSCO Project Crimson Phase 5B Slice 1 compatibility foundation.
--
-- Expand-only change: retain legacy array content and permit future validated
-- PageDocument objects. Existing rows are intentionally not changed here.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pages'::regclass
      and conname = 'pages_content_check'
  ) then
    alter table public.pages drop constraint pages_content_check;
  end if;

  alter table public.pages
    add constraint pages_content_check
    check (jsonb_typeof(content) in ('array', 'object'));
end;
$$;


-- ===== adopted canonical 20260823010000_add_phase5b_slice2_rpc_compatibility.sql =====
-- OCSCO Project Crimson Phase 5B Slice 2.
--
-- Make the existing revision RPCs capable of handling complete Phase 5
-- PageDocuments without changing the current legacy page, page-section,
-- Services, case-study, relationship, or public-read paths.
--
-- New PageDocument revisions use cms_revisions.status as their only workflow
-- authority. Historical payloads, including legacy payload.status values, are
-- retained as compatibility data and are not rewritten.

create or replace function public.cms_phase5_require_string(
  p_value jsonb,
  p_path text,
  p_max_length integer
)
returns void
language plpgsql
immutable
as $$
declare
  value_text text;
begin
  if jsonb_typeof(p_value) <> 'string' then
    raise exception '% must be a string', p_path;
  end if;

  value_text := btrim(p_value #>> '{}');
  if value_text = '' then
    raise exception '% must not be empty', p_path;
  end if;
  if char_length(value_text) > p_max_length then
    raise exception '% exceeds % characters', p_path, p_max_length;
  end if;
  if value_text ~ '[<>]' then
    raise exception '% contains disallowed HTML-like markup', p_path;
  end if;
end;
$$;

create or replace function public.cms_phase5_require_optional_string(
  p_value jsonb,
  p_path text,
  p_max_length integer
)
returns void
language plpgsql
immutable
as $$
begin
  if p_value is not null then
    perform public.cms_phase5_require_string(p_value, p_path, p_max_length);
  end if;
end;
$$;

create or replace function public.cms_phase5_require_exact_keys(
  p_value jsonb,
  p_allowed_keys text[],
  p_path text
)
returns void
language plpgsql
immutable
as $$
declare
  key_name text;
begin
  if jsonb_typeof(p_value) <> 'object' then
    raise exception '% must be an object', p_path;
  end if;

  for key_name in select jsonb_object_keys(p_value)
  loop
    if not (key_name = any (p_allowed_keys)) then
      raise exception '% contains unknown field %', p_path, key_name;
    end if;
  end loop;
end;
$$;

create or replace function public.cms_phase5_validate_cta(
  p_value jsonb,
  p_path text
)
returns void
language plpgsql
immutable
as $$
declare
  cta_kind text;
  cta_href text;
begin
  perform public.cms_phase5_require_exact_keys(p_value, array['kind', 'label', 'href'], p_path);
  perform public.cms_phase5_require_string(p_value->'label', p_path || '.label', 80);

  cta_kind := p_value->>'kind';
  cta_href := p_value->>'href';
  if cta_kind = 'route' and cta_href in ('/', '/services', '/about', '/contact') then
    return;
  end if;
  if cta_kind = 'anchor' and cta_href in ('#contact', '#contact-form') then
    return;
  end if;

  raise exception '% has an unsupported CTA destination', p_path;
end;
$$;

create or replace function public.cms_phase5_validate_service_reference(
  p_value jsonb,
  p_path text
)
returns void
language plpgsql
immutable
as $$
begin
  perform public.cms_phase5_require_exact_keys(p_value, array['kind', 'slug'], p_path);
  if p_value->>'kind' <> 'service'
    or p_value->>'slug' not in (
      'branding',
      'website-design-development',
      'custom-cms',
      'crm-business-tools',
      'custom-web-applications'
    )
  then
    raise exception '% has an unsupported Service reference', p_path;
  end if;
end;
$$;

create or replace function public.cms_phase5_validate_text_items(
  p_value jsonb,
  p_path text
)
returns void
language plpgsql
immutable
as $$
declare
  item jsonb;
  item_index integer := 0;
begin
  if jsonb_typeof(p_value) <> 'array' then
    raise exception '% must contain exactly three items', p_path;
  end if;
  if jsonb_array_length(p_value) <> 3 then
    raise exception '% must contain exactly three items', p_path;
  end if;

  for item in select value from jsonb_array_elements(p_value)
  loop
    perform public.cms_phase5_require_exact_keys(item, array['title', 'body'], format('%s[%s]', p_path, item_index));
    perform public.cms_phase5_require_string(item->'title', format('%s[%s].title', p_path, item_index), 180);
    perform public.cms_phase5_require_string(item->'body', format('%s[%s].body', p_path, item_index), 2000);
    item_index := item_index + 1;
  end loop;
end;
$$;

create or replace function public.cms_phase5_validate_section_content(
  p_section_key text,
  p_value jsonb,
  p_path text
)
returns void
language plpgsql
immutable
as $$
declare
  item jsonb;
  item_index integer := 0;
  cta jsonb;
begin
  if jsonb_typeof(p_value) <> 'object' then
    raise exception '% must be an object', p_path;
  end if;

  case p_section_key
    when 'home_hero' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'title', 'intro', 'ctas'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'title', p_path || '.title', 180);
      perform public.cms_phase5_require_string(p_value->'intro', p_path || '.intro', 2000);
      if jsonb_typeof(p_value->'ctas') <> 'array' then
        raise exception '%.ctas must be an array', p_path;
      end if;
      if jsonb_array_length(p_value->'ctas') > 2 then
        raise exception '%.ctas must contain at most two CTAs', p_path;
      end if;
      for cta in select value from jsonb_array_elements(p_value->'ctas')
      loop
        perform public.cms_phase5_validate_cta(cta, format('%s.ctas[%s]', p_path, item_index));
        item_index := item_index + 1;
      end loop;

    when 'home_intro', 'home_proof' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'body'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'body', p_path || '.body', 2000);

    when 'home_capabilities' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'note', 'items'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'note', p_path || '.note', 2000);
      if jsonb_typeof(p_value->'items') <> 'array' then
        raise exception '%.items must be an array', p_path;
      end if;
      if jsonb_array_length(p_value->'items') <> 5 then
        raise exception '%.items must contain exactly five items', p_path;
      end if;
      for item in select value from jsonb_array_elements(p_value->'items')
      loop
        perform public.cms_phase5_require_exact_keys(item, array['service', 'ctaLabel'], format('%s.items[%s]', p_path, item_index));
        perform public.cms_phase5_validate_service_reference(item->'service', format('%s.items[%s].service', p_path, item_index));
        perform public.cms_phase5_require_string(item->'ctaLabel', format('%s.items[%s].ctaLabel', p_path, item_index), 80);
        item_index := item_index + 1;
      end loop;

    when 'home_approach', 'about_principles' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'items'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_validate_text_items(p_value->'items', p_path || '.items');

    when 'home_contact' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'body', 'cta'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'body', p_path || '.body', 2000);
      perform public.cms_phase5_validate_cta(p_value->'cta', p_path || '.cta');

    when 'services_hero', 'about_hero', 'contact_hero' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'title', 'intro'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'title', p_path || '.title', 180);
      perform public.cms_phase5_require_string(p_value->'intro', p_path || '.intro', 2000);

    when 'services_capabilities' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'note'], p_path);
      perform public.cms_phase5_require_optional_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_optional_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_optional_string(p_value->'note', p_path || '.note', 2000);

    when 'about_people' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'body', 'cta'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'body', p_path || '.body', 2000);
      perform public.cms_phase5_validate_cta(p_value->'cta', p_path || '.cta');

    when 'contact_process' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'items', 'cta'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_validate_text_items(p_value->'items', p_path || '.items');
      perform public.cms_phase5_validate_cta(p_value->'cta', p_path || '.cta');

    when 'contact_form' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'intro'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'intro', p_path || '.intro', 2000);

    else
      raise exception 'Unknown Phase 5 section key %', p_section_key;
  end case;
end;
$$;

create or replace function public.cms_validate_phase5_page_document(
  p_page_key text,
  p_content jsonb,
  p_require_published_services boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_keys text[];
  required_keys text[];
  section jsonb;
  section_key text;
  section_index integer := 0;
  first_enabled_key text;
  last_enabled_key text;
  hero_order numeric;
  section_order numeric;
  service_item jsonb;
  service_slug text;
begin
  if p_page_key not in ('home', 'services', 'about', 'contact') then
    raise exception 'PageDocument pageKey % is not a registered Phase 5 page', p_page_key;
  end if;
  if jsonb_typeof(p_content) <> 'object' then
    raise exception 'PageDocument content must be an object';
  end if;

  perform public.cms_phase5_require_exact_keys(
    p_content,
    array['schemaVersion', 'pageKey', 'seo', 'sections'],
    'content'
  );
  if jsonb_typeof(p_content->'schemaVersion') <> 'number' or p_content->>'schemaVersion' <> '1' then
    raise exception 'content.schemaVersion must equal numeric version 1';
  end if;
  if jsonb_typeof(p_content->'pageKey') <> 'string' or p_content->>'pageKey' <> p_page_key then
    raise exception 'content.pageKey must match the target page';
  end if;

  perform public.cms_phase5_require_exact_keys(
    p_content->'seo',
    array['title', 'description', 'ogTitle', 'ogDescription', 'ogImageRef'],
    'content.seo'
  );
  perform public.cms_phase5_require_string(p_content->'seo'->'title', 'content.seo.title', 70);
  perform public.cms_phase5_require_string(p_content->'seo'->'description', 'content.seo.description', 160);
  perform public.cms_phase5_require_optional_string(p_content->'seo'->'ogTitle', 'content.seo.ogTitle', 70);
  perform public.cms_phase5_require_optional_string(p_content->'seo'->'ogDescription', 'content.seo.ogDescription', 160);
  if p_content->'seo' ? 'ogImageRef' then
    perform public.cms_phase5_require_exact_keys(
      p_content->'seo'->'ogImageRef',
      array['kind', 'key'],
      'content.seo.ogImageRef'
    );
    if p_content->'seo'->'ogImageRef'->>'kind' <> 'generated'
      or p_content->'seo'->'ogImageRef'->>'key' <> 'default'
    then
      raise exception 'content.seo.ogImageRef must be the generated/default reference';
    end if;
  end if;

  if p_page_key = 'home' then
    allowed_keys := array['home_hero', 'home_intro', 'home_capabilities', 'home_approach', 'home_proof', 'home_contact'];
    required_keys := array['home_hero', 'home_intro', 'home_capabilities', 'home_approach', 'home_contact'];
  elsif p_page_key = 'services' then
    allowed_keys := array['services_hero', 'services_capabilities'];
    required_keys := array['services_hero', 'services_capabilities'];
  elsif p_page_key = 'about' then
    allowed_keys := array['about_hero', 'about_principles', 'about_people'];
    required_keys := array['about_hero', 'about_principles'];
  else
    allowed_keys := array['contact_hero', 'contact_process', 'contact_form'];
    required_keys := array['contact_hero', 'contact_process', 'contact_form'];
  end if;

  if jsonb_typeof(p_content->'sections') <> 'array' then
    raise exception 'content.sections must be an array';
  end if;

  for section in select value from jsonb_array_elements(p_content->'sections')
  loop
    perform public.cms_phase5_require_exact_keys(
      section,
      array['key', 'enabled', 'order', 'content'],
      format('content.sections[%s]', section_index)
    );
    if jsonb_typeof(section->'key') <> 'string' then
      raise exception 'content.sections[%s].key must be a string', section_index;
    end if;
    section_key := section->>'key';
    if not (section_key = any (allowed_keys)) then
      raise exception 'Section % is not allowed on Phase 5 page %', section_key, p_page_key;
    end if;
    if jsonb_typeof(section->'enabled') <> 'boolean' then
      raise exception 'content.sections[%s].enabled must be boolean', section_index;
    end if;
    if jsonb_typeof(section->'order') <> 'number' then
      raise exception 'content.sections[%s].order must be numeric', section_index;
    end if;
    section_order := (section->>'order')::numeric;
    if section_order <> trunc(section_order) or section_order < 0 then
      raise exception 'content.sections[%s].order must be a non-negative integer', section_index;
    end if;
    perform public.cms_phase5_validate_section_content(
      section_key,
      section->'content',
      format('content.sections[%s].content', section_index)
    );
    section_index := section_index + 1;
  end loop;

  if jsonb_array_length(p_content->'sections') <> (
    select count(distinct value->>'key') from jsonb_array_elements(p_content->'sections') as entries(value)
  ) then
    raise exception 'content.sections must not contain duplicate section keys';
  end if;
  if jsonb_array_length(p_content->'sections') <> (
    select count(distinct (value->>'order')::numeric) from jsonb_array_elements(p_content->'sections') as entries(value)
  ) then
    raise exception 'content.sections must not contain duplicate order values';
  end if;

  foreach section_key in array required_keys
  loop
    if not exists (
      select 1
      from jsonb_array_elements(p_content->'sections') as entries(value)
      where value->>'key' = section_key
        and value->>'enabled' = 'true'
    ) then
      raise exception 'Required section % must exist and be enabled', section_key;
    end if;
  end loop;

  select value->>'key' into first_enabled_key
  from jsonb_array_elements(p_content->'sections') as entries(value)
  where value->>'enabled' = 'true'
  order by (value->>'order')::numeric
  limit 1;
  if first_enabled_key <> (p_page_key || '_hero') then
    raise exception 'The hero section must be first and enabled';
  end if;

  select value->>'key' into last_enabled_key
  from jsonb_array_elements(p_content->'sections') as entries(value)
  where value->>'enabled' = 'true'
  order by (value->>'order')::numeric desc
  limit 1;
  if p_page_key = 'home' and last_enabled_key <> 'home_contact' then
    raise exception 'home_contact must be the last enabled section';
  elsif p_page_key = 'services' and last_enabled_key <> 'services_capabilities' then
    raise exception 'services_capabilities must be the last enabled section';
  elsif p_page_key = 'contact' and last_enabled_key <> 'contact_form' then
    raise exception 'contact_form must be the last enabled section';
  elsif p_page_key = 'about'
    and exists (
      select 1 from jsonb_array_elements(p_content->'sections') as entries(value)
      where value->>'key' = 'about_people' and value->>'enabled' = 'true'
    )
    and last_enabled_key <> 'about_people'
  then
    raise exception 'about_people must be the last enabled section when present';
  end if;

  select (value->>'order')::numeric into hero_order
  from jsonb_array_elements(p_content->'sections') as entries(value)
  where value->>'key' = p_page_key || '_hero';
  for section in select value from jsonb_array_elements(p_content->'sections')
  loop
    section_key := section->>'key';
    section_order := (section->>'order')::numeric;
    if section_key in ('services_capabilities', 'about_principles', 'contact_process')
      and section_order <= hero_order
    then
      raise exception 'Section % must follow the hero', section_key;
    end if;
  end loop;

  if p_require_published_services and p_page_key = 'home' then
    for service_item in
      select item
      from jsonb_array_elements(p_content->'sections') as entries(value)
      cross join lateral jsonb_array_elements(entries.value->'content'->'items') as items(item)
      where entries.value->>'key' = 'home_capabilities'
    loop
      service_slug := service_item->'service'->>'slug';
      if not exists (
        select 1
        from public.services
        where slug = service_slug
          and status = 'published'
          and published_at is not null
          and published_at <= now()
      ) then
        raise exception 'Referenced Service % must exist and be Published before PageDocument publication', service_slug;
      end if;
    end loop;
  end if;
end;
$$;

create or replace function public.cms_validate_phase5_page_revision_payload(
  p_page_key text,
  p_payload jsonb,
  p_require_published_services boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cms_phase5_require_exact_keys(
    p_payload,
    array['title', 'page_purpose', 'audience', 'content'],
    'page revision payload'
  );
  perform public.cms_phase5_require_string(p_payload->'title', 'page revision payload.title', 180);
  if p_payload->'page_purpose' is not null and jsonb_typeof(p_payload->'page_purpose') <> 'null' then
    perform public.cms_phase5_require_string(p_payload->'page_purpose', 'page revision payload.page_purpose', 2000);
  end if;
  if p_payload->'audience' is not null and jsonb_typeof(p_payload->'audience') <> 'null' then
    perform public.cms_phase5_require_string(p_payload->'audience', 'page revision payload.audience', 2000);
  end if;
  if jsonb_typeof(p_payload->'content') <> 'object' then
    raise exception 'Phase 5 page revisions require complete PageDocument content';
  end if;
  perform public.cms_validate_phase5_page_document(
    p_page_key,
    p_payload->'content',
    p_require_published_services
  );
end;
$$;

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
  existing_payload jsonb;
  merged_payload jsonb;
  page_slug text;
  phase5_document boolean := false;
  current_content jsonb;
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

  select id, payload into existing_id, existing_payload
  from public.cms_revisions
  where entity_type = p_entity_type
    and entity_key = p_entity_key
    and status in ('draft', 'review')
  for update;

  if p_entity_type = 'site_settings' then
    select to_jsonb(s) into current_payload
    from public.site_settings s where s.id = p_entity_key;
  elsif p_entity_type = 'navigation_item' then
    select to_jsonb(n) into current_payload
    from public.navigation_items n where n.id = p_entity_key::uuid;
  elsif p_entity_type = 'page' then
    select to_jsonb(p), slug into current_payload, page_slug
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

  if p_entity_type = 'page' then
    current_content := coalesce(existing_payload->'content', current_payload->'content');
    if jsonb_typeof(p_payload->'content') = 'object' then
      if p_payload ? 'status' then
        raise exception 'PageDocument revisions use cms_revisions.status; payload.status is not allowed';
      end if;
      perform public.cms_validate_phase5_page_revision_payload(page_slug, p_payload, false);
      phase5_document := true;
    elsif p_payload ? 'content' and jsonb_typeof(p_payload->'content') <> 'array' then
      raise exception 'Legacy page revisions require array content';
    elsif jsonb_typeof(current_content) = 'object' then
      raise exception 'A complete PageDocument is required for a PageDocument page revision';
    end if;
  end if;

  if phase5_document then
    -- A complete PageDocument is replaced atomically. Do not inherit legacy
    -- SEO, CTA, or payload.status fields into the future revision contract.
    merged_payload := jsonb_build_object(
      'title', p_payload->'title',
      'page_purpose', p_payload->'page_purpose',
      'audience', p_payload->'audience',
      'content', p_payload->'content'
    );
  else
    -- Preserve the existing partial-merge behavior for every legacy entity
    -- type, including legacy array-valued page revisions.
    merged_payload := coalesce(current_payload, '{}'::jsonb);
    if existing_payload is not null then
      merged_payload := merged_payload || existing_payload;
    end if;
    merged_payload := merged_payload || p_payload;
    merged_payload := jsonb_set(merged_payload, '{status}', to_jsonb(p_status), true);
  end if;

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
    if jsonb_typeof(revision.payload->'content') = 'object' then
      perform public.cms_validate_phase5_page_revision_payload(
        page_slug,
        revision.payload,
        true
      );
      phase5_document := true;
    elsif jsonb_typeof(revision.payload->'content') <> 'array' then
      raise exception 'Page revision content must be a legacy array or a complete PageDocument';
    end if;
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
  elsif revision.entity_type = 'page' and phase5_document then
    -- PageDocument publication is atomic and does not publish page_sections.
    -- Its SEO fields are compatibility projections from the document.
    update public.pages
    set title = revision.payload->>'title',
        page_purpose = nullif(revision.payload->>'page_purpose', ''),
        audience = nullif(revision.payload->>'audience', ''),
        seo_title = revision.payload->'content'->'seo'->>'title',
        seo_description = revision.payload->'content'->'seo'->>'description',
        og_image_path = case
          when revision.payload->'content'->'seo'->'ogImageRef'->>'kind' = 'generated'
            and revision.payload->'content'->'seo'->'ogImageRef'->>'key' = 'default'
          then '/opengraph-image'
          else null
        end,
        content = revision.payload->'content',
        cta_label = null,
        cta_href = null,
        status = 'published',
        published_at = coalesce(published_at, now()),
        last_reviewed_at = now()
    where id = entity_id;
    entity_updated := found;
  elsif revision.entity_type = 'page' then
    -- Current page rows remain legacy arrays until the later cutover.
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

create or replace function public.cms_restore_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  revision public.cms_revisions%rowtype;
  restore_payload jsonb;
  page_slug text;
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

  restore_payload := revision.payload;
  if revision.entity_type = 'page' and jsonb_typeof(revision.payload->'content') = 'object' then
    select slug into page_slug
    from public.pages
    where id = revision.entity_key::uuid;
    -- Historical revisions may have the old compatibility payload.status.
    -- Strip it only from the new Review copy; the historical row is untouched.
    restore_payload := revision.payload - 'status';
    perform public.cms_validate_phase5_page_revision_payload(page_slug, restore_payload, false);
  end if;

  return public.cms_save_revision(
    revision.entity_type,
    revision.entity_key,
    'review',
    restore_payload
  );
end;
$$;

revoke all on function public.cms_phase5_require_string(jsonb, text, integer) from public;
revoke all on function public.cms_phase5_require_optional_string(jsonb, text, integer) from public;
revoke all on function public.cms_phase5_require_exact_keys(jsonb, text[], text) from public;
revoke all on function public.cms_phase5_validate_cta(jsonb, text) from public;
revoke all on function public.cms_phase5_validate_service_reference(jsonb, text) from public;
revoke all on function public.cms_phase5_validate_text_items(jsonb, text) from public;
revoke all on function public.cms_phase5_validate_section_content(text, jsonb, text) from public;
revoke all on function public.cms_validate_phase5_page_document(text, jsonb, boolean) from public;
revoke all on function public.cms_validate_phase5_page_revision_payload(text, jsonb, boolean) from public;

grant execute on function public.cms_save_revision(text, text, text, jsonb) to authenticated;
grant execute on function public.cms_publish_revision(uuid) to authenticated;
grant execute on function public.cms_restore_revision(uuid) to authenticated;

comment on function public.cms_validate_phase5_page_document(text, jsonb, boolean) is
  'Authoritative structural validation for future Phase 5 PageDocuments. It does not validate presentation rendering.';

comment on function public.cms_save_revision(text, text, text, jsonb) is
  'Saves legacy partial revisions or complete Phase 5 PageDocuments. Workflow authority is cms_revisions.status.';

comment on function public.cms_publish_revision(uuid) is
  'Owner-only atomic publication for legacy revisions and future validated PageDocuments. PageDocument SEO is projected transactionally.';

comment on function public.cms_restore_revision(uuid) is
  'Restores immutable history as Review. Valid PageDocuments are revalidated; legacy arrays remain legacy.';


-- ===== adopted canonical 20260823020000_align_phase5_page_document_contract.sql =====
-- Align the deployed Phase 5 validator with the approved PageDocument contract.
-- This is validation-only: it does not change rows, revisions, page_sections,
-- authorization, publication behavior, or legacy Work content.

create or replace function public.cms_phase5_validate_section_content(
  p_section_key text,
  p_value jsonb,
  p_path text
)
returns void
language plpgsql
immutable
as $$
declare
  item jsonb;
  item_index integer := 0;
  cta jsonb;
begin
  if jsonb_typeof(p_value) <> 'object' then
    raise exception '% must be an object', p_path;
  end if;

  case p_section_key
    when 'home_hero' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'title', 'intro', 'ctas'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'title', p_path || '.title', 180);
      perform public.cms_phase5_require_string(p_value->'intro', p_path || '.intro', 2000);
      if jsonb_typeof(p_value->'ctas') <> 'array' then
        raise exception '%.ctas must be an array', p_path;
      end if;
      if jsonb_array_length(p_value->'ctas') > 2 then
        raise exception '%.ctas must contain at most two CTAs', p_path;
      end if;
      for cta in select value from jsonb_array_elements(p_value->'ctas')
      loop
        perform public.cms_phase5_validate_cta(cta, format('%s.ctas[%s]', p_path, item_index));
        item_index := item_index + 1;
      end loop;

    when 'home_intro', 'home_proof' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'body'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'body', p_path || '.body', 2000);

    when 'home_capabilities' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'note', 'items'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'note', p_path || '.note', 2000);
      if jsonb_typeof(p_value->'items') <> 'array' then
        raise exception '%.items must be an array', p_path;
      end if;
      if jsonb_array_length(p_value->'items') <> 5 then
        raise exception '%.items must contain exactly five items', p_path;
      end if;
      for item in select value from jsonb_array_elements(p_value->'items')
      loop
        perform public.cms_phase5_require_exact_keys(item, array['service', 'ctaLabel'], format('%s.items[%s]', p_path, item_index));
        perform public.cms_phase5_validate_service_reference(item->'service', format('%s.items[%s].service', p_path, item_index));
        perform public.cms_phase5_require_string(item->'ctaLabel', format('%s.items[%s].ctaLabel', p_path, item_index), 80);
        item_index := item_index + 1;
      end loop;

    when 'home_approach', 'about_principles' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'items'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_validate_text_items(p_value->'items', p_path || '.items');

    when 'home_contact' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'body', 'cta'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'body', p_path || '.body', 2000);
      perform public.cms_phase5_validate_cta(p_value->'cta', p_path || '.cta');

    when 'services_hero', 'about_hero', 'contact_hero' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'title', 'intro'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'title', p_path || '.title', 180);
      perform public.cms_phase5_require_string(p_value->'intro', p_path || '.intro', 2000);

    when 'services_capabilities' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'note'], p_path);
      perform public.cms_phase5_require_optional_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_optional_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_optional_string(p_value->'note', p_path || '.note', 2000);

    when 'about_people' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'cta'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_validate_cta(p_value->'cta', p_path || '.cta');

    when 'contact_process' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'items', 'cta'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_validate_text_items(p_value->'items', p_path || '.items');
      perform public.cms_phase5_validate_cta(p_value->'cta', p_path || '.cta');

    when 'contact_form' then
      perform public.cms_phase5_require_exact_keys(p_value, array['eyebrow', 'heading', 'intro'], p_path);
      perform public.cms_phase5_require_string(p_value->'eyebrow', p_path || '.eyebrow', 80);
      perform public.cms_phase5_require_string(p_value->'heading', p_path || '.heading', 180);
      perform public.cms_phase5_require_string(p_value->'intro', p_path || '.intro', 2000);

    else
      raise exception 'Unknown Phase 5 section key %', p_section_key;
  end case;
end;
$$;


-- ===== adopted canonical 20260823030000_backfill_phase5_page_documents.sql =====
-- OCSCO Project Crimson Phase 5B Slice 3.
-- Backfill exactly Home, Services, About, and Contact into validated
-- PageDocuments. Work remains on the legacy array/page_sections path.
--
-- This migration is intentionally fail-closed. It captures the current
-- page_sections order/visibility, validates every generated document through
-- the deployed Phase 5 contract, preserves historical revisions, and freezes
-- only the migrated pages' legacy section mutation boundaries.

do $$
declare
  home_page public.pages%rowtype;
  services_page public.pages%rowtype;
  about_page public.pages%rowtype;
  contact_page public.pages%rowtype;
  home_body_sections jsonb;
  services_body_sections jsonb;
  about_body_sections jsonb;
  contact_body_sections jsonb;
  home_document jsonb;
  services_document jsonb;
  about_document jsonb;
  contact_document jsonb;
  section_mismatch boolean;
  service_count integer;
begin
  select * into strict home_page from public.pages where slug = 'home';
  select * into strict services_page from public.pages where slug = 'services';
  select * into strict about_page from public.pages where slug = 'about';
  select * into strict contact_page from public.pages where slug = 'contact';

  if exists (
    select 1
    from public.pages
    where slug in ('home', 'services', 'about', 'contact')
      and (
        coalesce(jsonb_typeof(content), 'missing') <> 'array'
        or case
          when jsonb_typeof(content) = 'array' then jsonb_array_length(content) <> 1
          else true
        end
        or jsonb_typeof(content->0) <> 'object'
        or not (content->0 ? 'eyebrow')
        or not (content->0 ? 'title')
        or not (content->0 ? 'intro')
      )
  ) then
    raise exception 'Phase 5 backfill requires exactly one legacy hero object per target page';
  end if;

  if exists (
    select 1
    from public.pages
    where slug in ('home', 'services', 'about', 'contact')
      and (status <> 'published' or published_at is null or published_at > now())
  ) then
    raise exception 'Phase 5 backfill requires all target pages to be currently Published';
  end if;

  if coalesce(
    jsonb_typeof((select content from public.pages where slug = 'work')),
    'missing'
  ) <> 'array' then
    raise exception 'Work must remain a legacy array during the Phase 5 backfill';
  end if;

  if exists (
    select 1
    from public.pages
    where slug in ('home', 'services', 'about', 'contact')
      and jsonb_typeof(content) = 'object'
  )
  or exists (
    select 1
    from public.cms_revisions revision
    join public.pages page
      on revision.entity_type = 'page'
     and revision.entity_key = page.id::text
    where page.slug in ('home', 'services', 'about', 'contact')
      and jsonb_typeof(revision.payload->'content') = 'object'
  ) then
    raise exception 'Phase 5 PageDocument content or snapshots already exist';
  end if;

  if exists (
    select 1
    from public.cms_revisions revision
    join public.page_sections section
      on revision.entity_type = 'page_section'
     and revision.entity_key = section.id::text
    join public.pages page on page.id = section.page_id
    where page.slug in ('home', 'services', 'about', 'contact')
      and revision.status in ('draft', 'review')
  ) then
    raise exception 'Phase 5 target pages have an active page-section revision';
  end if;

  if exists (
    select page.slug, section.sort_order
    from public.page_sections section
    join public.pages page on page.id = section.page_id
    where page.slug in ('home', 'services', 'about', 'contact')
    group by page.slug, section.sort_order
    having count(*) > 1
  ) then
    raise exception 'Phase 5 target page_sections contain duplicate sort_order values';
  end if;

  select exists (
    with expected(slug, section_key) as (
      values
        ('home', 'home_intro'),
        ('home', 'home_capabilities'),
        ('home', 'home_approach'),
        ('home', 'home_proof'),
        ('home', 'home_contact'),
        ('services', 'services_capabilities'),
        ('about', 'about_principles'),
        ('about', 'about_people'),
        ('contact', 'contact_process'),
        ('contact', 'contact_form')
    ),
    actual as (
      select page.slug, section.section_key
      from public.page_sections section
      join public.pages page on page.id = section.page_id
      where page.slug in ('home', 'services', 'about', 'contact')
    )
    select 1 from expected
    where not exists (
      select 1 from actual
      where actual.slug = expected.slug
        and actual.section_key = expected.section_key
    )
    union all
    select 1 from actual
    where not exists (
      select 1 from expected
      where expected.slug = actual.slug
        and expected.section_key = actual.section_key
    )
  ) into section_mismatch;

  if section_mismatch then
    raise exception 'Phase 5 target page_sections do not match the approved section registry';
  end if;

  select count(*) into service_count
  from public.services
  where slug in (
    'branding',
    'website-design-development',
    'custom-cms',
    'crm-business-tools',
    'custom-web-applications'
  )
    and status = 'published'
    and published_at is not null
    and published_at <= now();
  if service_count <> 5 then
    raise exception 'Phase 5 requires all five canonical Services to be Published';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'key', section_key,
      'enabled', is_visible,
      'order', section_order,
      'content', case section_key
        when 'home_intro' then jsonb_build_object(
          'eyebrow', 'The work',
          'heading', 'A sharper digital presence starts with a better system.',
          'body', 'Your brand, website, and internal tools should reinforce one another. We bring the thinking and execution together so every part of the experience moves in the same direction.'
        )
        when 'home_capabilities' then jsonb_build_object(
          'eyebrow', 'Capabilities',
          'heading', 'Built as a system. Delivered with intent.',
          'note', 'Five connected capabilities. One clear standard: the work has to perform.',
          'items', jsonb_build_array(
            jsonb_build_object('service', jsonb_build_object('kind', 'service', 'slug', 'branding'), 'ctaLabel', 'Discuss branding'),
            jsonb_build_object('service', jsonb_build_object('kind', 'service', 'slug', 'website-design-development'), 'ctaLabel', 'Discuss a website'),
            jsonb_build_object('service', jsonb_build_object('kind', 'service', 'slug', 'custom-cms'), 'ctaLabel', 'Discuss a content system'),
            jsonb_build_object('service', jsonb_build_object('kind', 'service', 'slug', 'crm-business-tools'), 'ctaLabel', 'Discuss a business tool'),
            jsonb_build_object('service', jsonb_build_object('kind', 'service', 'slug', 'custom-web-applications'), 'ctaLabel', 'Discuss an application')
          )
        )
        when 'home_approach' then jsonb_build_object(
          'eyebrow', 'How we work',
          'heading', 'Clarity first. Craft all the way through.',
          'items', jsonb_build_array(
            jsonb_build_object('title', 'Understand the real problem', 'body', 'We start with the business context, not a predetermined deliverable.'),
            jsonb_build_object('title', 'Architect the right system', 'body', 'Strategy, design, and technology align around the outcome that matters.'),
            jsonb_build_object('title', 'Build with precision', 'body', 'Senior-level thinking stays close to the work from first decision to final detail.')
          )
        )
        when 'home_proof' then jsonb_build_object(
          'eyebrow', 'Proof of work',
          'heading', 'The work deserves the space to speak for itself.',
          'body', 'Selected case studies will be added here as projects, outcomes, and publication permissions are approved.'
        )
        when 'home_contact' then jsonb_build_object(
          'eyebrow', 'The next step',
          'heading', 'Bring us the thing that needs to work better.',
          'body', 'Start with a conversation. We will bring clarity to the opportunity, the path, and what it will take to build well.',
          'cta', jsonb_build_object('kind', 'route', 'label', 'Start a conversation', 'href', '/contact')
        )
      end
    ) order by section_order
  ) into home_body_sections
  from (
    select section.section_key, section.is_visible,
       section.sort_order as section_order
    from public.page_sections section
    where section.page_id = home_page.id
  ) sections;

  select jsonb_agg(
    jsonb_build_object(
      'key', section_key,
      'enabled', is_visible,
      'order', section_order,
      'content', jsonb_build_object()
    ) order by section_order
  ) into services_body_sections
  from (
    select section.section_key, section.is_visible,
       section.sort_order as section_order
    from public.page_sections section
    where section.page_id = services_page.id
  ) sections;

  select jsonb_agg(
    jsonb_build_object(
      'key', section_key,
      'enabled', is_visible,
      'order', section_order,
      'content', case section_key
        when 'about_principles' then jsonb_build_object(
          'eyebrow', 'Working principles',
          'heading', 'Precision over volume. Substance before style. Partnership, not vendorship.',
          'items', jsonb_build_array(
            jsonb_build_object('title', 'Clarity as a discipline.', 'body', 'Remove ambiguity from strategy, design, and communication.'),
            jsonb_build_object('title', 'Intelligent innovation.', 'body', 'Use technology when it creates a genuine advantage.'),
            jsonb_build_object('title', 'Quiet confidence.', 'body', 'Let the quality of the thinking and the work carry the weight.')
          )
        )
        when 'about_people' then jsonb_build_object(
          'eyebrow', 'The people',
          'heading', 'Team and origin details will be added after owner review.',
          'cta', jsonb_build_object('kind', 'route', 'label', 'Start a conversation', 'href', '/contact')
        )
      end
    ) order by section_order
  ) into about_body_sections
  from (
    select section.section_key, section.is_visible,
       section.sort_order as section_order
    from public.page_sections section
    where section.page_id = about_page.id
  ) sections;

  select jsonb_agg(
    jsonb_build_object(
      'key', section_key,
      'enabled', is_visible,
      'order', section_order,
      'content', case section_key
        when 'contact_process' then jsonb_build_object(
          'eyebrow', 'What happens next',
          'heading', 'A clear conversation before a proposal.',
          'items', jsonb_build_array(
            jsonb_build_object('title', 'Share the context.', 'body', 'Tell us what is changing, where the friction is, and what better looks like.'),
            jsonb_build_object('title', 'Find the shape.', 'body', 'We clarify the opportunity, scope, and right next step.'),
            jsonb_build_object('title', 'Build the plan.', 'body', 'If there is a fit, we define the work and how it should move forward.')
          ),
          'cta', jsonb_build_object('kind', 'anchor', 'label', 'Start the conversation', 'href', '#contact-form')
        )
        when 'contact_form' then jsonb_build_object(
          'eyebrow', 'Start the conversation',
          'heading', 'Tell us what needs to work better.',
          'intro', 'Share the context, the friction, and the opportunity. We will take it from there.'
        )
      end
    ) order by section_order
  ) into contact_body_sections
  from (
    select section.section_key, section.is_visible,
       section.sort_order as section_order
    from public.page_sections section
    where section.page_id = contact_page.id
  ) sections;

  home_document := jsonb_build_object(
    'schemaVersion', 1,
    'pageKey', 'home',
    'seo', jsonb_build_object(
      'title', home_page.seo_title,
      'description', home_page.seo_description,
      'ogImageRef', jsonb_build_object('kind', 'generated', 'key', 'default')
    ),
    'sections', jsonb_build_array(jsonb_build_object(
      'key', 'home_hero',
      'enabled', true,
      'order', 0,
      'content', jsonb_build_object(
        'eyebrow', home_page.content->0->>'eyebrow',
        'title', home_page.content->0->>'title',
        'intro', home_page.content->0->>'intro',
        'ctas', jsonb_build_array(
          jsonb_build_object('kind', 'anchor', 'label', 'Start a conversation', 'href', '#contact'),
          jsonb_build_object('kind', 'route', 'label', 'Explore the capabilities', 'href', '/services')
        )
      )
    )) || home_body_sections
  );

  services_document := jsonb_build_object(
    'schemaVersion', 1,
    'pageKey', 'services',
    'seo', jsonb_build_object(
      'title', services_page.seo_title,
      'description', services_page.seo_description,
      'ogImageRef', jsonb_build_object('kind', 'generated', 'key', 'default')
    ),
    'sections', jsonb_build_array(jsonb_build_object(
      'key', 'services_hero',
      'enabled', true,
      'order', 0,
      'content', jsonb_build_object(
        'eyebrow', services_page.content->0->>'eyebrow',
        'title', services_page.content->0->>'title',
        'intro', services_page.content->0->>'intro'
      )
    )) || services_body_sections
  );

  about_document := jsonb_build_object(
    'schemaVersion', 1,
    'pageKey', 'about',
    'seo', jsonb_build_object(
      'title', about_page.seo_title,
      'description', about_page.seo_description,
      'ogImageRef', jsonb_build_object('kind', 'generated', 'key', 'default')
    ),
    'sections', jsonb_build_array(jsonb_build_object(
      'key', 'about_hero',
      'enabled', true,
      'order', 0,
      'content', jsonb_build_object(
        'eyebrow', about_page.content->0->>'eyebrow',
        'title', about_page.content->0->>'title',
        'intro', about_page.content->0->>'intro'
      )
    )) || about_body_sections
  );

  contact_document := jsonb_build_object(
    'schemaVersion', 1,
    'pageKey', 'contact',
    'seo', jsonb_build_object(
      'title', contact_page.seo_title,
      'description', contact_page.seo_description,
      'ogImageRef', jsonb_build_object('kind', 'generated', 'key', 'default')
    ),
    'sections', jsonb_build_array(jsonb_build_object(
      'key', 'contact_hero',
      'enabled', true,
      'order', 0,
      'content', jsonb_build_object(
        'eyebrow', contact_page.content->0->>'eyebrow',
        'title', contact_page.content->0->>'title',
        'intro', contact_page.content->0->>'intro'
      )
    )) || contact_body_sections
  );

  -- Validate the exact complete revision payloads before any page row changes.
  perform public.cms_validate_phase5_page_revision_payload(
    'home',
    jsonb_build_object(
      'title', home_page.title,
      'page_purpose', home_page.page_purpose,
      'audience', home_page.audience,
      'content', home_document
    ),
    true
  );
  perform public.cms_validate_phase5_page_revision_payload(
    'services',
    jsonb_build_object(
      'title', services_page.title,
      'page_purpose', services_page.page_purpose,
      'audience', services_page.audience,
      'content', services_document
    ),
    true
  );
  perform public.cms_validate_phase5_page_revision_payload(
    'about',
    jsonb_build_object(
      'title', about_page.title,
      'page_purpose', about_page.page_purpose,
      'audience', about_page.audience,
      'content', about_document
    ),
    true
  );
  perform public.cms_validate_phase5_page_revision_payload(
    'contact',
    jsonb_build_object(
      'title', contact_page.title,
      'page_purpose', contact_page.page_purpose,
      'audience', contact_page.audience,
      'content', contact_document
    ),
    true
  );

  -- Freeze both legacy mutation boundaries only for the four migrated pages.
  -- Existing page-section rows and historical revisions remain intact.
  create or replace function public.cms_freeze_phase5_page_section_update()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $function$
  begin
    if exists (
      select 1
      from public.pages
      where id in (old.page_id, new.page_id)
        and slug in ('home', 'services', 'about', 'contact')
    ) then
      raise exception 'PageDocument section state is authoritative for migrated Phase 5 pages';
    end if;
    return new;
  end;
  $function$;

  revoke all on function public.cms_freeze_phase5_page_section_update() from public;
  drop trigger if exists page_sections_freeze_phase5_updates on public.page_sections;
  create trigger page_sections_freeze_phase5_updates
  before update on public.page_sections
  for each row execute function public.cms_freeze_phase5_page_section_update();

  create or replace function public.cms_freeze_phase5_page_section_revision()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
  as $function$
  begin
    if new.entity_type = 'page_section'
      and exists (
        select 1
        from public.page_sections section
        join public.pages page on page.id = section.page_id
        where section.id::text = new.entity_key
          and page.slug in ('home', 'services', 'about', 'contact')
      )
    then
      raise exception 'PageDocument section state is authoritative for migrated Phase 5 pages';
    end if;
    return new;
  end;
  $function$;

  revoke all on function public.cms_freeze_phase5_page_section_revision() from public;
  drop trigger if exists cms_revisions_freeze_phase5_page_sections on public.cms_revisions;
  create trigger cms_revisions_freeze_phase5_page_sections
  before insert or update on public.cms_revisions
  for each row execute function public.cms_freeze_phase5_page_section_revision();

  update public.pages
  set content = home_document,
      seo_title = home_document->'seo'->>'title',
      seo_description = home_document->'seo'->>'description',
      og_image_path = '/opengraph-image'
  where id = home_page.id;

  update public.pages
  set content = services_document,
      seo_title = services_document->'seo'->>'title',
      seo_description = services_document->'seo'->>'description',
      og_image_path = '/opengraph-image'
  where id = services_page.id;

  update public.pages
  set content = about_document,
      seo_title = about_document->'seo'->>'title',
      seo_description = about_document->'seo'->>'description',
      og_image_path = '/opengraph-image'
  where id = about_page.id;

  update public.pages
  set content = contact_document,
      seo_title = contact_document->'seo'->>'title',
      seo_description = contact_document->'seo'->>'description',
      og_image_path = '/opengraph-image'
  where id = contact_page.id;

  insert into public.cms_revisions (
    entity_type, entity_key, status, payload, created_by, published_at
  )
  values
    (
      'page', home_page.id::text, 'published',
      jsonb_build_object(
        'title', home_page.title,
        'page_purpose', home_page.page_purpose,
        'audience', home_page.audience,
        'content', home_document
      ),
      null, home_page.published_at
    ),
    (
      'page', services_page.id::text, 'published',
      jsonb_build_object(
        'title', services_page.title,
        'page_purpose', services_page.page_purpose,
        'audience', services_page.audience,
        'content', services_document
      ),
      null, services_page.published_at
    ),
    (
      'page', about_page.id::text, 'published',
      jsonb_build_object(
        'title', about_page.title,
        'page_purpose', about_page.page_purpose,
        'audience', about_page.audience,
        'content', about_document
      ),
      null, about_page.published_at
    ),
    (
      'page', contact_page.id::text, 'published',
      jsonb_build_object(
        'title', contact_page.title,
        'page_purpose', contact_page.page_purpose,
        'audience', contact_page.audience,
        'content', contact_document
      ),
      null, contact_page.published_at
    );
end;
$$;

comment on function public.cms_freeze_phase5_page_section_update() is
  'Slice 3 transition guard: page_sections remains readable but cannot mutate migrated Phase 5 pages.';

comment on function public.cms_freeze_phase5_page_section_revision() is
  'Slice 3 transition guard: historical page-section revisions remain intact, but new migrated-page revisions are rejected.';


-- ===== adopted canonical 20260824000000_add_phase5a_page_document_workflow_contract.sql =====
-- OCSCO Project Crimson — Work Package A / Batch 3A.
--
-- This migration defines the backend-only PageDocument workflow contract for
-- Home, Services, About, and Contact. Work remains legacy. The migration is
-- intentionally forward-only and must be reviewed before remote staging
-- application. It does not alter application code or production.

alter table public.pages
  add column if not exists published_revision_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pages_published_revision_id_fkey'
      and conrelid = 'public.pages'::regclass
  ) then
    alter table public.pages
      add constraint pages_published_revision_id_fkey
      foreign key (published_revision_id)
      references public.cms_revisions(id)
      on delete restrict;
  end if;
end;
$$;

create index if not exists pages_published_revision_id_idx
  on public.pages(published_revision_id)
  where published_revision_id is not null;

create unique index if not exists pages_one_pointer_per_revision_idx
  on public.pages(published_revision_id)
  where published_revision_id is not null;

create table if not exists public.cms_workflow_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  page_id uuid not null references public.pages(id) on delete restrict,
  revision_id uuid not null references public.cms_revisions(id) on delete restrict,
  source_revision_id uuid references public.cms_revisions(id) on delete restrict,
  related_revision_id uuid references public.cms_revisions(id) on delete restrict,
  action text not null check (action in (
    'draft_saved',
    'submitted_for_review',
    'returned_to_draft',
    'publish_archived_previous',
    'published',
    'restore_archived_active',
    'restored_to_review'
  )),
  from_status text check (from_status in ('draft', 'review', 'published', 'archived')),
  to_status text not null check (to_status in ('draft', 'review', 'published', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists cms_workflow_audit_page_created_idx
  on public.cms_workflow_audit_log(page_id, created_at desc);

create index if not exists cms_workflow_audit_revision_created_idx
  on public.cms_workflow_audit_log(revision_id, created_at desc);

alter table public.cms_workflow_audit_log enable row level security;
revoke all on public.cms_workflow_audit_log from anon, authenticated;
grant select on public.cms_workflow_audit_log to authenticated;

drop policy if exists "cms members can read workflow audit history"
  on public.cms_workflow_audit_log;
create policy "cms members can read workflow audit history"
  on public.cms_workflow_audit_log
  for select
  to authenticated
  using (public.cms_has_role(array['owner', 'editor', 'reviewer']::text[]));

create or replace function public.cms_page_document_is_target(p_page_key text)
returns boolean
language sql
immutable
as $$
  select p_page_key = any (array['home', 'services', 'about', 'contact']::text[]);
$$;

revoke all on function public.cms_page_document_is_target(text) from public;

create or replace function public.cms_write_page_workflow_audit(
  p_page_id uuid,
  p_revision_id uuid,
  p_source_revision_id uuid,
  p_related_revision_id uuid,
  p_action text,
  p_from_status text,
  p_to_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cms_workflow_audit_log (
    actor_user_id,
    page_id,
    revision_id,
    source_revision_id,
    related_revision_id,
    action,
    from_status,
    to_status
  )
  values (
    auth.uid(),
    p_page_id,
    p_revision_id,
    p_source_revision_id,
    p_related_revision_id,
    p_action,
    p_from_status,
    p_to_status
  );
end;
$$;

revoke all on function public.cms_write_page_workflow_audit(
  uuid, uuid, uuid, uuid, text, text, text
) from public;

create or replace function public.cms_assert_page_published_revision_pointer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pointer_id uuid;
  page_id uuid;
  page_slug text;
  revision public.cms_revisions%rowtype;
begin
  if tg_table_name = 'pages' then
    if new.published_revision_id is null then
      return new;
    end if;
    pointer_id := new.published_revision_id;
    page_id := new.id;
  elsif tg_table_name = 'cms_revisions' then
    if tg_op = 'DELETE' then
      if exists (
        select 1
        from public.pages
        where published_revision_id = old.id
      ) then
        raise exception 'A current Published revision cannot be deleted';
      end if;
      return old;
    end if;

    if not exists (
      select 1
      from public.pages
      where published_revision_id = new.id
    ) then
      return new;
    end if;

    pointer_id := new.id;
    select id into page_id
    from public.pages
    where published_revision_id = pointer_id;
  else
    return new;
  end if;

  select slug into page_slug
  from public.pages
  where id = page_id;

  if page_slug is null or not public.cms_page_document_is_target(page_slug) then
    raise exception 'Published revision pointers are limited to approved PageDocuments';
  end if;

  select * into revision
  from public.cms_revisions
  where id = pointer_id;

  if revision.id is null
    or revision.entity_type <> 'page'
    or revision.entity_key <> page_id::text
    or revision.status <> 'published'
  then
    raise exception 'The page Published pointer must reference a same-page Published revision';
  end if;

  return new;
end;
$$;

revoke all on function public.cms_assert_page_published_revision_pointer() from public;

drop trigger if exists pages_published_revision_integrity on public.pages;
create constraint trigger pages_published_revision_integrity
after insert or update on public.pages
deferrable initially deferred
for each row execute function public.cms_assert_page_published_revision_pointer();

drop trigger if exists cms_revisions_published_revision_integrity on public.cms_revisions;
create constraint trigger cms_revisions_published_revision_integrity
after insert or update or delete on public.cms_revisions
deferrable initially deferred
for each row execute function public.cms_assert_page_published_revision_pointer();

-- Fail-closed pointer backfill. Exactly one Published candidate is required,
-- and its complete payload must exactly match the authoritative current page
-- row. Drafts and Reviews are never changed by this block.
do $$
declare
  page_row public.pages%rowtype;
  candidate public.cms_revisions%rowtype;
  candidate_count integer;
  expected_payload jsonb;
  target_count integer;
begin
  select count(*) into target_count
  from public.pages
  where slug = any (array['home', 'services', 'about', 'contact']::text[]);

  if target_count <> 4 then
    raise exception 'PageDocument pointer backfill requires exactly four approved pages';
  end if;

  for page_row in
    select *
    from public.pages
    where slug = any (array['home', 'services', 'about', 'contact']::text[])
    order by slug
    for update
  loop
    select count(*) into candidate_count
    from public.cms_revisions
    where entity_type = 'page'
      and entity_key = page_row.id::text
      and status = 'published';

    if candidate_count <> 1 then
      raise exception 'PageDocument % requires exactly one Published revision; found %',
        page_row.slug, candidate_count;
    end if;

    select * into strict candidate
    from public.cms_revisions
    where entity_type = 'page'
      and entity_key = page_row.id::text
      and status = 'published';

    expected_payload := jsonb_build_object(
      'title', page_row.title,
      'page_purpose', page_row.page_purpose,
      'audience', page_row.audience,
      'content', page_row.content
    );

    if page_row.status <> 'published'
      or page_row.published_at is null
      or candidate.published_at is distinct from page_row.published_at
      or candidate.payload is distinct from expected_payload
      or page_row.seo_title is distinct from page_row.content->'seo'->>'title'
      or page_row.seo_description is distinct from page_row.content->'seo'->>'description'
      or page_row.og_image_path is distinct from (
        case
          when page_row.content->'seo'->'ogImageRef'->>'kind' = 'generated'
            and page_row.content->'seo'->'ogImageRef'->>'key' = 'default'
          then '/opengraph-image'
          else null
        end
      )
    then
      raise exception 'Published revision for PageDocument % does not match authoritative page content',
        page_row.slug;
    end if;

    if page_row.published_revision_id is not null
      and page_row.published_revision_id <> candidate.id
    then
      raise exception 'PageDocument % already has a different Published pointer', page_row.slug;
    end if;

    update public.pages
    set published_revision_id = candidate.id
    where id = page_row.id;
  end loop;
end;
$$;

create or replace function public.cms_page_document_save_draft(
  p_page_key text,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  page_row public.pages%rowtype;
  active_revision public.cms_revisions%rowtype;
  revision_id uuid;
  from_status text;
begin
  if not public.cms_has_role(array['owner', 'editor']::text[]) then
    raise exception 'Only owners and editors can save PageDocument Drafts';
  end if;

  if not public.cms_page_document_is_target(p_page_key) then
    raise exception 'That page is not an approved PageDocument';
  end if;

  select * into page_row
  from public.pages
  where slug = p_page_key
  for update;

  if page_row.id is null then
    raise exception 'The approved PageDocument does not exist';
  end if;

  perform public.cms_validate_phase5_page_revision_payload(
    p_page_key,
    p_payload,
    false
  );

  select * into active_revision
  from public.cms_revisions
  where entity_type = 'page'
    and entity_key = page_row.id::text
    and status in ('draft', 'review')
  for update;

  if active_revision.id is not null and active_revision.status = 'review' then
    raise exception 'Review is immutable; return it to Draft before editing';
  end if;

  if active_revision.id is null then
    insert into public.cms_revisions (
      entity_type,
      entity_key,
      status,
      payload,
      created_by
    )
    values (
      'page',
      page_row.id::text,
      'draft',
      p_payload,
      auth.uid()
    )
    returning id into revision_id;
  else
    revision_id := active_revision.id;
    from_status := active_revision.status;
    update public.cms_revisions
    set status = 'draft',
        payload = p_payload
    where id = revision_id;
  end if;

  perform public.cms_write_page_workflow_audit(
    page_row.id,
    revision_id,
    null,
    null,
    'draft_saved',
    from_status,
    'draft'
  );

  return revision_id;
end;
$$;

create or replace function public.cms_page_document_submit_for_review(
  p_page_key text,
  p_revision_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  page_row public.pages%rowtype;
  revision public.cms_revisions%rowtype;
begin
  if not public.cms_has_role(array['owner', 'editor']::text[]) then
    raise exception 'Only owners and editors can submit PageDocument Drafts';
  end if;

  if not public.cms_page_document_is_target(p_page_key) then
    raise exception 'That page is not an approved PageDocument';
  end if;

  select * into page_row
  from public.pages
  where slug = p_page_key
  for update;

  if page_row.id is null then
    raise exception 'The approved PageDocument does not exist';
  end if;

  select * into revision
  from public.cms_revisions
  where id = p_revision_id
    and entity_type = 'page'
    and entity_key = page_row.id::text
    and status = 'draft'
  for update;

  if revision.id is null then
    raise exception 'Only the active Draft can be submitted for Review';
  end if;

  perform public.cms_validate_phase5_page_revision_payload(
    p_page_key,
    revision.payload,
    false
  );

  update public.cms_revisions
  set status = 'review'
  where id = revision.id;

  perform public.cms_write_page_workflow_audit(
    page_row.id,
    revision.id,
    null,
    null,
    'submitted_for_review',
    'draft',
    'review'
  );

  return revision.id;
end;
$$;

create or replace function public.cms_page_document_return_to_draft(
  p_page_key text,
  p_revision_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  page_row public.pages%rowtype;
  revision public.cms_revisions%rowtype;
begin
  if not public.cms_has_role(array['owner', 'editor']::text[]) then
    raise exception 'Only owners and editors can return PageDocument Review to Draft';
  end if;

  if not public.cms_page_document_is_target(p_page_key) then
    raise exception 'That page is not an approved PageDocument';
  end if;

  select * into page_row
  from public.pages
  where slug = p_page_key
  for update;

  if page_row.id is null then
    raise exception 'The approved PageDocument does not exist';
  end if;

  select * into revision
  from public.cms_revisions
  where id = p_revision_id
    and entity_type = 'page'
    and entity_key = page_row.id::text
    and status = 'review'
  for update;

  if revision.id is null then
    raise exception 'Only the active Review can be returned to Draft';
  end if;

  update public.cms_revisions
  set status = 'draft'
  where id = revision.id;

  perform public.cms_write_page_workflow_audit(
    page_row.id,
    revision.id,
    null,
    null,
    'returned_to_draft',
    'review',
    'draft'
  );

  return revision.id;
end;
$$;

create or replace function public.cms_page_document_publish(
  p_page_key text,
  p_revision_id uuid,
  p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  page_row public.pages%rowtype;
  revision public.cms_revisions%rowtype;
  previous_revision public.cms_revisions%rowtype;
  page_id uuid;
  entity_updated boolean;
begin
  if not public.cms_has_role(array['owner']::text[]) then
    raise exception 'Only the owner can publish PageDocuments';
  end if;

  if not public.cms_page_document_is_target(p_page_key) then
    raise exception 'That page is not an approved PageDocument';
  end if;

  select entity_key::uuid into page_id
  from public.cms_revisions
  where id = p_revision_id
    and entity_type = 'page';

  if page_id is null then
    raise exception 'The selected revision is not a PageDocument revision';
  end if;

  select * into page_row
  from public.pages
  where id = page_id
    and slug = p_page_key
  for update;

  if page_row.id is null then
    raise exception 'The selected revision does not belong to the requested PageDocument';
  end if;

  select * into revision
  from public.cms_revisions
  where id = p_revision_id
    and entity_type = 'page'
    and entity_key = page_row.id::text
  for update;

  if revision.id is null or revision.status <> 'review' then
    raise exception 'Only the active Review can be published';
  end if;

  if p_expected_updated_at is null
    or revision.updated_at is distinct from p_expected_updated_at
  then
    raise exception 'This revision changed. Reload before publishing.';
  end if;

  perform public.cms_validate_phase5_page_revision_payload(
    p_page_key,
    revision.payload,
    true
  );

  if page_row.published_revision_id is null then
    raise exception 'The current Published pointer is missing; publication aborted';
  end if;

  if page_row.published_revision_id is not null then
    select * into previous_revision
    from public.cms_revisions
    where id = page_row.published_revision_id
    for update;

    if previous_revision.id is null
      or previous_revision.entity_type <> 'page'
      or previous_revision.entity_key <> page_row.id::text
      or previous_revision.status <> 'published'
    then
      raise exception 'The current Published pointer is invalid; publication aborted';
    end if;

    update public.cms_revisions
    set status = 'archived'
    where id = previous_revision.id;
  end if;

  update public.cms_revisions
  set status = 'published',
      published_at = now()
  where id = revision.id;

  update public.pages
  set title = revision.payload->>'title',
      page_purpose = nullif(revision.payload->>'page_purpose', ''),
      audience = nullif(revision.payload->>'audience', ''),
      seo_title = revision.payload->'content'->'seo'->>'title',
      seo_description = revision.payload->'content'->'seo'->>'description',
      og_image_path = case
        when revision.payload->'content'->'seo'->'ogImageRef'->>'kind' = 'generated'
          and revision.payload->'content'->'seo'->'ogImageRef'->>'key' = 'default'
        then '/opengraph-image'
        else null
      end,
      content = revision.payload->'content',
      cta_label = null,
      cta_href = null,
      status = 'published',
      published_at = now(),
      last_reviewed_at = now(),
      published_revision_id = revision.id
  where id = page_row.id;
  entity_updated := found;

  if not entity_updated then
    raise exception 'The PageDocument could not be published';
  end if;

  if previous_revision.id is not null then
    perform public.cms_write_page_workflow_audit(
      page_row.id,
      previous_revision.id,
      null,
      revision.id,
      'publish_archived_previous',
      'published',
      'archived'
    );
  end if;

  perform public.cms_write_page_workflow_audit(
    page_row.id,
    revision.id,
    null,
    previous_revision.id,
    'published',
    'review',
    'published'
  );

  return revision.id;
end;
$$;

create or replace function public.cms_page_document_restore(
  p_page_key text,
  p_source_revision_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  page_row public.pages%rowtype;
  source_revision public.cms_revisions%rowtype;
  active_revision public.cms_revisions%rowtype;
  restore_payload jsonb;
  restored_revision_id uuid;
begin
  if not public.cms_has_role(array['owner']::text[]) then
    raise exception 'Only the owner can restore PageDocuments';
  end if;

  if not public.cms_page_document_is_target(p_page_key) then
    raise exception 'That page is not an approved PageDocument';
  end if;

  select * into page_row
  from public.pages
  where slug = p_page_key
  for update;

  if page_row.id is null then
    raise exception 'The approved PageDocument does not exist';
  end if;

  select * into source_revision
  from public.cms_revisions
  where id = p_source_revision_id
    and entity_type = 'page'
    and entity_key = page_row.id::text
    and status in ('published', 'archived')
  for update;

  if source_revision.id is null then
    raise exception 'The historical PageDocument revision cannot be restored';
  end if;

  restore_payload := source_revision.payload - 'status';
  perform public.cms_validate_phase5_page_revision_payload(
    p_page_key,
    restore_payload,
    false
  );

  select * into active_revision
  from public.cms_revisions
  where entity_type = 'page'
    and entity_key = page_row.id::text
    and status in ('draft', 'review')
  for update;

  if active_revision.id is not null then
    update public.cms_revisions
    set status = 'archived'
    where id = active_revision.id;

    perform public.cms_write_page_workflow_audit(
      page_row.id,
      active_revision.id,
      source_revision.id,
      null,
      'restore_archived_active',
      active_revision.status,
      'archived'
    );
  end if;

  insert into public.cms_revisions (
    entity_type,
    entity_key,
    status,
    payload,
    created_by,
    published_at
  )
  values (
    'page',
    page_row.id::text,
    'review',
    restore_payload,
    auth.uid(),
    null
  )
  returning id into restored_revision_id;

  perform public.cms_write_page_workflow_audit(
    page_row.id,
    restored_revision_id,
    source_revision.id,
    active_revision.id,
    'restored_to_review',
    null,
    'review'
  );

  return restored_revision_id;
end;
$$;

revoke all on function public.cms_page_document_save_draft(text, jsonb) from public;
revoke all on function public.cms_page_document_submit_for_review(text, uuid) from public;
revoke all on function public.cms_page_document_return_to_draft(text, uuid) from public;
revoke all on function public.cms_page_document_publish(text, uuid, timestamptz) from public;
revoke all on function public.cms_page_document_restore(text, uuid) from public;
grant execute on function public.cms_page_document_save_draft(text, jsonb) to authenticated;
grant execute on function public.cms_page_document_submit_for_review(text, uuid) to authenticated;
grant execute on function public.cms_page_document_return_to_draft(text, uuid) to authenticated;
grant execute on function public.cms_page_document_publish(text, uuid, timestamptz) to authenticated;
grant execute on function public.cms_page_document_restore(text, uuid) to authenticated;

-- Replace the shared save function only to preserve Batch 2 Draft-save
-- compatibility. PageDocument Review/Publish/Restore paths are dedicated;
-- all legacy entity consumers retain the previous behavior.
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
  existing_status text;
  current_payload jsonb;
  existing_payload jsonb;
  merged_payload jsonb;
  page_slug text;
  phase5_document boolean := false;
  current_content jsonb;
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

  select id, status, payload
  into existing_id, existing_status, existing_payload
  from public.cms_revisions
  where entity_type = p_entity_type
    and entity_key = p_entity_key
    and status in ('draft', 'review')
  for update;

  if p_entity_type = 'site_settings' then
    select to_jsonb(s) into current_payload
    from public.site_settings s where s.id = p_entity_key;
  elsif p_entity_type = 'navigation_item' then
    select to_jsonb(n) into current_payload
    from public.navigation_items n where n.id = p_entity_key::uuid;
  elsif p_entity_type = 'page' then
    select to_jsonb(p), slug into current_payload, page_slug
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

  if p_entity_type = 'page'
    and public.cms_page_document_is_target(page_slug)
  then
    if p_status <> 'draft' then
      raise exception 'PageDocument workflow requires the dedicated Submit for Review RPC';
    end if;
    if existing_status = 'review' then
      raise exception 'Review is immutable; use the dedicated Return to Draft RPC';
    end if;
  end if;

  if p_entity_type = 'page' then
    current_content := coalesce(existing_payload->'content', current_payload->'content');
    if jsonb_typeof(p_payload->'content') = 'object' then
      if p_payload ? 'status' then
        raise exception 'PageDocument revisions use cms_revisions.status; payload.status is not allowed';
      end if;
      perform public.cms_validate_phase5_page_revision_payload(page_slug, p_payload, false);
      phase5_document := true;
    elsif p_payload ? 'content' and jsonb_typeof(p_payload->'content') <> 'array' then
      raise exception 'Legacy page revisions require array content';
    elsif jsonb_typeof(current_content) = 'object' then
      raise exception 'A complete PageDocument is required for a PageDocument page revision';
    end if;
  end if;

  if phase5_document then
    merged_payload := jsonb_build_object(
      'title', p_payload->'title',
      'page_purpose', p_payload->'page_purpose',
      'audience', p_payload->'audience',
      'content', p_payload->'content'
    );
  else
    merged_payload := coalesce(current_payload, '{}'::jsonb);
    if existing_payload is not null then
      merged_payload := merged_payload || existing_payload;
    end if;
    merged_payload := merged_payload || p_payload;
    merged_payload := jsonb_set(merged_payload, '{status}', to_jsonb(p_status), true);
  end if;

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

  if p_entity_type = 'page'
    and public.cms_page_document_is_target(page_slug)
  then
    perform public.cms_write_page_workflow_audit(
      p_entity_key::uuid,
      existing_id,
      null,
      null,
      'draft_saved',
      existing_status,
      'draft'
    );
  end if;

  return existing_id;
end;
$$;

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

  -- Reject the guarded PageDocument path before locking the revision. The
  -- dedicated publisher locks page then revision; keeping this rejection
  -- lock-free avoids an unnecessary opposite-order contention window.
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

create or replace function public.cms_restore_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  revision public.cms_revisions%rowtype;
  restore_payload jsonb;
  page_slug text;
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

  if revision.entity_type = 'page' then
    select slug into page_slug
    from public.pages
    where id = revision.entity_key::uuid;
    if public.cms_page_document_is_target(page_slug) then
      raise exception 'PageDocument restore requires the dedicated Restore RPC';
    end if;
  end if;

  restore_payload := revision.payload;
  if revision.entity_type = 'page' and jsonb_typeof(revision.payload->'content') = 'object' then
    perform public.cms_validate_phase5_page_revision_payload(page_slug, restore_payload - 'status', false);
    restore_payload := revision.payload - 'status';
  end if;

  return public.cms_save_revision(
    revision.entity_type,
    revision.entity_key,
    'review',
    restore_payload
  );
end;
$$;

revoke all on function public.cms_save_revision(text, text, text, jsonb) from public;
revoke all on function public.cms_publish_revision(uuid) from public;
revoke all on function public.cms_restore_revision(uuid) from public;
grant execute on function public.cms_save_revision(text, text, text, jsonb) to authenticated;
grant execute on function public.cms_publish_revision(uuid) to authenticated;
grant execute on function public.cms_restore_revision(uuid) to authenticated;

comment on column public.pages.published_revision_id is
  'Durable current-public identity for approved PageDocument pages; runtime history must use this ID.';

comment on table public.cms_workflow_audit_log is
  'Revision-aware PageDocument workflow transitions. Payloads remain in cms_revisions and are not duplicated here.';

comment on function public.cms_page_document_publish(text, uuid, timestamptz) is
  'Owner-only atomic PageDocument publication with expected-updated_at stale protection.';

comment on function public.cms_page_document_restore(text, uuid) is
  'Owner-only non-destructive PageDocument restore that archives active editorial state in place and creates a new Review.';

comment on function public.cms_save_revision(text, text, text, jsonb) is
  'Legacy generic save compatibility. Approved PageDocuments allow only Draft saves; Review transitions use dedicated RPCs.';

comment on function public.cms_publish_revision(uuid) is
  'Legacy generic publication. Approved PageDocuments must use cms_page_document_publish.';

comment on function public.cms_restore_revision(uuid) is
  'Legacy generic restore. Approved PageDocuments must use cms_page_document_restore.';


-- ===== adopted canonical 20260826000000_add_phase6a_insights_foundation.sql =====
-- OCSCO Project Crimson — Phase 6 / Batch 6A Insights foundation.
--
-- This migration is additive. It creates the narrow Insights access boundary,
-- article/revision workflow foundation, taxonomy, attribution, audit history,
-- and the Published-only public projection. It does not create media buckets,
-- the editor, autosave, or public Insights routes.

alter table public.cms_members
  add column if not exists public_display_name text;

alter table public.cms_members
  drop constraint if exists cms_members_public_display_name_check;

alter table public.cms_members
  add constraint cms_members_public_display_name_check
  check (
    public_display_name is null
    or char_length(btrim(public_display_name)) between 1 and 120
  );

create table if not exists public.cms_member_access (
  user_id uuid primary key references public.cms_members(user_id) on delete cascade,
  access_scope text not null default 'full_cms'
    check (access_scope in ('full_cms', 'insights_only')),
  insights_access boolean not null default false,
  can_publish_insights boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (can_publish_insights = false or insights_access = true)
);

drop trigger if exists cms_member_access_set_updated_at on public.cms_member_access;
create trigger cms_member_access_set_updated_at
before update on public.cms_member_access
for each row execute function public.cms_set_updated_at();

alter table public.cms_member_access enable row level security;
revoke all on public.cms_member_access from anon, authenticated;
grant select on public.cms_member_access to authenticated;

drop policy if exists "members can read their own Insights access" on public.cms_member_access;
create policy "members can read their own Insights access"
  on public.cms_member_access for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.cms_has_role(array['owner']::text[])
  );

drop policy if exists "owners can manage Insights access" on public.cms_member_access;
create policy "owners can manage Insights access"
  on public.cms_member_access for all
  to authenticated
  using (public.cms_has_role(array['owner']::text[]))
  with check (public.cms_has_role(array['owner']::text[]));

create or replace function public.cms_has_full_cms_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cms_members member
    left join public.cms_member_access access_scope
      on access_scope.user_id = member.user_id
    where member.user_id = auth.uid()
      and (
        member.role = 'owner'
        or coalesce(access_scope.access_scope, 'full_cms') = 'full_cms'
      )
  );
$$;

create or replace function public.cms_can_access_insights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cms_members member
    left join public.cms_member_access access_scope
      on access_scope.user_id = member.user_id
    where member.user_id = auth.uid()
      and (
        member.role = 'owner'
        or coalesce(access_scope.access_scope, 'full_cms') = 'full_cms'
        or (
          coalesce(access_scope.access_scope, 'full_cms') = 'insights_only'
          and coalesce(access_scope.insights_access, false)
        )
      )
  );
$$;

create or replace function public.cms_can_edit_insights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cms_members member
    left join public.cms_member_access access_scope
      on access_scope.user_id = member.user_id
    where member.user_id = auth.uid()
      and member.role in ('owner', 'editor')
      and (
        member.role = 'owner'
        or coalesce(access_scope.access_scope, 'full_cms') = 'full_cms'
        or (
          coalesce(access_scope.access_scope, 'full_cms') = 'insights_only'
          and coalesce(access_scope.insights_access, false)
        )
      )
  );
$$;

create or replace function public.cms_can_submit_insights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.cms_can_edit_insights();
$$;

create or replace function public.cms_can_publish_insights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cms_members member
    left join public.cms_member_access access_scope
      on access_scope.user_id = member.user_id
    where member.user_id = auth.uid()
      and (
        member.role = 'owner'
        or (
          member.role = 'editor'
          and coalesce(access_scope.can_publish_insights, false)
          and (
            coalesce(access_scope.access_scope, 'full_cms') = 'full_cms'
            or (
              access_scope.access_scope = 'insights_only'
              and coalesce(access_scope.insights_access, false)
            )
          )
        )
      )
  );
$$;

create or replace function public.cms_can_unpublish_insights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.cms_current_role() = 'owner';
$$;

create or replace function public.cms_can_restore_insights()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.cms_current_role() = 'owner';
$$;

create or replace function public.cms_can_access_crimson_area(p_area text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.cms_current_role() = 'owner'
    or public.cms_has_full_cms_access()
    or (
      lower(p_area) = 'insights'
      and public.cms_can_access_insights()
    );
$$;

-- Existing cms_has_role callers are the Phase 4/5 full-CMS boundary. Keeping
-- this helper full-CMS-only prevents an Insights-only member from inheriting
-- legacy Pages, Services, Work, Global Content, or Team permissions.
create or replace function public.cms_has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.cms_has_full_cms_access()
    and coalesce(public.cms_current_role() = any(allowed_roles), false);
$$;

revoke all on function public.cms_has_full_cms_access() from public;
revoke all on function public.cms_can_access_insights() from public;
revoke all on function public.cms_can_edit_insights() from public;
revoke all on function public.cms_can_submit_insights() from public;
revoke all on function public.cms_can_publish_insights() from public;
revoke all on function public.cms_can_unpublish_insights() from public;
revoke all on function public.cms_can_restore_insights() from public;
revoke all on function public.cms_can_access_crimson_area(text) from public;
revoke all on function public.cms_has_role(text[]) from public;
grant execute on function public.cms_has_full_cms_access() to authenticated;
grant execute on function public.cms_can_access_insights() to authenticated;
grant execute on function public.cms_can_edit_insights() to authenticated;
grant execute on function public.cms_can_submit_insights() to authenticated;
grant execute on function public.cms_can_publish_insights() to authenticated;
grant execute on function public.cms_can_unpublish_insights() to authenticated;
grant execute on function public.cms_can_restore_insights() to authenticated;
grant execute on function public.cms_can_access_crimson_area(text) to authenticated;
grant execute on function public.cms_has_role(text[]) to authenticated;

create table if not exists public.insights_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insights_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists insights_categories_set_updated_at on public.insights_categories;
create trigger insights_categories_set_updated_at
before update on public.insights_categories
for each row execute function public.cms_set_updated_at();

drop trigger if exists insights_tags_set_updated_at on public.insights_tags;
create trigger insights_tags_set_updated_at
before update on public.insights_tags
for each row execute function public.cms_set_updated_at();

create table if not exists public.insights_articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'draft'
    check (status in ('draft', 'review', 'published', 'unpublished')),
  active_revision_id uuid,
  published_revision_id uuid,
  last_published_revision_id uuid,
  submitted_at timestamptz,
  published_at timestamptz,
  unpublished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.insights_article_revisions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.insights_articles(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  status text not null check (status in ('draft', 'review', 'published', 'archived')),
  title text not null default '',
  excerpt text,
  body jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object'),
  primary_category_id uuid references public.insights_categories(id) on delete restrict,
  author_display_name_snapshot text,
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (article_id, revision_number)
);

alter table public.insights_articles
  add constraint insights_articles_active_revision_fk
  foreign key (active_revision_id)
  references public.insights_article_revisions(id)
  on delete restrict;

alter table public.insights_articles
  add constraint insights_articles_published_revision_fk
  foreign key (published_revision_id)
  references public.insights_article_revisions(id)
  on delete restrict;

alter table public.insights_articles
  add constraint insights_articles_last_published_revision_fk
  foreign key (last_published_revision_id)
  references public.insights_article_revisions(id)
  on delete restrict;

create unique index if not exists insights_articles_one_working_revision_idx
  on public.insights_article_revisions(article_id)
  where status in ('draft', 'review');

create unique index if not exists insights_articles_one_published_revision_idx
  on public.insights_article_revisions(article_id)
  where status = 'published';

create index if not exists insights_articles_review_queue_idx
  on public.insights_articles(status, submitted_at, created_at)
  where status = 'review';

create table if not exists public.insights_article_revision_tags (
  revision_id uuid not null references public.insights_article_revisions(id) on delete cascade,
  tag_id uuid not null references public.insights_tags(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (revision_id, tag_id)
);

create table if not exists public.insights_workflow_audit_log (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.insights_articles(id) on delete cascade,
  revision_id uuid references public.insights_article_revisions(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'created', 'submitted', 'withdrawn_to_draft', 'returned_to_draft',
    'published', 'unpublished', 'restored', 'republished'
  )),
  from_status text,
  to_status text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists insights_workflow_audit_article_idx
  on public.insights_workflow_audit_log(article_id, created_at desc);

create or replace function public.insights_articles_author_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.author_id is distinct from old.author_id then
    raise exception 'Insight article ownership is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists insights_articles_author_immutable on public.insights_articles;
create trigger insights_articles_author_immutable
before update on public.insights_articles
for each row execute function public.insights_articles_author_immutable();

create or replace function public.insights_revision_immutable_when_published()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'published' and (
    new.article_id is distinct from old.article_id
    or new.revision_number is distinct from old.revision_number
    or new.title is distinct from old.title
    or new.excerpt is distinct from old.excerpt
    or new.body is distinct from old.body
    or new.primary_category_id is distinct from old.primary_category_id
    or new.author_display_name_snapshot is distinct from old.author_display_name_snapshot
    or new.created_by is distinct from old.created_by
  ) then
    raise exception 'Published Insight revisions are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists insights_revision_immutable_when_published on public.insights_article_revisions;
create trigger insights_revision_immutable_when_published
before update on public.insights_article_revisions
for each row execute function public.insights_revision_immutable_when_published();

alter table public.insights_categories enable row level security;
alter table public.insights_tags enable row level security;
alter table public.insights_articles enable row level security;
alter table public.insights_article_revisions enable row level security;
alter table public.insights_article_revision_tags enable row level security;
alter table public.insights_workflow_audit_log enable row level security;

revoke all on public.insights_categories from anon, authenticated;
revoke all on public.insights_tags from anon, authenticated;
revoke all on public.insights_articles from anon, authenticated;
revoke all on public.insights_article_revisions from anon, authenticated;
revoke all on public.insights_article_revision_tags from anon, authenticated;
revoke all on public.insights_workflow_audit_log from anon, authenticated;
grant select on public.insights_categories, public.insights_tags to authenticated;
grant select on public.insights_articles, public.insights_article_revisions,
  public.insights_article_revision_tags, public.insights_workflow_audit_log to authenticated;

drop policy if exists "Insights members can read categories" on public.insights_categories;
create policy "Insights members can read categories"
  on public.insights_categories for select to authenticated
  using (public.cms_can_access_insights());

drop policy if exists "Owners can manage categories" on public.insights_categories;
create policy "Owners can manage categories"
  on public.insights_categories for all to authenticated
  using (public.cms_current_role() = 'owner')
  with check (public.cms_current_role() = 'owner');

drop policy if exists "Insights members can read tags" on public.insights_tags;
create policy "Insights members can read tags"
  on public.insights_tags for select to authenticated
  using (public.cms_can_access_insights());

drop policy if exists "Owners can manage tags" on public.insights_tags;
create policy "Owners can manage tags"
  on public.insights_tags for all to authenticated
  using (public.cms_current_role() = 'owner')
  with check (public.cms_current_role() = 'owner');

drop policy if exists "Insights members can read articles" on public.insights_articles;
create policy "Insights members can read articles"
  on public.insights_articles for select to authenticated
  using (
    public.cms_can_access_insights()
    and (
      public.cms_has_full_cms_access()
      or author_id = auth.uid()
    )
  );

drop policy if exists "Insights members can read revisions" on public.insights_article_revisions;
create policy "Insights members can read revisions"
  on public.insights_article_revisions for select to authenticated
  using (
    public.cms_can_access_insights()
    and exists (
      select 1 from public.insights_articles article
      where article.id = article_id
        and (public.cms_has_full_cms_access() or article.author_id = auth.uid())
    )
  );

drop policy if exists "Insights members can read revision tags" on public.insights_article_revision_tags;
create policy "Insights members can read revision tags"
  on public.insights_article_revision_tags for select to authenticated
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

drop policy if exists "Insights members can read workflow audit" on public.insights_workflow_audit_log;
create policy "Insights members can read workflow audit"
  on public.insights_workflow_audit_log for select to authenticated
  using (
    public.cms_can_access_insights()
    and exists (
      select 1 from public.insights_articles article
      where article.id = article_id
        and (public.cms_has_full_cms_access() or article.author_id = auth.uid())
    )
  );

create or replace function public.insights_write_audit(
  p_article_id uuid,
  p_revision_id uuid,
  p_action text,
  p_from_status text,
  p_to_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.insights_workflow_audit_log (
    article_id, revision_id, actor_id, action, from_status, to_status, metadata
  ) values (
    p_article_id, p_revision_id, auth.uid(), p_action, p_from_status, p_to_status,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.insights_write_audit(uuid, uuid, text, text, text, jsonb) from public;

create or replace function public.insights_create_article(
  p_slug text,
  p_title text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  article_id uuid;
  revision_id uuid;
begin
  if not public.cms_can_edit_insights() then
    raise exception 'This member cannot create Insights articles';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Article slug must use lowercase letters, numbers, and hyphens';
  end if;

  insert into public.insights_articles (author_id, slug)
  values (auth.uid(), p_slug)
  returning id into article_id;

  insert into public.insights_article_revisions (
    article_id, revision_number, status, title, created_by
  ) values (
    article_id, 1, 'draft', coalesce(p_title, ''), auth.uid()
  ) returning id into revision_id;

  update public.insights_articles
  set active_revision_id = revision_id
  where id = article_id;

  perform public.insights_write_audit(article_id, revision_id, 'created', null, 'draft');
  return article_id;
end;
$$;

create or replace function public.insights_save_draft(
  p_article_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_excerpt text,
  p_body jsonb,
  p_primary_category_id uuid,
  p_tag_ids uuid[] default null
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
  if not public.cms_can_edit_insights() then
    raise exception 'This member cannot edit Insights articles';
  end if;
  if jsonb_typeof(p_body) <> 'object' then
    raise exception 'Insight body must be a JSON object';
  end if;

  select * into article
  from public.insights_articles
  where id = p_article_id
  for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if not public.cms_has_full_cms_access() and article.author_id <> auth.uid() then
    raise exception 'Editors may only edit their own Insight articles';
  end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before saving the Draft.';
  end if;
  if article.status = 'review' then
    raise exception 'Review is immutable; withdraw it before saving a Draft';
  end if;

  if article.active_revision_id is not null then
    select * into revision
    from public.insights_article_revisions
    where id = article.active_revision_id
    for update;
  end if;

  if revision.id is null or revision.status not in ('draft') then
    select coalesce(max(revision_number), 0) + 1 into next_revision
    from public.insights_article_revisions
    where article_id = article.id;
    insert into public.insights_article_revisions (
      article_id, revision_number, status, created_by
    ) values (article.id, next_revision, 'draft', auth.uid())
    returning * into revision;
  end if;

  update public.insights_article_revisions
  set status = 'draft', title = coalesce(p_title, ''), excerpt = p_excerpt,
      body = p_body, primary_category_id = p_primary_category_id,
      updated_at = now()
  where id = revision.id;

  if p_tag_ids is not null then
    delete from public.insights_article_revision_tags where revision_id = revision.id;
    insert into public.insights_article_revision_tags (revision_id, tag_id)
    select revision.id, tag_id
    from unnest(p_tag_ids) as tag_id
    where exists (select 1 from public.insights_tags tag where tag.id = tag_id);
  end if;

  update public.insights_articles
  set active_revision_id = revision.id, status = 'draft', updated_at = now()
  where id = article.id;
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
  if not public.cms_can_submit_insights() then
    raise exception 'This member cannot submit Insights articles';
  end if;

  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if not public.cms_has_full_cms_access() and article.author_id <> auth.uid() then
    raise exception 'Editors may only submit their own Insight articles';
  end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before submitting';
  end if;
  if article.status <> 'draft' then raise exception 'Only a Draft can be submitted'; end if;

  select * into revision from public.insights_article_revisions
  where id = article.active_revision_id for update;
  if revision.id is null or revision.status <> 'draft' then
    raise exception 'The active Draft revision is missing';
  end if;
  if char_length(btrim(revision.title)) = 0 then raise exception 'A title is required before Submit'; end if;
  if revision.primary_category_id is null then raise exception 'A primary Category is required before Submit'; end if;
  if not exists (
    select 1 from public.insights_categories category
    where category.id = revision.primary_category_id and category.is_active
  ) then raise exception 'The primary Category is not active'; end if;

  update public.insights_article_revisions set status = 'review', updated_at = now()
  where id = revision.id;
  update public.insights_articles
  set status = 'review', submitted_at = now(), updated_at = now()
  where id = article.id;
  perform public.insights_write_audit(article.id, revision.id, 'submitted', 'draft', 'review');
  return revision.id;
end;
$$;

create or replace function public.insights_withdraw_review(
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
  if not public.cms_can_edit_insights() then raise exception 'This member cannot withdraw an Insight'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if not public.cms_has_full_cms_access() and article.author_id <> auth.uid() then
    raise exception 'Editors may only withdraw their own Insight articles';
  end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before withdrawing';
  end if;
  if article.status <> 'review' then raise exception 'Only an active Review can be withdrawn'; end if;
  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status <> 'review' then raise exception 'The active Review revision is missing'; end if;

  update public.insights_article_revisions set status = 'draft', updated_at = now() where id = revision.id;
  update public.insights_articles set status = 'draft', updated_at = now() where id = article.id;
  perform public.insights_write_audit(article.id, revision.id, 'withdrawn_to_draft', 'review', 'draft');
  return revision.id;
end;
$$;

create or replace function public.insights_publish_article(
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
  previous_revision_id uuid;
  display_name text;
begin
  if not public.cms_can_publish_insights() then raise exception 'This member cannot publish Insights'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if public.cms_current_role() <> 'owner' and article.author_id <> auth.uid() then
    raise exception 'Trusted Publishers may only publish their own Insight articles';
  end if;
  if public.cms_current_role() <> 'owner' and article.status <> 'draft' then
    raise exception 'Trusted Publishers may only publish their own Draft';
  end if;
  if public.cms_current_role() = 'owner' and article.status not in ('draft', 'review') then
    raise exception 'Only a Draft or Review can be published';
  end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before publishing';
  end if;

  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status not in ('draft', 'review') then raise exception 'The active revision cannot be published'; end if;
  if char_length(btrim(revision.title)) = 0 then raise exception 'A title is required before Publish'; end if;
  if revision.primary_category_id is null then raise exception 'A primary Category is required before Publish'; end if;
  if not exists (select 1 from public.insights_categories category where category.id = revision.primary_category_id and category.is_active) then
    raise exception 'The primary Category is not active';
  end if;

  select nullif(btrim(public_display_name), '') into display_name from public.cms_members where user_id = article.author_id;
  previous_revision_id := article.published_revision_id;
  if previous_revision_id is not null and previous_revision_id <> revision.id then
    update public.insights_article_revisions set status = 'archived', updated_at = now()
    where id = previous_revision_id and status = 'published';
  end if;
  update public.insights_article_revisions
  set status = 'published', published_at = now(),
      author_display_name_snapshot = coalesce(display_name, 'OCSCO Team'), updated_at = now()
  where id = revision.id;
  update public.insights_articles
  set status = 'published', active_revision_id = revision.id,
      published_revision_id = revision.id, last_published_revision_id = revision.id,
      published_at = now(), unpublished_at = null, updated_at = now()
  where id = article.id;
  perform public.insights_write_audit(article.id, revision.id,
    case when previous_revision_id is null then 'published' else 'republished' end,
    article.status, 'published', jsonb_build_object('previous_revision_id', previous_revision_id));
  return revision.id;
end;
$$;

create or replace function public.insights_return_to_draft(
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
  if public.cms_current_role() <> 'owner' then raise exception 'Only the owner can return an Insight to Draft'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then raise exception 'The Insight changed. Reload before returning'; end if;
  if article.status <> 'review' then raise exception 'Only an active Review can be returned to Draft'; end if;
  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status <> 'review' then raise exception 'The active Review revision is missing'; end if;
  update public.insights_article_revisions set status = 'draft', updated_at = now() where id = revision.id;
  update public.insights_articles set status = 'draft', updated_at = now() where id = article.id;
  perform public.insights_write_audit(article.id, revision.id, 'returned_to_draft', 'review', 'draft');
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
  update public.insights_article_revisions
  set status = 'archived', updated_at = now()
  where id = previous_revision_id and status = 'published';
  update public.insights_articles
  set status = 'unpublished', published_revision_id = null, unpublished_at = now(), updated_at = now()
  where id = article.id;
  perform public.insights_write_audit(article.id, previous_revision_id, 'unpublished', article.status, 'unpublished');
  return previous_revision_id;
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
  select * into source_revision from public.insights_article_revisions
  where id = p_source_revision_id and article_id = article.id and status in ('published', 'archived') for update;
  if source_revision.id is null then raise exception 'That historical Insight revision cannot be restored'; end if;
  if article.active_revision_id is not null then
    select * into active_revision from public.insights_article_revisions where id = article.active_revision_id for update;
    if active_revision.status in ('draft', 'review') then
      update public.insights_article_revisions set status = 'archived', updated_at = now() where id = active_revision.id;
    end if;
  end if;
  select coalesce(max(revision_number), 0) + 1 into next_revision from public.insights_article_revisions where article_id = article.id;
  insert into public.insights_article_revisions (
    article_id, revision_number, status, title, excerpt, body, primary_category_id, created_by
  ) values (
    article.id, next_revision, 'draft', source_revision.title, source_revision.excerpt,
    source_revision.body, source_revision.primary_category_id, auth.uid()
  ) returning id into restored_id;
  insert into public.insights_article_revision_tags (revision_id, tag_id)
  select restored_id, tag_id from public.insights_article_revision_tags where revision_id = source_revision.id;
  update public.insights_articles set active_revision_id = restored_id, status = 'draft', updated_at = now() where id = article.id;
  perform public.insights_write_audit(article.id, restored_id, 'restored', article.status, 'draft', jsonb_build_object('source_revision_id', source_revision.id));
  return restored_id;
end;
$$;

revoke all on function public.insights_create_article(text, text) from public;
revoke all on function public.insights_save_draft(uuid, timestamptz, text, text, jsonb, uuid, uuid[]) from public;
revoke all on function public.insights_submit_for_review(uuid, timestamptz) from public;
revoke all on function public.insights_withdraw_review(uuid, timestamptz) from public;
revoke all on function public.insights_publish_article(uuid, timestamptz) from public;
revoke all on function public.insights_return_to_draft(uuid, timestamptz) from public;
revoke all on function public.insights_unpublish_article(uuid, timestamptz) from public;
revoke all on function public.insights_restore_revision(uuid, uuid) from public;
grant execute on function public.insights_create_article(text, text) to authenticated;
grant execute on function public.insights_save_draft(uuid, timestamptz, text, text, jsonb, uuid, uuid[]) to authenticated;
grant execute on function public.insights_submit_for_review(uuid, timestamptz) to authenticated;
grant execute on function public.insights_withdraw_review(uuid, timestamptz) to authenticated;
grant execute on function public.insights_publish_article(uuid, timestamptz) to authenticated;
grant execute on function public.insights_return_to_draft(uuid, timestamptz) to authenticated;
grant execute on function public.insights_unpublish_article(uuid, timestamptz) to authenticated;
grant execute on function public.insights_restore_revision(uuid, uuid) to authenticated;

create or replace view public.insights_published_articles as
select
  article.id as article_id,
  article.slug,
  revision.id as revision_id,
  revision.title,
  revision.excerpt,
  revision.body,
  revision.author_display_name_snapshot as author_display_name,
  category.name as category_name,
  category.slug as category_slug,
  coalesce((
    select jsonb_agg(jsonb_build_object('name', tag.name, 'slug', tag.slug) order by tag.name)
    from public.insights_article_revision_tags relation
    join public.insights_tags tag on tag.id = relation.tag_id
    where relation.revision_id = revision.id
  ), '[]'::jsonb) as tags,
  revision.published_at
from public.insights_articles article
join public.insights_article_revisions revision
  on revision.id = article.published_revision_id
left join public.insights_categories category
  on category.id = revision.primary_category_id
where article.published_revision_id is not null
  and revision.status = 'published';

revoke all on public.insights_published_articles from public;
grant select on public.insights_published_articles to anon, authenticated;

comment on table public.cms_member_access is
  'Narrow per-member access boundary. Missing rows preserve full-CMS compatibility; owner is always full authority.';
comment on column public.cms_member_access.can_publish_insights is
  'Narrow Trusted Publisher capability. It never grants broad Crimson administration and is ownership-checked by the publish RPC.';
comment on table public.insights_articles is
  'Stable Insights article identity and workflow pointer. Author ownership is immutable and derived by the create RPC.';
comment on table public.insights_article_revisions is
  'Article-specific immutable publication history with private Draft/Review workflow revisions.';
comment on view public.insights_published_articles is
  'Safe public projection. It exposes only the current Published revision and never exposes Draft, Review, history, audit, or membership data.';


-- ===== adopted canonical 20260826010000_add_phase6b1_insights_slug_update_contract.sql =====
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


-- ===== adopted canonical 20260827000000_add_phase6_insights_public_projection_security.sql =====

create table if not exists public.insights_public_articles (
  article_id uuid primary key references public.insights_articles(id) on delete cascade,
  slug text not null unique,
  revision_id uuid not null unique references public.insights_article_revisions(id) on delete restrict,
  title text not null default '',
  excerpt text,
  body jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object'),
  author_display_name text,
  category_name text,
  category_slug text,
  tags jsonb not null default '[]'::jsonb check (jsonb_typeof(tags) = 'array'),
  published_at timestamptz not null
);

comment on table public.insights_public_articles is
  'Sanitized Published-only Insights projection. Private article, revision, membership, and audit tables remain outside the public read boundary.';

alter table public.insights_public_articles enable row level security;

revoke all on public.insights_public_articles from public, anon, authenticated;
grant select on public.insights_public_articles to anon, authenticated;

drop policy if exists "Public can read Published Insights" on public.insights_public_articles;
create policy "Public can read Published Insights"
  on public.insights_public_articles for select to anon, authenticated
  using (published_at is not null);

insert into public.insights_public_articles (
  article_id, slug, revision_id, title, excerpt, body,
  author_display_name, category_name, category_slug, tags, published_at
)
select
  article.id,
  article.slug,
  revision.id,
  revision.title,
  revision.excerpt,
  revision.body,
  revision.author_display_name_snapshot,
  category.name,
  category.slug,
  coalesce((
    select jsonb_agg(jsonb_build_object('name', tag.name, 'slug', tag.slug) order by tag.name)
    from public.insights_article_revision_tags relation
    join public.insights_tags tag on tag.id = relation.tag_id
    where relation.revision_id = revision.id
  ), '[]'::jsonb),
  revision.published_at
from public.insights_articles article
join public.insights_article_revisions revision
  on revision.id = article.published_revision_id
left join public.insights_categories category
  on category.id = revision.primary_category_id
where article.status = 'published'
  and article.published_revision_id is not null
  and revision.status = 'published'
on conflict (article_id) do update set
  slug = excluded.slug,
  revision_id = excluded.revision_id,
  title = excluded.title,
  excerpt = excluded.excerpt,
  body = excluded.body,
  author_display_name = excluded.author_display_name,
  category_name = excluded.category_name,
  category_slug = excluded.category_slug,
  tags = excluded.tags,
  published_at = excluded.published_at;

create or replace function public.insights_publish_article(
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
  previous_revision_id uuid;
  display_name text;
begin
  if not public.cms_can_publish_insights() then raise exception 'This member cannot publish Insights'; end if;
  select * into article from public.insights_articles where id = p_article_id for update;
  if article.id is null then raise exception 'The Insight article does not exist'; end if;
  if public.cms_current_role() <> 'owner' and article.author_id <> auth.uid() then
    raise exception 'Trusted Publishers may only publish their own Insight articles';
  end if;
  if public.cms_current_role() <> 'owner' and article.status <> 'draft' then
    raise exception 'Trusted Publishers may only publish their own Draft';
  end if;
  if public.cms_current_role() = 'owner' and article.status not in ('draft', 'review') then
    raise exception 'Only a Draft or Review can be published';
  end if;
  if p_expected_updated_at is not null and article.updated_at <> p_expected_updated_at then
    raise exception 'The Insight changed. Reload before publishing';
  end if;

  select * into revision from public.insights_article_revisions where id = article.active_revision_id for update;
  if revision.id is null or revision.status not in ('draft', 'review') then raise exception 'The active revision cannot be published'; end if;
  if char_length(btrim(revision.title)) = 0 then raise exception 'A title is required before Publish'; end if;
  if revision.primary_category_id is null then raise exception 'A primary Category is required before Publish'; end if;
  if not exists (select 1 from public.insights_categories category where category.id = revision.primary_category_id and category.is_active) then
    raise exception 'The primary Category is not active';
  end if;

  select nullif(btrim(public_display_name), '') into display_name from public.cms_members where user_id = article.author_id;
  previous_revision_id := article.published_revision_id;
  if previous_revision_id is not null and previous_revision_id <> revision.id then
    update public.insights_article_revisions set status = 'archived', updated_at = now()
    where id = previous_revision_id and status = 'published';
  end if;
  update public.insights_article_revisions
  set status = 'published', published_at = now(),
      author_display_name_snapshot = coalesce(display_name, 'OCSCO Team'), updated_at = now()
  where id = revision.id;
  update public.insights_articles
  set status = 'published', active_revision_id = revision.id,
      published_revision_id = revision.id, last_published_revision_id = revision.id,
      published_at = now(), unpublished_at = null, updated_at = now()
  where id = article.id;

  insert into public.insights_public_articles (
    article_id, slug, revision_id, title, excerpt, body,
    author_display_name, category_name, category_slug, tags, published_at
  )
  select
    current_article.id,
    current_article.slug,
    current_revision.id,
    current_revision.title,
    current_revision.excerpt,
    current_revision.body,
    current_revision.author_display_name_snapshot,
    category.name,
    category.slug,
    coalesce((
      select jsonb_agg(jsonb_build_object('name', tag.name, 'slug', tag.slug) order by tag.name)
      from public.insights_article_revision_tags relation
      join public.insights_tags tag on tag.id = relation.tag_id
      where relation.revision_id = current_revision.id
    ), '[]'::jsonb),
    current_revision.published_at
  from public.insights_articles current_article
  join public.insights_article_revisions current_revision
    on current_revision.id = current_article.published_revision_id
  left join public.insights_categories category
    on category.id = current_revision.primary_category_id
  where current_article.id = article.id
    and current_revision.id = revision.id
  on conflict (article_id) do update set
    slug = excluded.slug,
    revision_id = excluded.revision_id,
    title = excluded.title,
    excerpt = excluded.excerpt,
    body = excluded.body,
    author_display_name = excluded.author_display_name,
    category_name = excluded.category_name,
    category_slug = excluded.category_slug,
    tags = excluded.tags,
    published_at = excluded.published_at;

  perform public.insights_write_audit(article.id, revision.id,
    case when previous_revision_id is null then 'published' else 'republished' end,
    article.status, 'published', jsonb_build_object('previous_revision_id', previous_revision_id));
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
  update public.insights_article_revisions
  set status = 'archived', updated_at = now()
  where id = previous_revision_id and status = 'published';
  update public.insights_articles
  set status = 'unpublished', published_revision_id = null, unpublished_at = now(), updated_at = now()
  where id = article.id;
  delete from public.insights_public_articles where article_id = article.id;
  perform public.insights_write_audit(article.id, previous_revision_id, 'unpublished', article.status, 'unpublished');
  return previous_revision_id;
end;
$$;

revoke all on function public.insights_publish_article(uuid, timestamptz) from public;
revoke all on function public.insights_unpublish_article(uuid, timestamptz) from public;
grant execute on function public.insights_publish_article(uuid, timestamptz) to authenticated;
grant execute on function public.insights_unpublish_article(uuid, timestamptz) to authenticated;

create or replace view public.insights_published_articles
with (security_invoker = true)
as
select
  article_id,
  slug,
  revision_id,
  title,
  excerpt,
  body,
  author_display_name,
  category_name,
  category_slug,
  tags,
  published_at
from public.insights_public_articles;

comment on view public.insights_published_articles is
  'Security-invoker Published-only public read boundary over the sanitized Insights projection.';

revoke all on public.insights_published_articles from public, anon, authenticated;
grant select on public.insights_published_articles to anon, authenticated;
-- ===== adopted canonical 20260828000000_add_phase6b3_insights_media_workflow.sql =====
-- OCSCO Project Crimson — Phase 6 / Batch 6B3 Insights media workflow.
--
-- This is an additive, Insights-specific media boundary. Private canonical
-- WebP objects are retained for history and restore. Published delivery
-- objects are copied into a separate bucket only for the exact Published
-- revision, and the sanitized public projection contains only stable public
-- artifact paths. Migrations 1-29 remain unchanged.

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

-- ===== adopted canonical 20260829000000_add_phase6b3_restore_media_association.sql =====
-- OCSCO Project Crimson — Phase 6 / Batch 6B3 Restore media association hotfix.
--
-- Restore creates a new private Draft revision. Media metadata is cloned for
-- that revision with new IDs, while the immutable private WebP object is
-- safely reused. The original asset remains attached to the historical
-- revision, and removing/replacing the restored asset only changes the new
-- metadata row. Published artifact columns intentionally use their defaults.
-- A private canonical object is immutable and may be referenced by more than
-- one revision. Uploads still use revision-scoped unique paths; this only
-- permits safe metadata clones created by Restore to reference the same
-- unchanged private object.
alter table public.insights_media_assets
  drop constraint if exists insights_media_assets_storage_path_key;

create index if not exists insights_media_assets_storage_path_idx
  on public.insights_media_assets(storage_path);

create or replace function public.insights_rewrite_restore_media_ids(
  p_node jsonb,
  p_mapping jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  child jsonb;
  children jsonb := '[]'::jsonb;
  media_key text;
begin
  if jsonb_typeof(p_node) <> 'object' then return p_node; end if;

  if p_node->>'type' = 'image' then
    -- Historical bodies must not carry a signed/private/public URL into the
    -- new Draft. The renderer resolves the cloned opaque media ID later.
    p_node := p_node #- '{attrs,src}';
    media_key := nullif(p_node->'attrs'->>'mediaId', '');
    if media_key is not null and p_mapping ? media_key then
      return jsonb_set(p_node, '{attrs,mediaId}', to_jsonb(p_mapping->>media_key), true);
    end if;
  end if;

  if jsonb_typeof(p_node->'content') = 'array' then
    for child in select value from jsonb_array_elements(p_node->'content') loop
      children := children || jsonb_build_array(public.insights_rewrite_restore_media_ids(child, p_mapping));
    end loop;
    return jsonb_set(p_node, '{content}', children, true);
  end if;

  return p_node;
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

  -- Clone each source asset's metadata, but keep the historical asset row and
  -- its private object untouched. The new row gets fresh identity and new
  -- revision ownership; public artifact fields are not copied.
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

  if exists (
    select 1
    from public.insights_body_media_ids(source_revision.body) referenced
    where not (media_mapping ? referenced.media_id::text)
  ) then
    raise exception 'Historical inline media could not be restored';
  end if;

  restored_body := public.insights_rewrite_restore_media_ids(source_revision.body, media_mapping);
  update public.insights_article_revisions
  set body = restored_body, cover_media_id = restored_cover_media_id, updated_at = now()
  where id = restored_id;

  -- A restored historical Published revision should remain publishable after
  -- its media IDs are rewritten. Failing here rolls back the whole restore.
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

revoke all on function public.insights_rewrite_restore_media_ids(jsonb, jsonb) from public;
revoke all on function public.insights_restore_revision(uuid, uuid) from public;
grant execute on function public.insights_restore_revision(uuid, uuid) to authenticated;
-- ===== adopted canonical 20260830000000_fix_phase6b3_restore_media_validity.sql =====
-- OCSCO Project Crimson — Phase 6 / Batch 6B3 Restore media validity fix.
--
-- Migration #31 passed the full Insights body envelope to helpers that accept
-- a document node. Those helpers recurse through `content`, not the envelope
-- `doc`, so restored bodies retained historical inline media IDs. The final
-- publishability guard correctly rejected that invalid Draft. This additive
-- correction traverses and rewrites only body.doc before validation.
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
-- Normalize the direct-write boundary after the adoption bundle. Public read
-- grants and existing service-role operational access are intentionally left
-- intact; authenticated clients use the reviewed RPC/policy surface.
revoke insert, update, delete, truncate, references, trigger
  on public.inquiries, public.pages, public.page_sections, public.services,
     public.case_studies, public.case_study_services, public.navigation_items,
     public.site_settings, public.cms_revisions
  from authenticated;

revoke insert, update, delete, truncate, references, trigger
  on public.cms_members
  from authenticated;
grant select on public.cms_members to authenticated;

-- Preserve the audited case-study object boundary and add only the two
-- Insights buckets required by the canonical media contract. No object rows
-- are copied or renamed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('insights-private-media', 'insights-private-media', false, 2097152, array['image/webp']::text[]),
  ('insights-published-media', 'insights-published-media', false, 2097152, array['image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

$phase6_reconciliation$;
end;
$phase6_guard$;

commit;
