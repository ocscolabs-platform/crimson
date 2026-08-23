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
2. Run the explicit staging global-content seed so the `pages` rows exist.
3. Dispatch `.github/workflows/bootstrap-crimson-staging-page-sections.yml` on the `staging` branch and enter `APPLY_STAGING_PAGE_SECTIONS` when the owner approves the staging-only repair/bootstrap.
4. Confirm the workflow reports exactly five Home rows, one Services row, two About rows, and two Contact rows. Work is excluded.
5. Open `/crimson-admin-control/content` as the staging owner and confirm each page shows its approved section list.
6. Change one non-sensitive section order or visibility setting and confirm the success toast and the public staging route.
7. Confirm the public route follows the saved order and that hiding a section removes only that section.
8. Do not apply this migration or the staging bootstrap to another environment or promote staging-only content to `main` until the relevant release boundary is separately reviewed.

The historical migration creates the fixed table and attempts its initial inserts at migration time. Because the clean staging reset intentionally runs with Supabase seeding disabled, page rows may be created later by the explicit staging global-content seed. The repository-backed bootstrap workflow therefore materializes the same ten rows only after those pages exist. The seed is idempotent, rejects unexpected or conflicting target rows, preserves page content, and never creates a Work row.

