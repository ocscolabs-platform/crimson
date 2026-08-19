-- OCSCO Project Crimson global public content seed.
-- Run in crimson-staging only. Do not run this seed in Production.

insert into public.site_settings (
  id,
  site_name,
  positioning_statement,
  default_seo_title,
  default_seo_description,
  default_og_image_path,
  primary_contact_path
)
values (
  'default',
  'OCSCO',
  'Strategy, design, and technology for brands ready to move with precision.',
  'OCSCO — Strategy, design, and technology',
  'Strategy, design, and technology for brands ready to move with precision.',
  '/opengraph-image',
  '/contact'
)
on conflict (id) do update set
  site_name = excluded.site_name,
  positioning_statement = excluded.positioning_statement,
  default_seo_title = excluded.default_seo_title,
  default_seo_description = excluded.default_seo_description,
  default_og_image_path = excluded.default_og_image_path,
  primary_contact_path = excluded.primary_contact_path;

delete from public.navigation_items
where navigation_group in ('primary', 'footer');

insert into public.navigation_items (label, href, navigation_group, sort_order, is_visible)
values
  ('Services', '/services', 'primary', 10, true),
  ('Work', '/work', 'primary', 20, true),
  ('About', '/about', 'primary', 30, true),
  ('Contact', '/contact', 'primary', 40, true);

insert into public.pages (
  title,
  slug,
  seo_title,
  seo_description,
  content,
  status,
  published_at,
  last_reviewed_at
)
values
  (
    'Home', 'home', 'OCSCO — Strategy, design, and technology',
    'Strategy, design, and technology for brands ready to move with precision.',
    jsonb_build_array(jsonb_build_object(
      'eyebrow', 'Strategy / Design / Technology',
      'title', 'Digital infrastructure for brands ready to move with precision.',
      'intro', 'OCSCO integrates strategy, design, and technology to build digital systems that make ambitious businesses clearer, stronger, and ready for what comes next.'
    )), 'published', now(), now()
  ),
  (
    'About', 'about', 'About', 'The thinking and working principles behind OCSCO.',
    jsonb_build_array(jsonb_build_object(
      'eyebrow', 'The thinking',
      'title', 'Clarity is not a presentation layer. It is how the work gets built.',
      'intro', 'OCSCO brings strategy, design, and technology into one connected practice for organizations that need their digital presence to work harder.'
    )), 'published', now(), now()
  ),
  (
    'Services', 'services', 'Services', 'Explore OCSCO''s proposed capabilities across strategy, design, and technology.',
    jsonb_build_array(jsonb_build_object(
      'eyebrow', 'Capabilities',
      'title', 'One connected system for the work that matters.',
      'intro', 'OCSCO brings strategy, design, and technology together so the parts of your digital presence reinforce one another.'
    )), 'published', now(), now()
  ),
  (
    'Work', 'work', 'Work', 'A preview of OCSCO prototypes and selected projects in preparation.',
    jsonb_build_array(jsonb_build_object(
      'eyebrow', 'Proof of work',
      'title', 'The work deserves the space to speak for itself.',
      'intro', 'A preview of live prototypes and upcoming projects. Full case studies will be added as facts, outcomes, media, and publication permissions are approved.'
    )), 'published', now(), now()
  ),
  (
    'Contact', 'contact', 'Contact', 'Start a conversation with OCSCO.',
    jsonb_build_array(jsonb_build_object(
      'eyebrow', 'The next step',
      'title', 'Bring us the thing that needs to work better.',
      'intro', 'Start with a conversation. We will bring clarity to the opportunity, the path, and what it will take to build well.'
    )), 'published', now(), now()
  )
on conflict (slug) do update set
  title = excluded.title,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  content = excluded.content,
  status = excluded.status,
  published_at = excluded.published_at,
  last_reviewed_at = excluded.last_reviewed_at;
