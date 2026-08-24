# OCSCO Project Crimson — Work Package A / Batch 3B

## Owner Publish application implementation report

**Date:** 2026-08-25  
**Status:** PASS for scoped implementation and PR; exact responsive viewport verification is BLOCKED by the available in-app browser controls.  
**Branch:** `codex/phase5-wpa-batch3b-publish`  
**Head:** `8a7c21f3f5d0c69a21531e74d99df36b65d66acf`  
**Base:** verified `staging` at `973097d883a80fced31ca2902c4b618d4a00a2ef`

## Scope and guardrails

Implemented only the Batch 3B Owner-only PageDocument Publish application workflow. No live Publish was submitted. No Restore action was added or called. The protected Homepage Review, migration #26, Supabase data, Production, environment configuration, and public content loaders were not changed.

The staging PR is [#71](https://github.com/ocscolabs-platform/crimson/pull/71), with base `staging`. All 3 required checks passed after the report commit. The PR remains open and unmerged.

## Exact PR diff scope

GitHub reports 8 changed files: the 7 approved Batch 3B application/validation files below plus this required report:

- `package.json`
- `scripts/test-phase5a-application-workflow.mjs`
- `scripts/test-phase5b-wpa-batch3b-publish.mjs`
- `src/app/admin/content/pages/[pageKey]/page.tsx`
- `src/app/admin/content/pages/_components/PageDocumentPublishControl.tsx`
- `src/app/admin/content/pages/actions.ts`
- `src/app/globals.css`
- `OCSCO-CRIMSON-WPA-BATCH3B-PUBLISH-IMPLEMENTATION.md`

No migration, environment, Vercel, Production, or unrelated application files are in the PR.

## Backend and authorization result

- Added a dedicated `publishPageDocument` server action.
- The action requires an authenticated CMS Owner; Editor and Reviewer roles do not receive a callable Publish action.
- It calls only `cms_page_document_publish`.
- It passes the exact Review values as `p_page_key`, `p_revision_id`, and `p_expected_updated_at`.
- The action does not call generic publish logic or Restore.
- Stale `updated_at`, inactive Review, invalid revision, and other failures map to safe user-facing messages; raw database error text is not returned.
- Successful completion revalidates the CMS page/index and the associated public route.

## UI and workflow result

- The control is rendered only for an Owner viewing a valid active Review.
- The label is `Publish changes`.
- Confirmation names the page, revision, public-site effect, Review → Published transition, and previous Published → Archived transition.
- No typed confirmation phrase is required.
- Submit is disabled while pending and a local submit lock prevents repeat submission.
- Cancel closes the confirmation without invoking the server action.
- No Restore control or Restore dialog is present.

## History, audit, and public isolation

- Existing history remains authoritative through `pages.published_revision_id`.
- The existing model presents the newly Published revision and previous Archived revision after a future successful Publish.
- Existing audit presentation supports `publish_archived_previous` and `published` as human-readable events.
- Public PageDocument loaders remain explicitly Published-only. No public loader was changed.

## Protected Homepage verification

Read-only Owner QA on the feature Preview confirmed:

- Current state remains `review`.
- Review revision remains `4d552d8b-b231-4ebd-98cc-882c10d20bfb`.
- Editorial headline remains `Digital infrastructure, built with precision.`
- Public headline remains `Digital infrastructure for brands ready to move with precision.`
- Published pointer remains `c26b7cca-f054-4638-9fc1-8d96444d2a43`.
- Review content remains read-only.
- `Publish changes` and `Return to Draft` are visible to the Owner.
- Restore is absent.
- The confirmation was opened and showed the correct revision and transition text.
- Cancel closed the confirmation. Publish was not confirmed or submitted.

## Preview and public smoke QA

Feature Preview for the implementation commit: https://ocsco-project-crimson-1grjp239t-ocscolabs-platforms-projects.vercel.app  
Current PR-head Preview: https://ocsco-project-crimson-npnl74z72-ocscolabs-platforms-projects.vercel.app  
Vercel status: Ready / Preview.

Read-only public smoke checks passed without application or runtime errors:

- `/` — `Digital infrastructure for brands ready to move with precision.`
- `/services` — `One connected system for the work that matters.`
- `/about` — `Clarity is not a presentation layer. It is how the work gets built.`
- `/contact` — `Bring us the thing that needs to work better.`

The in-app browser session exposed a current viewport of 1115px but did not expose a viewport-resize control. Therefore exact functional viewport checks at 1440×900, 768×1024, and 390×844 could not be positively verified in this environment and remain a follow-up QA item. No responsive redesign or broad polish was introduced.

## Validation

Passed:

- `npm run test:phase5b:wpa:batch3b:publish`
- `npm run test:phase5a:application`
- `npm run test:phase5b:authority`
- `npm run validate:migrations`
- `npm run typecheck`
- `npm run lint` — 0 errors; one pre-existing warning remains in `scripts/audit-supabase-drift.mjs:316`.
- `npm run build`
- `git diff --check`

## Production and data safety

- Live Publish: not performed.
- Restore: excluded.
- Supabase migration #26: not changed or rerun.
- Protected Homepage Review: unchanged.
- Production Vercel: untouched.
- Production Supabase: untouched.
- No environment variables, credentials, tokens, or secrets were added.

## Recommendation

The scoped Owner Publish implementation is ready for review in PR #71. Do not merge until the exact responsive viewport QA limitation is independently cleared. Do not perform a live Publish as part of this implementation task.
