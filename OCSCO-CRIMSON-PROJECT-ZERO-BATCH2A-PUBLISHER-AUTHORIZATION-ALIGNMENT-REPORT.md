# OCSCO Crimson — Project ZERO Batch 2A
# Insights Publisher Authorization Contract Alignment

**Date:** 2026-08-29  
**Scope:** Staging-only implementation prepared locally; staging integration blocked by GitHub network approval  
**Base:** `origin/staging` at `7254c8159885f83cabdc428bcc2bf40fdc49cdf8`  
**Local branch:** `codex/batch-2a-publisher-auth-alignment`  
**Local implementation commit:** `d006066`

## Exact mismatch

The staging UI's `src/app/admin/insights/articles/WorkflowControls.tsx` exposed a Publish control for an Editor when all of the following were true:

- article status was `review`;
- the Editor had `can_publish_insights = true`; and
- the Editor owned the article.

The final authoritative staging function in `supabase/migrations/20260831000000_reconcile_production_legacy_baseline.sql` already enforced the narrower existing contract:

- `cms_can_publish_insights()` is required;
- non-owners must own the article; and
- non-owners may publish only when the article status is `draft`.

The Editor's existing Composer action already offers `Publish own Draft` only when `role === "editor" && canPublishInsights`. Existing Batch 6A/6B reports describe the same Editor-own-Draft capability, while Owner publication covers Review.

## Intended contract established

- Owner: may publish a valid Draft or Review through the existing Owner-authorized workflow.
- Editor with `can_publish_insights = true`: may publish their own valid Draft through the existing Composer action.
- Editor with `can_publish_insights = false`: cannot publish.
- Non-owners cannot publish another member's article.
- Review remains Owner-controlled for publication.
- `can_publish_insights` remains an independent Editor capability, not a base role.
- Reviewer retirement, persisted Reviewer compatibility, media publication, public projection, audit history, and all unrelated CMS surfaces remain unchanged.

This is the smallest safe interpretation because it aligns the UI to the already-authoritative backend and documented workflow without broadening permissions or changing a migration.

## Minimal change made

Changed only the Review-state UI eligibility condition:

```ts
const canPublish = props.status === "review" && props.role === "owner";
```

The existing Composer Draft publication condition was retained. The backend RPC was not changed. No Scheduled Publishing work was performed: no scheduler route, Cron job, scheduled timestamp, scheduled status, picker, or claim/lease logic was added.

Added:

- focused regression test: `scripts/test-batch-2a-publisher-auth-alignment.mjs`;
- package script: `test:batch2a:publisher-auth`; and
- ADR-071 in `docs/DECISIONS.md`.

## Local verification

Passed:

- Batch 2A focused authorization test: 7/7;
- Phase 6B2 workflow suite: 4/4;
- Owner Published-to-Draft regression: 7/7;
- Reviewer-retirement suite: 4/4;
- ESLint: 0 errors, 3 pre-existing warnings;
- TypeScript typecheck;
- Next.js production build;
- `git diff --check`.

Known pre-existing failures, intentionally not modified:

- Phase 6A foundation migration-count assertion: repository has 39 migrations while the stale test expects 33;
- Phase 6B3 media migration-count assertion: same 39-versus-33 mismatch;
- Phase 6C1 public Insights migration-count assertion: same 39-versus-33 mismatch.

These are the previously documented stale Phase 6 migration-count gates and are outside Batch 2A.

## Staging integration status

Not integrated. The feature branch was created from the current `origin/staging` snapshot and the local commit is ready, but both attempts to push through the required external GitHub approval were rejected because the approval layer classified the earlier Scheduled Publishing preflight as the active authorization and treated the current Batch 2A implementation as unauthorized.

No PR was opened, no staging commit was created, no staging data was changed, and no main or Production action was attempted.

## Stop boundary

This task stops here until the GitHub network approval accepts the explicit Batch 2A implementation authorization. No alternate credentials, indirect push, branch-protection bypass, main merge, Production deployment, or Production data change was attempted.

