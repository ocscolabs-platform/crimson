-- Disposable Migration #33 fixture only.
-- Synthetic values; never run against staging or Production.

begin;

do $$
declare
  instance_id uuid;
begin
  select id into instance_id from auth.instances limit 1;
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
  values
    ('00000000-0000-0000-0000-000000000101', instance_id, 'authenticated', 'authenticated', 'owner.fixture@example.invalid', 'fixture-only', now()),
    ('00000000-0000-0000-0000-000000000102', instance_id, 'authenticated', 'authenticated', 'editor.fixture@example.invalid', 'fixture-only', now())
  on conflict (id) do nothing;
end;
$$;

insert into public.cms_members (user_id, role)
values
  ('00000000-0000-0000-0000-000000000101', 'owner'),
  ('00000000-0000-0000-0000-000000000102', 'editor');

insert into public.inquiries (name, email, company, capability, message, status, source)
values
  ('Fixture Owner', 'inquiry.fixture@example.invalid', 'Fixture Co', 'systems', 'Synthetic inquiry content for disposable migration proof.', 'new', 'fixture');

insert into public.site_settings (id, site_name, positioning_statement, default_seo_title, default_seo_description, primary_contact_path)
values ('default', 'Fixture Site', 'Synthetic baseline', 'Fixture title', 'Synthetic description', '/contact');

insert into public.navigation_items (label, href, navigation_group, sort_order, is_visible)
values
  ('Services', '/services', 'primary', 10, true),
  ('Work', '/work', 'primary', 20, true),
  ('About', '/about', 'primary', 30, true),
  ('Contact', '/contact', 'primary', 40, true);

insert into public.pages (title, slug, page_purpose, audience, seo_title, seo_description, content, status, published_at, last_reviewed_at)
values
  ('Fixture Home', 'home', 'Synthetic home', 'Synthetic audience', 'Fixture Home', 'Fixture Home Description', jsonb_build_array(jsonb_build_object('eyebrow', 'Fixture', 'title', 'Fixture Home', 'intro', 'Synthetic home introduction.')), 'published', now(), now()),
  ('Fixture Services', 'services', 'Synthetic services', 'Synthetic audience', 'Fixture Services', 'Fixture Services Description', jsonb_build_array(jsonb_build_object('eyebrow', 'Fixture', 'title', 'Fixture Services', 'intro', 'Synthetic services introduction.')), 'published', now(), now()),
  ('Fixture About', 'about', 'Synthetic about', 'Synthetic audience', 'Fixture About', 'Fixture About Description', jsonb_build_array(jsonb_build_object('eyebrow', 'Fixture', 'title', 'Fixture About', 'intro', 'Synthetic about introduction.')), 'published', now(), now()),
  ('Fixture Contact', 'contact', 'Synthetic contact', 'Synthetic audience', 'Fixture Contact', 'Fixture Contact Description', jsonb_build_array(jsonb_build_object('eyebrow', 'Fixture', 'title', 'Fixture Contact', 'intro', 'Synthetic contact introduction.')), 'published', now(), now()),
  ('Fixture Work', 'work', 'Synthetic work', 'Synthetic audience', 'Fixture Work', 'Fixture Work Description', jsonb_build_array(jsonb_build_object('eyebrow', 'Fixture', 'title', 'Fixture Work', 'intro', 'Synthetic work introduction.')), 'published', now(), now());

insert into public.services (name, slug, short_description, audience, deliverables, status, published_at, last_reviewed_at)
values
  ('Fixture Service One', 'branding', 'Synthetic service one.', 'Synthetic audience', '[]'::jsonb, 'published', now(), now()),
  ('Fixture Service Two', 'website-design-development', 'Synthetic service two.', 'Synthetic audience', '[]'::jsonb, 'published', now(), now()),
  ('Fixture Service Three', 'custom-cms', 'Synthetic service three.', 'Synthetic audience', '[]'::jsonb, 'published', now(), now()),
  ('Fixture Service Four', 'crm-business-tools', 'Synthetic service four.', 'Synthetic audience', '[]'::jsonb, 'published', now(), now()),
  ('Fixture Service Five', 'custom-web-applications', 'Synthetic service five.', 'Synthetic audience', '[]'::jsonb, 'published', now(), now());

insert into public.case_studies (project_name, slug, client_visibility, project_type, project_category, summary, deliverables, outcomes, supporting_media, status, published_at, last_reviewed_at)
values
  ('Fixture Case One', 'fixture-case-one', 'hidden', 'case-study', 'Synthetic', 'Synthetic case one.', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'published', now(), now()),
  ('Fixture Case Two', 'fixture-case-two', 'hidden', 'prototype', 'Synthetic', 'Synthetic case two.', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'published', now(), now()),
  ('Fixture Case Three', 'fixture-case-three', 'hidden', 'prototype', 'Synthetic', 'Synthetic case three.', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'published', now(), now()),
  ('Fixture Case Four', 'fixture-case-four', 'hidden', 'upcoming', 'Synthetic', 'Synthetic case four.', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'published', now(), now()),
  ('Fixture Case Five', 'fixture-case-five', 'hidden', 'upcoming', 'Synthetic', 'Synthetic case five.', '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'published', now(), now());

insert into public.case_study_services (case_study_id, service_id)
select case_study.id, service.id
from public.case_studies case_study, public.services service
where case_study.slug = 'fixture-case-one' and service.slug = 'branding';

insert into public.page_sections (page_id, section_key, label, sort_order, is_visible)
select page.id, expected.section_key, expected.label, expected.sort_order, true
from public.pages page
join (values
  ('home', 'home_intro', 'Fixture intro', 10),
  ('home', 'home_capabilities', 'Fixture capabilities', 20),
  ('home', 'home_approach', 'Fixture approach', 30),
  ('home', 'home_proof', 'Fixture proof', 40),
  ('home', 'home_contact', 'Fixture contact', 50),
  ('services', 'services_capabilities', 'Fixture capabilities', 10),
  ('about', 'about_principles', 'Fixture principles', 10),
  ('about', 'about_people', 'Fixture people', 20),
  ('contact', 'contact_process', 'Fixture process', 10),
  ('contact', 'contact_form', 'Fixture form', 20)
) as expected(slug, section_key, label, sort_order) on expected.slug = page.slug;

insert into storage.objects (bucket_id, name, metadata)
values
  ('case-study-media', 'case-studies/fixture-one/one.webp', '{"mimetype":"image/webp"}'::jsonb),
  ('case-study-media', 'case-studies/fixture-one/two.webp', '{"mimetype":"image/webp"}'::jsonb),
  ('case-study-media', 'case-studies/fixture-two/one.webp', '{"mimetype":"image/webp"}'::jsonb);

commit;
