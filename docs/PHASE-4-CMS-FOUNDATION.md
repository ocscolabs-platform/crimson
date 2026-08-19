# Phase 4 — Custom CMS Foundation

**Status:** In progress on `feature/phase-4-cms-foundation`
**Goal:** Establish a secure, structured content foundation that can replace local website content without coupling editorial data to page layout.

## First implementation slice

This slice defines the database boundary for:

- Site settings
- Primary and footer navigation
- Public pages
- OCSCO services
- Case studies and their service relationships

The schema uses explicit editorial states: `draft`, `review`, `published`, and `archived`. Public reads are limited to published records with a valid publication timestamp. Draft and review content must never be returned to anonymous public clients.

## Deliberately out of scope

- Admin UI and authenticated staff accounts
- Role and permission management
- Preview tokens and scheduled publishing jobs
- Media library, uploads, transformations, and CDN policy
- Content version history and audit logs
- CRM contacts, companies, opportunities, or pipeline workflows
- Automatic import of the current local draft copy

These are separate slices because they require additional owner decisions and security review.

## Data boundaries

| Entity | Responsibility | Public read rule |
| --- | --- | --- |
| `site_settings` | One default record for global editorial and contact settings | Default record only |
| `navigation_items` | Ordered primary and footer links | Visible items only |
| `pages` | Structured top-level page content and SEO fields | Published records only |
| `services` | Capability content and service detail fields | Published records only |
| `case_studies` | Approved project stories and proof content | Published records only |
| `case_study_services` | Many-to-many relationship between work and capabilities | Related published records only |

All tables enable Row Level Security. No anonymous or authenticated role receives insert, update, or delete access. The future protected CMS server boundary will use a separately reviewed access policy; it is not created by this migration.

## Staging rollout sequence

1. Review the migration and confirm the content model remains within the approved Phase 1 boundary.
2. Apply `supabase/migrations/20260820000000_create_cms_foundation.sql` and `supabase/migrations/20260820010000_add_service_card_fields.sql` to the dedicated staging project.
3. Verify the tables, indexes, RLS policies, and public published-only reads in Supabase.
4. Run `supabase/seeds/20260820000000_seed_staging_services.sql` in `crimson-staging` only.
5. Add a server-side read boundary in Next.js and replace one local content slice in staging.
6. Review the result before adding admin authentication or applying the migrations to Production.

## Public Work library slice

The next staging slice extends `case_studies` with presentation fields for project type, category, external prototype URL, featured ordering, and sort order. The public Work library reads only published staging records and falls back to the local preview content if the CMS schema or records are unavailable. A generic `/work/[slug]` preview route is included, while approved imagery and full evidence remain deferred.

Apply `supabase/migrations/20260820020000_add_work_presentation_fields.sql` and then run `supabase/seeds/20260820020000_seed_staging_case_studies.sql` in `crimson-staging` only. Do not run the staging seed in Production.

## Global public content slice

The next staging slice connects the shared header navigation, footer positioning statement, page hero copy, and page-level SEO fields to the existing CMS tables. The public application keeps a local fallback until matching published records exist. Run `supabase/seeds/20260820030000_seed_staging_global_content.sql` in `crimson-staging` only; it is intentionally not a Production seed.

The page body sections remain in reviewed application components for now. A protected CMS editor and media library are separate future slices and are not introduced by this read boundary.

## Acceptance criteria

- The migration applies cleanly to staging and can be applied independently to Production later.
- Every CMS table has RLS enabled.
- Anonymous reads can return only intentionally published content.
- Anonymous and authenticated clients cannot mutate CMS records.
- Slugs are unique and stable before publication.
- Pages and services support SEO title, description, and social image fields.
- Case studies support explicit client visibility and evidence-oriented outcome fields.
- No production credentials, unpublished client information, or fabricated content are committed.
