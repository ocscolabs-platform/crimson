-- Approved staging seed for the first CMS-managed public content slice.
-- Run this manually in crimson-staging only. Do not run in Production.

insert into public.services (
  name,
  card_name,
  slug,
  short_description,
  audience,
  outcome,
  status,
  published_at,
  last_reviewed_at
)
values
  (
    'Branding',
    'Brand strategy',
    'branding',
    'Positioning and identity systems that give the quality of your business a clear, credible expression.',
    'Teams whose business has outgrown its current identity or market position.',
    'A sharper identity and a clearer foundation for every customer touchpoint.',
    'published',
    now(),
    now()
  ),
  (
    'Website design & development',
    'Digital experiences',
    'website-design-development',
    'High-performing digital experiences that turn clarity into trust and trust into momentum.',
    'Organizations that need their public presence to match the quality of their work.',
    'A digital experience built around understanding, credibility, and action.',
    'published',
    now(),
    now()
  ),
  (
    'Custom CMS',
    'Content systems',
    'custom-cms',
    'Content systems shaped around how your team actually works, publishes, and grows.',
    'Teams with structured content needs that do not fit a generic publishing workflow.',
    'More control, less friction, and a content foundation that can evolve with the business.',
    'published',
    now(),
    now()
  ),
  (
    'CRM & business tools',
    'Business workflows',
    'crm-business-tools',
    'Purpose-built workflows that reduce friction and help your team operate with more signal.',
    'Organizations ready to replace disconnected workarounds with a coherent operating system.',
    'Clearer workflows and tools that reflect the way the business actually operates.',
    'published',
    now(),
    now()
  ),
  (
    'Custom web applications',
    'Web applications',
    'custom-web-applications',
    'When an off-the-shelf answer is not enough, we architect the application your process needs.',
    'Teams with unique workflows, data, or customer experiences that need a bespoke solution.',
    'A durable application boundary built around the work, not around a template.',
    'published',
    now(),
    now()
  )
on conflict (slug) do nothing;
