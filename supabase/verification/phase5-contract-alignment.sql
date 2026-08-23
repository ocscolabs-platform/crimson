-- Read-only Phase 5B contract-alignment verification for crimson-staging.
-- The validation helpers are immutable. This file performs no persistent DML.

do $$
declare
  rejected boolean;
  document_revision_count integer;
  page_sections_count integer;
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

  -- Directly query the current staging rows; no content conversion is inferred.
  select count(*)
    into page_sections_count
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'page_sections';
  if page_sections_count <> 1 then
    raise exception 'page_sections table is missing';
  end if;

  if exists (
    select 1
    from public.pages
    where slug in ('home', 'services', 'about', 'contact', 'work')
      and jsonb_typeof(content) <> 'array'
  ) then
    raise exception 'One or more required pages are no longer legacy arrays';
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
    raise exception 'PageDocument revisions already exist: %', document_revision_count;
  end if;

  -- Query the deployed RPC definitions to ensure Slice 2 behavior remains live.
  if not exists (
    select 1
    from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = 'cms_save_revision'
      and pg_get_function_identity_arguments(proc.oid) = 'text, text, text, jsonb'
      and pg_get_functiondef(proc.oid) like '%cms_validate_phase5_page_revision_payload%'
      and pg_get_functiondef(proc.oid) like '%PageDocument revisions use cms_revisions.status%'
  ) then
    raise exception 'cms_save_revision is not the approved Slice 2 definition';
  end if;

  if not exists (
    select 1
    from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = 'cms_publish_revision'
      and pg_get_function_identity_arguments(proc.oid) = 'uuid'
      and pg_get_functiondef(proc.oid) like '%PageDocument publication is atomic and does not publish page_sections%'
      and pg_get_functiondef(proc.oid) like '%opengraph-image%'
  ) then
    raise exception 'cms_publish_revision is not the approved Slice 2 definition';
  end if;

  if not exists (
    select 1
    from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = 'cms_restore_revision'
      and pg_get_function_identity_arguments(proc.oid) = 'uuid'
      and pg_get_functiondef(proc.oid) like '%return public.cms_save_revision%'
      and pg_get_functiondef(proc.oid) like '%''review''%'
  ) then
    raise exception 'cms_restore_revision is not the approved Slice 2 definition';
  end if;
end;
$$;

select slug, jsonb_typeof(content) as content_type, status
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
