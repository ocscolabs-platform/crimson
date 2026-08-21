# Deployment Model

## Intended branch and environment flow

```text
feature/* → Vercel preview deployment
staging   → staging environment
main      → production environment
```

Feature branches should be used for active development and review. The `staging` branch is the integration and review point before production. The `main` branch represents production and should not be used as an experimentation branch.

## Current deployment

The `main` branch is connected to Vercel and the production deployment is publicly available at [ocsco-project-crimson.vercel.app](https://ocsco-project-crimson.vercel.app/). The `ocsco.io` and `www.ocsco.io` domains are assigned to the Vercel Production environment, and the website DNS now points to Vercel. WordPress email records remain in place.

## Environment separation

Preview/Staging and Production must eventually use separate environment configurations. Production secrets must not be shared indiscriminately with preview or staging deployments. Supabase projects, keys, storage policies, authentication settings, and other external resources should be selected explicitly for the environment being deployed.

The repository intentionally does not contain account IDs, deployment URLs, domains, credentials, or environment values. Human owners will need to supply those values through GitHub/Vercel/Supabase configuration when the integrations are approved.

The current release contract is [`RELEASE-READINESS.md`](./RELEASE-READINESS.md). It supersedes older rollout notes where they describe row copying as the normal way to publish content.

## CMS publication boundary

The staging CMS and the Production public website use separate Supabase projects. Git promotion moves code only; it does not move CMS rows, Auth users, Storage objects, or database IDs. The one-time Production CMS boundary is defined in [`CMS-PROMOTION.md`](./CMS-PROMOTION.md) and [`20260821000000_create_production_cms_boundary.sql`](../supabase/migrations/20260821000000_create_production_cms_boundary.sql).

The guarded GitHub `production-cms` workflow and `scripts/cms-promote.mjs` remain only as a temporary migration bridge. They are dry-run by default and require an explicit apply input, but they must not be used as the steady-state content release process once Production revision publishing is verified. Production service-role credentials must remain server-side and must never be placed in browser variables or the repository.

## Remaining owner configuration

- Configure GitHub branch protection for `feature/*`, `staging`, and `main`.
- Keep Preview/Staging and Production variables separate and rotate keys independently.
- Keep WordPress hosting available during the short rollback window, then cancel it after final owner confirmation.

Vercel authorization was completed after the foundation was approved. The owner has configured separate Production Supabase and Resend resources in Vercel, completed a controlled submission, and switched the website DNS to Vercel.

## Staging contact-form configuration

The staging `/contact` form writes validated submissions to the `public.inquiries` table in the dedicated `crimson-staging` Supabase project through the server-side `/api/inquiries` route. Configure these variables in Vercel for the Preview environment only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` — server-only; never expose this in client code or commit it
- `RESEND_API_KEY` — server-only; use a sending-only key where available
- `INQUIRY_NOTIFICATION_EMAIL` — owner inbox for new inquiry notifications
- `INQUIRY_NOTIFICATION_FROM` — verified sender, or `OCSCO inquiries <onboarding@resend.dev>` for the initial Resend account-owner test

Do not add these values to the repository. Production uses separate values from Preview/Staging.

## Production contact-form configuration

The Production `/contact` form uses the selected clean Production Supabase project and the verified `send.ocsco.io` Resend sending domain. The six required variables are configured in Vercel under Production only, and the owner has confirmed database storage and email delivery.

## Staging CMS authentication

Editorial editing, publishing, and draft access are tested in staging before the Production CMS boundary is enabled. The canonical authenticated path is `/crimson-admin-control`; direct `/admin` and `/admin/*` requests return `404`. Production CMS access must use the Production Supabase project and the same revision contract after the Production migration is verified.

The application uses the environment-specific Supabase URL and publishable key through cookie-based Supabase SSR sessions. Password reset emails must use the canonical `/crimson-admin-control/auth/callback` route, and each Supabase project must allow its own callback URL. No service-role key is used by browser code.

The first staging write slice is the service editor. Apply `supabase/migrations/20260820050000_add_staging_service_editor_policies.sql` only after the CMS membership migration is active in `crimson-staging`. It grants authenticated database insert/update privileges only where RLS permits them: owners can manage service status, editors can work with draft/review records, and reviewers remain read-only. Do not run this migration in Production.

The audit safeguard migration is the next staging-only dependency. Apply `supabase/migrations/20260820060000_add_staging_cms_audit.sql` only after the service editor policy migration. It adds database-generated immutable service history, owner-only publication/archival defense in depth, and review-before-publish enforcement. Do not run this migration in Production.

The case-study audit migration is the next staging-only dependency after the service audit migration. Apply `supabase/migrations/20260820070000_add_staging_case_study_audit.sql` in `crimson-staging` only. It records case-study and case-study/service relationship changes but does not enable any case-study write policy or editor. Follow [`PHASE-4-CMS-CASE-STUDY-AUDIT.md`](./PHASE-4-CMS-CASE-STUDY-AUDIT.md) for read-only verification. Do not run this migration in Production.

The case-study media contract migration follows the case-study audit migration. Apply `supabase/migrations/20260820080000_add_staging_case_study_media_contract.sql` in `crimson-staging` only. It validates relative image paths, alternative text, media review states, and the single published featured-project rule. It does not create storage, upload policies, case-study write policies, or editor controls. Follow [`PHASE-4-CMS-MEDIA-CONTRACT.md`](./PHASE-4-CMS-MEDIA-CONTRACT.md) for verification. Do not run this migration in Production.

The controlled case-study editor migration follows the media contract migration. Apply `supabase/migrations/20260820090000_add_staging_case_study_editor_policies.sql` in `crimson-staging` only. It enables update-only owner/editor content preparation, owner publication/archive, and owner-only client-visibility approval. It does not add inserts, deletes, relationship writes, media uploads, or Production access. Follow [`PHASE-4-CMS-CASE-STUDY-EDITOR.md`](./PHASE-4-CMS-CASE-STUDY-EDITOR.md) for the staging workflow. Do not run this migration in Production.

The restore workflow uses existing audit snapshots and requires no additional database migration. It is owner-only, restores content as `review`, clears publication timestamps, and never republishes automatically. Keep it in staging until rollback requirements are reviewed.

Before testing the route, the owner must create the intended staff user in the `crimson-staging` Supabase project under **Authentication → Users** and add the staging deployment URL to **Authentication → URL Configuration**. Do not add the production domain to the staging auth configuration. Editing, publishing, draft access, and production admin access are not enabled.
