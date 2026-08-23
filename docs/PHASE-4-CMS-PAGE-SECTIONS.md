# Phase 4 — Approved Page Section Controls

**Status:** Staging implementation in progress

## Scope

This milestone adds a fixed section registry for the public top-level pages: Home, About, Services, Work, and Contact. The CMS can control whether an approved section is visible and its relative order. The public renderer reads the published section registry and falls back to the application defaults if the staging schema is unavailable.

The registry is intentionally not a page builder. Owners cannot create arbitrary section types, upload media, or delete section records. Service detail pages, case-study composition, and CRM surfaces remain separate workflows.

## Role boundary

| Role | Read section configuration | Change visibility/order |
| --- | --- | --- |
| `owner` | All staging sections | Yes |
| `editor` | All staging sections | No; editors continue preparing approved content fields |
| `reviewer` | All staging sections | No |

The database prevents an owner from hiding the last visible section on a page. Every section update is recorded in `cms_global_audit_log` with `entity_type = 'page_section'`.

## Staging rollout

1. Apply `supabase/migrations/20260820110000_add_staging_page_sections.sql` in `crimson-staging` after the global-content editor migration.
2. Run `supabase/seeds/20260820030000_seed_staging_global_content.sql` through the staging seed/bootstrap process. It creates the required `pages` rows first, then includes the guarded Phase 5 section seed.
3. A merge to `staging` that changes the tightly scoped bootstrap workflow or either referenced staging seed triggers `.github/workflows/bootstrap-crimson-staging-page-sections.yml`. The workflow performs the exact staging identity and legacy-array preflight before the seed can write.
4. Confirm the workflow reports exactly five Home rows, one Services row, two About rows, and two Contact rows. Work is excluded.
5. Open `/crimson-admin-control/content` as the staging owner and confirm each page shows its approved section list.
6. Change one non-sensitive section order or visibility setting and confirm the success toast and the public staging route.
7. Confirm the public route follows the saved order and that hiding a section removes only that section.
8. Do not apply this migration or the staging bootstrap to another environment or promote staging-only content to `main` until the relevant release boundary is separately reviewed.

The historical migration creates the fixed table and attempts its initial inserts at migration time. Because the clean staging reset intentionally runs with Supabase seeding disabled, the staging bootstrap sequence must execute the global-content seed after schema creation. That seed creates the four Phase 5 pages and includes the guarded section seed only after those rows exist. The repository-backed push-triggered workflow provides the current owner-approved repair path; its path filter is limited to the bootstrap workflow and the two staging seed definitions. The section seed is idempotent, rejects unexpected or conflicting target rows, preserves page content, and never creates a Work row.

## Temporary Slice 3 execution bridge

`.github/workflows/apply-phase5b-slice3-staging.yml` is a temporary, staging-only execution bridge for the single pending `20260823030000_backfill_phase5_page_documents.sql` migration. Its `staging` push trigger makes an owner-approved merge the execution authorization while keeping the workflow unavailable as a Production or generic migration path. Remove this workflow only in a later Slice 3 closure cleanup PR after the staging apply, verifier run, and execution record have been retained.

