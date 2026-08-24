-- Read-only Phase 5B contract-alignment verification for crimson-staging.
-- The validation helpers are immutable. This file performs no persistent DML.

do $$
declare
  rejected boolean;
  document_revision_count integer;
  page_sections_count integer;
  phase5_slice3_applied boolean;
  page_record record;
  page_document_target_definition text;
  generic_publish_definition text;
  page_document_publish_definition text;
  page_document_restore_definition text;
begin
  -- The approved about_people contract has exactly eyebrow, heading, and cta.
  perform public.cms_phase5_validate_section_content(
    'about_people',
    jsonb_build_object(
      'eyebrow', 'The people',
      'heading', 'A test heading',
      'cta', jsonb_build_object(
        'kind', 'route',
        'label', 'Contact us',
        'href', '/contact'
      )
    ),
    'verification.about_people.valid'
  );

  rejected := false;
  begin
    perform public.cms_phase5_validate_section_content(
      'about_people',
      jsonb_build_object(
        'eyebrow', 'The people',
        'heading', 'A test heading',
        'body', 'This field is not part of the approved contract.',
        'cta', jsonb_build_object(
          'kind', 'route',
          'label', 'Contact us',
          'href', '/contact'
        )
      ),
      'verification.about_people.unexpected_body'
    );
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'about_people unexpectedly accepted body';
  end if;

  -- The approved Contact process contract has exactly three title/body items.
  perform public.cms_phase5_validate_section_content(
    'contact_process',
    jsonb_build_object(
      'eyebrow', 'The process',
      'heading', 'What happens next',
      'items', jsonb_build_array(
        jsonb_build_object('title', 'First', 'body', 'One'),
        jsonb_build_object('title', 'Second', 'body', 'Two'),
        jsonb_build_object('title', 'Third', 'body', 'Three')
      ),
      'cta', jsonb_build_object(
        'kind', 'anchor',
        'label', 'Start a conversation',
        'href', '#contact-form'
      )
    ),
    'verification.contact_process.valid'
  );

  rejected := false;
  begin
    perform public.cms_phase5_validate_section_content(
      'contact_process',
      jsonb_build_object(
        'eyebrow', 'The process',
        'heading', 'What happens next',
        'items', jsonb_build_array(
          jsonb_build_object('title', 'First', 'body', 'One', 'prefix', '01'),
          jsonb_build_object('title', 'Second', 'body', 'Two'),
          jsonb_build_object('title', 'Third', 'body', 'Three')
        ),
        'cta', jsonb_build_object(
          'kind', 'anchor',
          'label', 'Start a conversation',
          'href', '#contact-form'
        )
      ),
      'verification.contact_process.unexpected_prefix'
    );
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'contact_process unexpectedly accepted prefix';
  end if;

  rejected := false;
  begin
    perform public.cms_phase5_validate_section_content(
      'contact_process',
      jsonb_build_object(
        'eyebrow', 'The process',
        'heading', 'What happens next',
        'items', jsonb_build_array(
          jsonb_build_object('title', 'First', 'body', 'One'),
          jsonb_build_object('title', 'Second', 'body', 'Two')
        ),
        'cta', jsonb_build_object(
          'kind', 'anchor',
          'label', 'Start a conversation',
          'href', '#contact-form'
        )
      ),
      'verification.contact_process.wrong_cardinality'
    );
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'contact_process unexpectedly accepted fewer than three items';
  end if;

  -- Support both the verified pre-apply baseline and the intentional Slice 3
  -- post-apply state. This keeps the read-only verifier useful while the
  -- owner-controlled migration apply is a separate step.
  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260823030000'
  ) into phase5_slice3_applied;

  -- Directly query the current staging rows; no content conversion is inferred.
  select count(*)
    into page_sections_count
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'page_sections';
  if page_sections_count <> 1 then
    raise exception 'page_sections table is missing';
  end if;

  if not phase5_slice3_applied then
    if exists (
      select 1
      from public.pages
      where slug in ('home', 'services', 'about', 'contact', 'work')
        and jsonb_typeof(content) <> 'array'
    ) then
      raise exception 'One or more required pages are no longer legacy arrays before Slice 3 apply';
    end if;

    select count(*)
      into document_revision_count
    from public.cms_revisions revision
    join public.pages page
      on revision.entity_type = 'page'
     and revision.entity_key = page.id::text
    where page.slug in ('home', 'services', 'about', 'contact', 'work')
      and jsonb_typeof(revision.payload->'content') = 'object';
    if document_revision_count <> 0 then
      raise exception 'PageDocument revisions already exist before Slice 3 apply: %', document_revision_count;
    end if;
  else
    if exists (
      select 1
      from public.pages
      where slug in ('home', 'services', 'about', 'contact')
        and jsonb_typeof(content) <> 'object'
    ) then
      raise exception 'A Phase 5 target page is not a PageDocument after Slice 3 apply';
    end if;

    if jsonb_typeof((select content from public.pages where slug = 'work')) <> 'array' then
      raise exception 'Work is no longer a legacy array after Slice 3 apply';
    end if;

    select count(*)
      into document_revision_count
    from public.cms_revisions revision
    join public.pages page
      on revision.entity_type = 'page'
     and revision.entity_key = page.id::text
    where page.slug in ('home', 'services', 'about', 'contact')
      and revision.status = 'published'
      and jsonb_typeof(revision.payload->'content') = 'object';
    if document_revision_count <> 4 then
      raise exception 'Expected four Published PageDocument snapshots after Slice 3 apply; found %', document_revision_count;
    end if;

    for page_record in
      select slug, title, page_purpose, audience, content
      from public.pages
      where slug in ('home', 'services', 'about', 'contact')
    loop
      perform public.cms_validate_phase5_page_revision_payload(
        page_record.slug,
        jsonb_build_object(
          'title', page_record.title,
          'page_purpose', page_record.page_purpose,
          'audience', page_record.audience,
          'content', page_record.content
        ),
        true
      );
    end loop;

    if not exists (
      select 1 from information_schema.triggers
      where trigger_schema = 'public'
        and trigger_name = 'page_sections_freeze_phase5_updates'
    ) or not exists (
      select 1 from information_schema.triggers
      where trigger_schema = 'public'
        and trigger_name = 'cms_revisions_freeze_phase5_page_sections'
    ) then
      raise exception 'Slice 3 legacy page-section mutation guards are missing';
    end if;
  end if;

  -- Query the deployed RPC definitions to ensure the current PageDocument
  -- contract remains live. Migration #26 superseded the old Slice 2 generic
  -- PageDocument projection: approved PageDocuments now use dedicated RPCs,
  -- while the generic RPC remains a compatibility path for legacy entities.
  select pg_get_functiondef('public.cms_page_document_is_target(text)'::regprocedure)
    into page_document_target_definition;
  if page_document_target_definition not like
    '%p_page_key = any (array[''home'', ''services'', ''about'', ''contact'']::text[])%'
  then
    raise exception 'PageDocument target allowlist is not the approved four-page contract';
  end if;

  if not exists (
    select 1
    from pg_proc proc
    where proc.oid = 'public.cms_save_revision(text, text, text, jsonb)'::regprocedure
      and pg_get_functiondef(proc.oid) like '%cms_validate_phase5_page_revision_payload%'
      and pg_get_functiondef(proc.oid) like '%PageDocument revisions use cms_revisions.status%'
  ) then
    raise exception 'cms_save_revision is not the approved Slice 2 definition';
  end if;

  select pg_get_functiondef('public.cms_publish_revision(uuid)'::regprocedure)
    into generic_publish_definition;
  if generic_publish_definition not like
      '%PageDocument publication requires the dedicated Publish RPC%'
    or generic_publish_definition not like '%public.cms_page_document_is_target%'
    or generic_publish_definition not like '%revision.entity_type = ''site_settings''%'
    or generic_publish_definition not like '%revision.entity_type = ''navigation_item''%'
    or generic_publish_definition not like '%revision.entity_type = ''page_section''%'
    or generic_publish_definition not like '%revision.entity_type = ''service''%'
    or generic_publish_definition not like '%revision.entity_type = ''page''%'
    or generic_publish_definition not like '%revision.entity_type = ''case_study''%'
    or generic_publish_definition not like '%jsonb_typeof(revision.payload->''content'') <> ''array''%'
  then
    raise exception 'cms_publish_revision does not preserve the migration #26 guard and legacy compatibility branches';
  end if;

  if not exists (
    select 1
    from pg_proc proc
    where proc.oid = 'public.cms_restore_revision(uuid)'::regprocedure
      and pg_get_functiondef(proc.oid) like '%return public.cms_save_revision%'
      and pg_get_functiondef(proc.oid) like '%''review''%'
  ) then
    raise exception 'cms_restore_revision is not the approved Slice 2 definition';
  end if;

  -- The old Slice 2 PageDocument projection assertions belong on the
  -- dedicated publisher after migration #26. Verify its owner, Review-only,
  -- stale-protection, pointer, archival, projection, and audit contract.
  select pg_get_functiondef(
    'public.cms_page_document_publish(text, uuid, timestamptz)'::regprocedure
  ) into page_document_publish_definition;
  if page_document_publish_definition not like '%Only the owner can publish PageDocuments%'
    or page_document_publish_definition not like '%public.cms_page_document_is_target%'
    or page_document_publish_definition not like '%revision.status <> ''review''%'
    or page_document_publish_definition not like '%p_expected_updated_at is null%'
    or page_document_publish_definition not like '%revision.updated_at is distinct from p_expected_updated_at%'
    or page_document_publish_definition not like '%cms_validate_phase5_page_revision_payload%'
    or page_document_publish_definition not like '%revision.payload%'
    or page_document_publish_definition not like '%published_revision_id is null%'
    or page_document_publish_definition not like '%set status = ''archived''%'
    or page_document_publish_definition not like '%set status = ''published'',%'
    or page_document_publish_definition not like '%published_revision_id = revision.id%'
    or page_document_publish_definition not like '%publish_archived_previous%'
    or page_document_publish_definition not like '%''published'',%''review'',%''published''%'
    or page_document_publish_definition not like '%opengraph-image%'
    or page_document_publish_definition not like '%cms_write_page_workflow_audit%'
    or page_document_publish_definition not like '%p_page_key%'
  then
    raise exception 'cms_page_document_publish is missing the migration #26 dedicated Publish contract';
  end if;

  -- Restore is also a dedicated PageDocument path. Keep its no-public-change
  -- behavior and Review-only result independently covered by this verifier.
  select pg_get_functiondef(
    'public.cms_page_document_restore(text, uuid)'::regprocedure
  ) into page_document_restore_definition;
  if page_document_restore_definition not like '%Only the owner can restore PageDocuments%'
    or page_document_restore_definition not like '%public.cms_page_document_is_target%'
    or page_document_restore_definition not like '%status in (''published'', ''archived'')%'
    or page_document_restore_definition not like '%cms_validate_phase5_page_revision_payload%'
    or page_document_restore_definition not like '%restore_payload%'
    or page_document_restore_definition not like '%active_revision%'
    or page_document_restore_definition not like '%set status = ''archived''%'
    or page_document_restore_definition not like '%insert into public.cms_revisions%'
    or page_document_restore_definition not like '%''review''%'
    or page_document_restore_definition not like '%published_at%'
    or page_document_restore_definition like '%update public.pages%'
    or page_document_restore_definition like '%published_revision_id =%'
    or page_document_restore_definition not like '%restored_to_review%'
    or page_document_restore_definition not like '%restore_archived_active%'
    or page_document_restore_definition not like '%cms_write_page_workflow_audit%'
  then
    raise exception 'cms_page_document_restore is missing the migration #26 dedicated Restore contract';
  end if;

  -- Publish delegates Service-reference enforcement through the PageDocument
  -- revision validator. Verify each deployed link in that dependency chain
  -- instead of requiring the Service error text inside either Publish RPC.
  if not exists (
    select 1
    from pg_proc proc
    where proc.oid = 'public.cms_validate_phase5_page_revision_payload(text, jsonb, boolean)'::regprocedure
      and pg_get_functiondef(proc.oid) like '%cms_validate_phase5_page_document%'
      and pg_get_functiondef(proc.oid) like '%p_require_published_services%'
  ) then
    raise exception 'PageDocument revision validator does not delegate publication validation';
  end if;

  if not exists (
    select 1
    from pg_proc proc
    where proc.oid = 'public.cms_validate_phase5_page_document(text, jsonb, boolean)'::regprocedure
      and pg_get_functiondef(proc.oid) like '%cms_phase5_validate_section_content%'
      and pg_get_functiondef(proc.oid) like '%home_capabilities%'
      and pg_get_functiondef(proc.oid) like '%public.services%'
      and pg_get_functiondef(proc.oid) like '%status = ''published''%'
      and pg_get_functiondef(proc.oid) like '%published_at is not null%'
      and pg_get_functiondef(proc.oid) like '%published_at <= now()%'
  ) then
    raise exception 'PageDocument validator is missing published Service checks';
  end if;

  if not exists (
    select 1
    from pg_proc proc
    where proc.oid = 'public.cms_phase5_validate_section_content(text, jsonb, text)'::regprocedure
      and pg_get_functiondef(proc.oid) like '%cms_phase5_validate_service_reference%'
  ) then
    raise exception 'Section validator is missing Service-reference structure validation';
  end if;

  if not exists (
    select 1
    from pg_proc proc
    where proc.oid = 'public.cms_phase5_validate_service_reference(jsonb, text)'::regprocedure
      and pg_get_functiondef(proc.oid) like '%array[''kind'', ''slug'']%'
      and pg_get_functiondef(proc.oid) like '%''branding''%'
      and pg_get_functiondef(proc.oid) like '%''website-design-development''%'
      and pg_get_functiondef(proc.oid) like '%''custom-cms''%'
      and pg_get_functiondef(proc.oid) like '%''crm-business-tools''%'
      and pg_get_functiondef(proc.oid) like '%''custom-web-applications''%'
  ) then
    raise exception 'Service-reference validator is missing the approved structure or slug allowlist';
  end if;
end;
$$;

select
  case when exists (
    select 1 from supabase_migrations.schema_migrations where version = '20260823030000'
  ) then 'slice3-applied' else 'pre-slice3-baseline' end as phase5_state,
  slug,
  jsonb_typeof(content) as content_type,
  status
from public.pages
where slug in ('home', 'services', 'about', 'contact', 'work')
order by array_position(array['home', 'services', 'about', 'contact', 'work'], slug);

select count(*) as phase5_pagedocument_count
from public.pages
where slug in ('home', 'services', 'about', 'contact')
  and jsonb_typeof(content) = 'object';

select count(*) as phase5_pagedocument_revision_count
from public.cms_revisions revision
join public.pages page
  on revision.entity_type = 'page'
 and revision.entity_key = page.id::text
where page.slug in ('home', 'services', 'about', 'contact', 'work')
  and jsonb_typeof(revision.payload->'content') = 'object';
