# CMS release architecture reset

## Why the previous model failed

The application had two independent release planes:

- GitHub/Vercel moved application code between `feature/*`, `staging`, and `main`.
- Supabase stored CMS rows, Auth users, Storage objects, inquiries, and audit history outside Git.

Those planes were presented to the owner as if a branch merge would move both. It cannot. A merge can deploy code, but it cannot move database rows, Storage objects, Auth users, or database-generated IDs. The later promotion runner was a valid security boundary, but it was introduced after the workflow had already been designed and it created a second release ceremony with brittle failure modes.

The specific mistakes were:

1. The source of truth for editorial content was not decided before the CMS editor was built.
2. Staging-only CMS Auth and Production public content were treated as one workflow without a clear publish contract.
3. The same Supabase connection currently serves CMS reads/writes, Auth, Storage, and inquiries, which makes simply repointing Preview to Production unsafe.
4. Published records are edited in place. That is acceptable in an isolated staging database, but it is not a safe live-CMS model because moving a record to review can temporarily remove the live version.
5. The promotion runner was patched around operational failures instead of being treated as a temporary migration bridge.

## Correct target model

The target model is a single CMS source of truth with revision-based publishing:

```text
feature/* ──> staging ──> main       = application code
                         │
                         └─ public site reads published CMS revisions

CMS editor (Preview/canonical CMS route) ──> draft/review revision ──owner publish──> published revision
```

The owner edits through the authenticated CMS at `https://ocsco.io/crimson-admin-control`. Preview `/crimson-admin-control` remains available for QA against the same application contract, but it is not the canonical operating URL. Direct `/admin` requests return `404`. Draft and review changes remain invisible to the public website. Publishing is an explicit CMS action that atomically makes one reviewed revision live. Git merges continue to control code releases; they do not pretend to release database content. The staging-to-main code merge has now occurred; Production database and runtime verification remain a separate release gate.

Production public routes remain separate from the authenticated CMS editor. The code merge does not by itself prove that the Production Auth/RLS boundary or CMS runtime is configured correctly; Phase 4C verifies the canonical Production route and boundary before declaring the baseline operational. Public routes read published revisions only, so the public site does not expose drafts or editorial controls.

The post-merge stabilization step is to verify that the Production Supabase project is the canonical CMS source and that the authenticated `/crimson-admin-control` route on `ocsco.io` uses the intended Production boundary. Preview remains a code-QA deployment; its inquiry submissions are disabled by default so test traffic cannot enter the live lead stream. The current staging database and row-copy workflow stay available as a rollback bridge until the revision model has replaced direct editorial writes and the Production path has passed QA.

## Migration sequence

1. Verify the canonical Production CMS boundary migration and owner account; this makes `/crimson-admin-control` a real authenticated route without exposing it to anonymous visitors.
2. Add a revision model and atomic publish functions for site settings, navigation, pages, services, case studies, page sections, and media references.
3. Update the admin reads and writes to work against revisions. Published records remain immutable from normal editing screens.
4. Add a clear owner-only `Publish revision` action and audit event. Preview must show the exact draft/review payload before publication.
5. Keep inquiries isolated from CMS editing while the migration is in progress. Preview inquiry submissions must never silently enter the live lead stream.
6. Run the Production QA matrix: login, roles, draft save, review, publish, restore, media upload/remove, public cache refresh, and inquiry behavior.
7. Migrate or verify the current Production package in the published revision baseline without changing the public output.
8. After verification, remove the temporary promotion workflow, `scripts/cms-promote.mjs`, `cms:promote`, the `production-cms` GitHub environment secrets, and the old promotion instructions; retain only the documented rollback evidence needed for the baseline.

The implementation migrations are `supabase/migrations/20260821020000_add_cms_revisions.sql`, `supabase/migrations/20260821030000_lock_cms_direct_writes.sql`, `supabase/migrations/20260821040000_restore_cms_read_access.sql`, and `supabase/migrations/20260821050000_allow_revision_case_study_publish.sql`. They add the revision ledger, owner-only publish/restore functions, remove the legacy authenticated direct-write grants, explicitly restore authenticated CMS-member reads for environments with incomplete legacy grants, and make the legacy case-study trigger compatible with owner RPC publication. The global-content, Services, and case-study editors now understand active Draft/Review revisions, including case-study metadata, relationships, and media references. Save and Publish are separate actions; a public route continues to read the last published base record until the owner publishes the review revision. The code merge is complete; the remaining task is to verify that the equivalent Production boundary is actually applied and configured before declaring the release stable.

## What is explicitly not being done

- Do not point Preview at Production and keep the current in-place editor. That would make staging edits live and could mix test inquiries with real inquiries.
- Do not delete the current promotion bridge before the revision model is deployed and verified.
- Do not delete either Supabase project during this migration. The existing staging project is a rollback/reference boundary until the new model has passed QA.

## Definition of done

The reset is complete only when an owner can:

1. sign in at `/crimson-admin-control` on the production domain;
2. save and review a revision with an unmistakable status;
3. publish once and see the approved change on Production;
4. restore the previous published revision without copying rows manually; and
5. run ordinary content releases without GitHub Actions, service-role secrets, or a second database synchronization step.
