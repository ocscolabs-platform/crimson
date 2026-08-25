# OCSCO Project Crimson — Phase 5 / Work Package B

## Bounded legacy Work performance fix

Status: **PASS — MODEST IMPROVEMENT**

Date: 2026-08-25

Branch: `codex/phase5-wpb-work-list-performance`

Base: `staging` at `bd52dbc406053083daee2edbf242f59447e13a87`

Feature commit: `f44e0d02f2aefef0ae0f9737842512aa17095aa3`

This change implements only the two owner-authorized bounded Work performance improvements:

1. The public Work list no longer loads related Service relationships that it does not render.
2. Approved Work media uses one Supabase Storage `createSignedUrls` batch for the unique approved paths instead of one signed-URL request per path.

No Work content, PageDocument migration, schema, RLS, migration, cache, navigation-prefetch, Production, or `main` changes were made.

## Files changed

- `src/app/work/page.tsx` — calls `getPublishedWorkProjects({ includeRelatedCapabilities: false })` for the list route.
- `src/lib/cms-content.ts` — gates relationship reads behind the option, batches approved media signed URLs, and safely preserves approved-media ordering while omitting failed individual results.
- `scripts/test-phase5-wpb-work-list-performance.mjs` — focused source/contract tests.
- `package.json` — focused test script entry.

The optional duplicate legacy Work page read was **DEFERRED**. It was not necessary to satisfy the two authorized fixes and remains legacy performance debt rather than an unbounded refactor target.

## Functional and source verification

- Work list Preview: **PASS**. The public Work list renders without the related-capability section.
- Work detail Preview (`/work/cairnstack`): **PASS**. The existing related capability remains visible: `Digital experiences — Website design & development`.
- Approved media: current staging data contains three approved Cairnstack paths; the implementation performs one batch `createSignedUrls` call for the unique paths. The browser surface does not expose a request counter, so the call-count result is source-verified rather than network-trace-verified.
- Public route health: **PASS** for Home, Services, Work, Work detail, About, and Contact.
- Warm primary-navigation sequence using actual rendered Link clicks: **PASS** — Home→Services 1,024 ms; Services→Work 912 ms; Work→About 604 ms; About→Contact 601 ms; Contact→Home 1,332 ms.
- No direct destination navigation was used for measured transitions; direct navigation was used only to establish starting pages.

## Timing evidence

Previous post-PR #76 staging baseline for warm `Services → Work`:

- Passes: 1,316 ms, 1,326 ms, 1,306 ms
- Median: **1,316 ms**
- Range: **1,306–1,326 ms**

Feature Preview:

- Initial/cold observed pass: **4,774 ms**; this includes Preview/runtime cold-start variability.
- Warm passes: **931 ms, 918 ms, 1,012 ms, 1,018 ms**
- Warm median: **972 ms**
- Warm range: **918–1,018 ms**

Warm median improvement versus the baseline: approximately **344 ms / 26%**.

The result is classified as a modest, repeatable improvement. The remaining Work latency is retained as **DEFER — LEGACY WORK PERFORMANCE DEBT**; further optimization would require a separately authorized investigation of dynamic route/server timing and the deferred duplicate legacy page read.

## Validation

- Focused Work performance tests: **PASS — 4/4**.
- Typecheck: **PASS**.
- Lint: **PASS** with one pre-existing warning in `scripts/audit-supabase-drift.mjs` (`expectedColumn` unused).
- Production build: **PASS**.
- Migration validator: **PASS — 26 canonical migration files; latest `20260824000000`**.
- Existing Phase 5 authority, application, publish, restore, preview, metadata, Home, Services, About, and Contact-adjacent validators: all authorized suites passed except the known stale Contact verifier mismatch.
- Known unrelated verifier issue: `test:phase5b:slice4d:contact` reports 2 failures and 5 passes because it still expects the old Contact route patterns; the current clean staging baseline uses `createContactPageRenderData` and `ContactPageBody`. No Contact code was changed.
- `git diff --check`: **PASS**.

## Release boundary

- `main`: untouched.
- `staging`: untouched by this branch; no merge performed.
- Production Supabase: untouched.
- Vercel Production: untouched.
- Schema/migrations/content: untouched.

Feature Preview: [https://ocsco-project-crimson-gfid850ol-ocscolabs-platforms-projects.vercel.app](https://ocsco-project-crimson-gfid850ol-ocscolabs-platforms-projects.vercel.app)

PR: to be created against `staging`; merge is intentionally not authorized in this task.

## Recommendation

**PASS — MODEST IMPROVEMENT.** Open the PR for Owner/ChatGPT review with base `staging`. Do not merge until the scoped diff and checks are reviewed. Treat the remaining Work latency and optional duplicate legacy read as deferred legacy debt. Do not begin broader Work redesign, PageDocument migration, UI polish, or Phase 6.
