-- Approved staging preview content for the public Work library.
-- Run this manually in crimson-staging only. Do not run in Production.

insert into public.case_studies (
  project_name,
  slug,
  client_visibility,
  summary,
  project_type,
  project_category,
  external_url,
  is_featured,
  sort_order,
  status,
  published_at,
  last_reviewed_at
)
values
  (
    'CIMET Law',
    'cimet-law',
    'hidden',
    'The featured OCSCO project in preparation. Approved project story, imagery, and outcomes will be added as the work is published.',
    'upcoming',
    'Upcoming build',
    null,
    true,
    1,
    'published',
    now(),
    now()
  ),
  (
    'Cairnstack',
    'cairnstack',
    'hidden',
    'A live prototype exploring a software ecosystem for traceability and operational visibility.',
    'prototype',
    'Platform ecosystem',
    'https://cairnstack.netlify.app/',
    false,
    2,
    'published',
    now(),
    now()
  ),
  (
    'TRXIO',
    'trxio',
    'hidden',
    'A live prototype exploring calm, exact inventory operations and item-level visibility.',
    'prototype',
    'Inventory platform',
    'https://css-trxio.netlify.app/',
    false,
    3,
    'published',
    now(),
    now()
  ),
  (
    'TooFarts',
    'toofarts',
    'hidden',
    'A live commerce prototype for a distinctive product and content experience.',
    'prototype',
    'Commerce experience',
    'https://toofarts-web.vercel.app/',
    false,
    4,
    'published',
    now(),
    now()
  ),
  (
    'Membership portal',
    'membership-portal',
    'hidden',
    'An upcoming membership experience. Final scope, content, and approved outcomes will be added during the build.',
    'upcoming',
    'Web application',
    null,
    false,
    5,
    'published',
    now(),
    now()
  )
on conflict (slug) do nothing;
