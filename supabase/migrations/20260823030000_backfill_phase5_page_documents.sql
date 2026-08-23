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
