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
