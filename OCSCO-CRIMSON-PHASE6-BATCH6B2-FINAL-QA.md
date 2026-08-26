# OCSCO Crimson Phase 6 — Batch 6B2 Final QA

Date: 2026-08-26  
PR: [#84](https://github.com/ocscolabs-platform/crimson/pull/84)  
Branch: `codex/phase6-6b2-review-preview-autosave`  
Final implementation commit: `aee8502aedc7dcfa42d2d09ee119388b4393af9f`  
PR state: OPEN / UNMERGED

## Stable Preview

Stable PR Preview alias:

`https://ocsco-project-crimson-git-c-39cd87-ocscolabs-platforms-projects.vercel.app`

The latest PR deployment was Ready and served commit `aee8502` through deployment host `https://ocsco-project-crimson-2ie33kn7j-ocscolabs-platforms-projects.vercel.app`. Vercel Preview and Preview Comments passed. The latest available GitHub application validation run passed.

## Editor Withdraw QA — PASS

A temporary staging-only Auth user was created through Supabase Auth administration and configured as a normal Editor with `insights_only` access, Insights access enabled, and `can_publish_insights = false`.

Editor-owned article `8ea732da-ad00-4a60-aa8b-55f8b40a8a93` was saved, submitted to Review, verified read-only, and withdrawn through the confirmed `Withdraw to Draft` UI. It became editable Draft again, ownership remained unchanged, and the Owner Needs Review count updated authoritatively. Direct staging verification showed the audit sequence `created, submitted, withdrawn_to_draft`.

## Owner Publish UI QA — PASS

Owner opened Review article `0d2026eb-0dc4-483d-89a0-a789a6966dcd`, confirmed read-only content, executed the explicit Publish confirmation, and verified the article became Published and remained read-only. The Needs Review count became zero.

Owner then used the Owner-only Unpublish control to remove the controlled QA article from the staging publication boundary. Direct staging verification showed final status `unpublished`, `published_revision_id = NULL`, a retained `last_published_revision_id`, and an audit sequence ending `published, unpublished`. Revision and audit history were preserved.

## Authorization smoke — PASS

- Editor Pages administration redirected away.
- Editor direct `/admin` redirected away.
- Editor access to another member’s Review returned 404.
- Editor Review exposed Withdraw only; exact Publish and Return controls were absent.
- Owner retained the full existing authority and completed Publish/Unpublish.

## Autosave and Preview sanity — PASS

- Existing Draft `4e2b8d6c-27e6-4bb6-b6d5-dc9d9379485c` moved through unsaved, saving, and saved states; its title persisted after refresh.
- Navigation before persistence showed the custom Unsaved changes alertdialog; Stay preserved editing and save completed.
- Draft and Review Preview were authenticated, read-only, shared-renderer based, refreshed successfully, and showed the unpublished-content banner.
- Preview metadata contained `noindex, nofollow, noarchive, nocache`; no GET mutation was observed.

## Responsive QA

The Codex in-app browser exposed no device-toolbar control through the available Browser surface. The prior scripted viewport override remained fixed at 1280x720 and was not substituted as exact-size evidence.

- 1440x900: NOT VERIFIED — device toolbar unavailable; actual viewport remained 1280x720.
- 768x1024: NOT VERIFIED — device toolbar unavailable; actual viewport remained 1280x720.
- 390x844: NOT VERIFIED — device toolbar unavailable; actual viewport remained 1280x720.

At the available 1280x720 viewport, landing, Draft, Preview, and Review had no page-level horizontal overflow and verified controls were reachable. Accessibility sanity checks passed for the Draft polite live region, navigation alertdialog, Preview landmark/banner, and read-only surfaces.

## Regressions and scope

Passed migration validation at 28 canonical migrations / 28 baseline, Phase 5 application and authority tests, Batch 6A foundation tests, Batch 6B1 slug and authoring tests, Batch 6B2 workflow tests, typecheck, lint, build, and `git diff --check`. Lint retains one existing warning at `scripts/audit-supabase-drift.mjs:316`.

No Batch 6B3, media, public Insights, public `/insights`, `main`, Production, or migration work was started.

Temporary Editor account status: banned in `crimson-staging` until 27 Aug 2026 23:16 (+0800); active QA sessions signed out. Credentials are not recorded here or in source control.

## Decision

NO-GO for PR #84 merge solely because exact responsive evidence could not be obtained from the Codex in-app browser device surface. All other final hard gates passed. Do not merge PR #84 or begin Batch 6B3 in this task.
