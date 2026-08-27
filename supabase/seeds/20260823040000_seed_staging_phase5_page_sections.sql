-- OCSCO Project Crimson staging-only Phase 5 section bootstrap.
--
-- Run only after the staging global-content seed has created the four target
-- pages. This is intentionally a seed/bootstrap script, not a canonical
-- Supabase migration and must never be run against another environment.

begin;

do $$
declare
  target_page_count integer;
  target_section_count integer;
begin
  select count(*)
    into target_page_count
  from public.pages
  where slug in ('home', 'services', 'about', 'contact');

  if target_page_count <> 4 then
    raise exception 'Phase 5 staging bootstrap requires exactly four target pages';
  end if;

  if exists (
    select slug
    from public.pages
    where slug in ('home', 'services', 'about', 'contact')
    group by slug
    having count(*) <> 1
  ) then
    raise exception 'Phase 5 staging bootstrap found duplicate target page slugs';
  end if;

  if exists (
    select 1
    from public.pages
    where slug in ('home', 'services', 'about', 'contact')
      and jsonb_typeof(content) <> 'array'
  ) then
    raise exception 'Phase 5 staging bootstrap requires legacy array page content';
  end if;

  if exists (
    select 1
    from public.page_sections section
    join public.pages page on page.id = section.page_id
    where page.slug in ('home', 'services', 'about', 'contact')
      and not exists (
        select 1
        from (values
          ('home', 'home_intro', 'The work', 10, true),
          ('home', 'home_capabilities', 'Capabilities', 20, true),
          ('home', 'home_approach', 'How we work', 30, true),
          ('home', 'home_proof', 'Proof of work', 40, true),
          ('home', 'home_contact', 'The next step', 50, true),
          ('services', 'services_capabilities', 'Capabilities', 10, true),
          ('about', 'about_principles', 'Working principles', 10, true),
          ('about', 'about_people', 'The people', 20, true),
          ('contact', 'contact_process', 'What happens next', 10, true),
          ('contact', 'contact_form', 'Start the conversation', 20, true)
        ) as expected(slug, section_key, label, sort_order, is_visible)
        where expected.slug = page.slug
          and expected.section_key = section.section_key
      )
  ) then
    raise exception 'Phase 5 staging bootstrap found unexpected target page_sections rows';
  end if;

  if exists (
    select 1
    from public.page_sections section
    join public.pages page on page.id = section.page_id
    join (values
      ('home', 'home_intro', 'The work', 10, true),
      ('home', 'home_capabilities', 'Capabilities', 20, true),
      ('home', 'home_approach', 'How we work', 30, true),
      ('home', 'home_proof', 'Proof of work', 40, true),
      ('home', 'home_contact', 'The next step', 50, true),
      ('services', 'services_capabilities', 'Capabilities', 10, true),
      ('about', 'about_principles', 'Working principles', 10, true),
      ('about', 'about_people', 'The people', 20, true),
      ('contact', 'contact_process', 'What happens next', 10, true),
      ('contact', 'contact_form', 'Start the conversation', 20, true)
    ) as expected(slug, section_key, label, sort_order, is_visible)
      on expected.slug = page.slug
     and expected.section_key = section.section_key
    where page.slug in ('home', 'services', 'about', 'contact')
      and (section.label, section.sort_order, section.is_visible)
          is distinct from (expected.label, expected.sort_order, expected.is_visible)
  ) then
    raise exception 'Phase 5 staging bootstrap found conflicting target page_sections values';
  end if;

  insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
  select page.id, expected.section_key, expected.label, expected.sort_order, expected.is_visible
  from public.pages page
  join (values
    ('home', 'home_intro', 'The work', 10, true),
    ('home', 'home_capabilities', 'Capabilities', 20, true),
    ('home', 'home_approach', 'How we work', 30, true),
    ('home', 'home_proof', 'Proof of work', 40, true),
    ('home', 'home_contact', 'The next step', 50, true),
    ('services', 'services_capabilities', 'Capabilities', 10, true),
    ('about', 'about_principles', 'Working principles', 10, true),
    ('about', 'about_people', 'The people', 20, true),
    ('contact', 'contact_process', 'What happens next', 10, true),
    ('contact', 'contact_form', 'Start the conversation', 20, true)
  ) as expected(slug, section_key, label, sort_order, is_visible)
    on expected.slug = page.slug
  where not exists (
    select 1
    from public.page_sections existing
    where existing.page_id = page.id
      and existing.section_key = expected.section_key
  );

  select count(*)
    into target_section_count
  from public.page_sections section
  join public.pages page on page.id = section.page_id
  where page.slug in ('home', 'services', 'about', 'contact');

  if target_section_count <> 10 then
    raise exception 'Phase 5 staging bootstrap did not materialize exactly ten target rows';
  end if;
end;
$$;

commit;

