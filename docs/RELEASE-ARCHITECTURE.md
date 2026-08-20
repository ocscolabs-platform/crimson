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

CMS editor (Preview/admin) ──> draft/review revision ──owner publish──> published revision
```

The owner edits through the authenticated CMS at `https://ocsco.io/admin`. Preview `/admin` remains available for QA against the same application contract, but it is not the canonical operating URL. Draft and review changes remain invisible to the public website. Publishing is an explicit CMS action that atomically makes one reviewed revision live. Git merges continue to control code releases; they do not pretend to release database content.

The Production `/admin` route is protected by Supabase Auth and CMS roles. Unauthenticated visitors are sent to the login screen; authenticated users can only access the records and actions allowed by their role. Public routes read published revisions only, so making `/admin` available on the production domain does not expose drafts or editorial controls to public visitors.

The first rollout step is to make the Production Supabase project the canonical CMS source and expose the authenticated `/admin` route on `ocsco.io`. Preview remains a code-QA deployment; its inquiry submissions are disabled by default so test traffic cannot enter the live lead stream. The current staging database and row-copy workflow stay available as a rollback bridge until the revision model has replaced direct editorial writes.

## Migration sequence

1. Apply the canonical Production CMS boundary migration and provision the owner account; this makes `/admin` a real authenticated route without exposing it to anonymous visitors.
2. Add a revision model and atomic publish functions for site settings, navigation, pages, services, case studies, page sections, and media references.
3. Update the admin reads and writes to work against revisions. Published records remain immutable from normal editing screens.
4. Add a clear owner-only `Publish revision` action and audit event. Preview must show the exact draft/review payload before publication.
5. Keep inquiries isolated from CMS editing while the migration is in progress. Preview inquiry submissions must never silently enter the live lead stream.
6. Run a staging QA matrix: login, roles, draft save, review, publish, restore, media upload/remove, public cache refresh, and inquiry behavior.
7. Migrate the current Production package into the published revision baseline without changing the public output.
8. After verification, remove the temporary promotion workflow, `scripts/cms-promote.mjs`, `cms:promote`, the `production-cms` GitHub environment secrets, and the old promotion instructions.

## What is explicitly not being done

- Do not point Preview at Production and keep the current in-place editor. That would make staging edits live and could mix test inquiries with real inquiries.
- Do not delete the current promotion bridge before the revision model is deployed and verified.
- Do not delete either Supabase project during this migration. The existing staging project is a rollback/reference boundary until the new model has passed QA.

## Definition of done

The reset is complete only when an owner can:

1. sign in at `/admin` on the production domain;
2. save and review a revision with an unmistakable status;
3. publish once and see the approved change on Production;
4. restore the previous published revision without copying rows manually; and
5. run ordinary content releases without GitHub Actions, service-role secrets, or a second database synchronization step.
