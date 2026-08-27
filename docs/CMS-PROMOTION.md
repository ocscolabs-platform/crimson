# CMS promotion: staging to Production

> **Deferred Production release gate — transitional bridge:** This runner is retained only until the Production revision-based CMS workflow, rollback path, and public read boundary are verified. It is not the normal editorial publishing mechanism. Do not run it for ordinary content updates; retire it after the deferred Production release gate closes, or document an explicit rollback exception.

> **Database release boundary:** This document governs the temporary CMS row-copy bridge only. Database schema, RLS, functions, triggers, grants, and Storage policies are released through the canonical `supabase/migrations` history and the approval-gated `.github/workflows/supabase-release.yml` pipeline. The bridge must never be used to recreate database architecture.

The public website and the editing CMS are intentionally separate:

```text
staging Supabase + staging CMS editor
                 │
                 │ owner-triggered, approved-content promotion
                 ▼
Production Supabase + public website
```

Git promotion moves application code. It does not copy Supabase rows, Auth users, Storage objects, or database-generated IDs. The repository now includes a controlled promotion runner so the owner does not need to copy CMS records manually.

## What is promoted

The runner reads the current published package from the source project and promotes:

- the default site settings record;
- visible and hidden navigation records;
- published pages and fixed page-section settings;
- published services;
- published case studies, including only approved media;
- case-study/service relationships, matched by stable slugs rather than UUIDs;
- approved WebP media in the `case-study-media` bucket.

It never promotes CMS members, Auth users, inquiries, audit logs, unpublished records, or staging credentials. It does not delete records that exist only in Production. This is deliberate: cleanup is a separate, explicit release decision.

## One-time owner setup

1. In the clean Production Supabase project, open **SQL Editor** and run the repository migration [`supabase/migrations/20260821000000_create_production_cms_boundary.sql`](../supabase/migrations/20260821000000_create_production_cms_boundary.sql).
2. Confirm that the migration creates the seven public CMS tables and the private `case-study-media` bucket.
3. In GitHub, open **Settings → Environments** and create an environment named `production-cms`. Add these four environment secrets there:

   - `CMS_SOURCE_SUPABASE_URL` — the `crimson-staging` Supabase URL;
   - `CMS_SOURCE_SUPABASE_SERVICE_ROLE_KEY` — the `crimson-staging` service-role key;
   - `CMS_TARGET_SUPABASE_URL` — the clean Production Supabase URL;
   - `CMS_TARGET_SUPABASE_SERVICE_ROLE_KEY` — the Production service-role key.

   Keep all four values in GitHub Environment Secrets. Do not put them in `.env.local`, Vercel client variables, the repository, or screenshots. The workflow only exposes them to the server-side GitHub runner.

4. Add at least one required reviewer to the `production-cms` environment if the GitHub plan supports environment protection. This makes the final `apply` run owner-controlled.

## Running an exceptional bridge release

1. Open **Actions → Promote approved CMS content → Run workflow** on the `main` branch only when the Phase 4C release procedure explicitly calls for this transitional bridge.
2. Run it first with `apply` unchecked. This is a read-only preflight and reports the records, relationships, and media that would be copied.
3. Review the output and confirm the staging owner has already approved the package.
4. Run the workflow again with `apply` checked. The workflow requires the explicit internal confirmation string and writes the package to Production.
5. Verify the Production public routes and the featured/supporting media. The canonical authenticated CMS route is `/crimson-admin-control`; `/admin` and `/admin/*` must remain normal 404 responses. This bridge does not replace the revision-based CMS workflow.

Production `/admin` requests return `404` and are never redirected to the CMS. This keeps the generic namespace out of the public route surface; authentication, membership, and RLS remain the actual security controls.

The local equivalent is dry-run by default:

```powershell
npm run cms:promote
```

Apply mode is intentionally guarded:

```powershell
$env:CMS_PROMOTION_CONFIRM = "PROMOTE_TO_PRODUCTION"
npm run cms:promote -- --apply
```

Use the GitHub workflow for normal releases so the credentials are not stored on a developer laptop.

## Failure behavior

The runner fails before writing if a source record is not published, a published case study has incomplete approved media, a target slug cannot be matched for a relationship, or a required schema/bucket is missing. Uploads are idempotent and use the same validated storage paths. A failed run must be reviewed before retrying; it does not silently fall back to local content or change Production through the browser.
