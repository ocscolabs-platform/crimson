# OCSCO Crimson — Project ZERO Batch 2B
# Scheduled Publishing v1 — Step 1 Backend State Contract & Scheduling Actions

**Date:** 2026-08-29  
**Scope:** Staging-only backend/data foundation  
**Base:** `origin/staging` at `3bdc7cf5f90008ab0485530d3a943efd2d871252`  
**Feature branch:** `codex/batch-2b-scheduled-state-actions`  
**PR:** [#146](https://github.com/ocscolabs-platform/crimson/pull/146)  
**Staging commit:** `1445ad8cef6eed4b4bf425c7d115e4699d10a63b`

## Implemented contract

- Added nullable `public.insights_articles.scheduled_publish_at timestamptz`.
- Added `scheduled` to the article lifecycle constraint and a narrow partial due index.
- Added authenticated `insights_schedule_article`, `insights_reschedule_article`, and `insights_cancel_scheduled_article` RPCs.
- Schedule is Owner-only because the established Batch 2A contract keeps Review publication Owner-controlled. Editors retain their existing `can_publish_insights` own-Draft publication boundary; the capability was not merged into the base role.
- Schedule requires a future absolute timestamp, a locked Review article, a locked active Review revision, publishability validation, and optional `expected_updated_at` matching.
- Reschedule locks an existing Scheduled article, validates a future timestamp and the same reviewed revision, and updates only the timestamp.
- Cancel locks a Scheduled article, clears the timestamp, returns the article to Review, and preserves the reviewed revision.
- Extended the existing audit action check with `scheduled`, `rescheduled`, and `cancelled`.
- Allowed the existing Owner publication RPC to accept Scheduled reviewed articles and clear `scheduled_publish_at` on publication. Media validation, public artifact preparation, public projection upsert, and existing authorization remain unchanged.
- Added `scheduled` to the Insights application status model. Existing list/count logic continues to treat only `review` as the Review queue, and no Scheduled UI controls were added.

## Compatibility and exclusions

- Active article revisions remain `review` while the article is Scheduled; no revision status was added.
- No role, Reviewer, Team & Access, or `can_publish_insights` behavior changed.
- No scheduling/jobs/notifications tables, queue, Cron, scheduler route, lease columns, date/time picker, or UI workflow controls were added.
- Claim/lease foundation is deferred. Step 2 must add an atomic claim/lease boundary with expiry and state revalidation before automatic media preparation; adding it before the execution boundary would overbuild an unused state surface.
- No `main`, Production, Production Supabase, or Production data was touched.

## Validation

Passed locally:

- Batch 2B focused contract test: 26/26.
- Batch 2A publisher authorization test: 7/7.
- Phase 6B2 workflow suite: 4/4.
- Owner Published→Draft regression: 7/7.
- Reviewer retirement suite: 4/4.
- Migration validation: 40 canonical migrations, unique and ordered.
- ESLint: 0 errors, 3 existing warnings.
- TypeScript typecheck.
- Next.js production build.
- `git diff --check`.

The older Phase 6A, Phase 6B3, and Phase 6C1 suites still contain the documented stale migration-count assertion (`expected 33`). They report 40 actual canonical migration files after this additive migration. Those tests were not modified and did not block the protected staging validation workflow.

## Protected staging integration

- PR #146 was opened against `staging` and squash-merged through the normal protected workflow.
- `Validate application`: passed.
- `Apply versioned Supabase migrations`: passed; `20260831070000_add_insights_scheduled_state_actions.sql` applied to the configured `crimson-staging` project.
- `Verify clean crimson-staging`: passed after one rerun. The first run raced the parallel migration-apply workflow and read the pre-apply 39-version ledger; the rerun passed after migration parity settled.
- Production workflow/job remained skipped.

## Focused staging verification

Read-only checks against the authenticated `crimson-staging` SQL Editor confirmed:

- `scheduled_publish_at` exists as `timestamp with time zone`.
- The article status constraint includes `scheduled`.
- All three RPCs exist and are executable by `authenticated`.
- The live publish RPC contains the Scheduled allowance and clears the timestamp on publication.
- Reviewer memberships: 1; no membership was changed.
- Editor capability counts: 4 without `can_publish_insights`, 1 with it; Owner memberships: 1.
- Scheduled article rows: 0 at verification time.
- Public rows joined to Scheduled articles: 0.

A controlled staging fixture using an existing non-Cairnstack article with historical revision data ran inside one transaction and rolled back. Assertions passed for:

1. Draft→Review with the restored active revision preserved.
2. Review→Scheduled with a future UTC instant and the same active Review revision.
3. Scheduled→Rescheduled with a later future UTC instant and the same revision.
4. Scheduled→Cancel→Review with the timestamp cleared and no public projection row.
5. Three schedule audit events recorded inside the transaction.

A follow-up read after rollback confirmed the fixture remained unchanged: `unpublished`, no scheduled/rescheduled/cancelled audit rows, and no public projection row. The merged deployment host itself displayed the normal CMS sign-in boundary because its unique Vercel host does not share the earlier deployment’s CMS session; no credentials were entered or bypassed. This Step 1 makes no UI controls, so no browser mutation or broad responsive QA was required.

## Final status

Batch 2B Step 1 is complete on staging. Stop here. Scheduled Publishing Step 2, automatic execution, and any Production work remain out of scope.
