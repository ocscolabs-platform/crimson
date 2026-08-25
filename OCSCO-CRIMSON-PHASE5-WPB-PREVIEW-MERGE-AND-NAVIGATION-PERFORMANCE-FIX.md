# OCSCO Project Crimson — Phase 5 / Work Package B

## Preview merge and navigation performance fix

Date: 2026-08-25
PR #75 merge commit: `b5cc38419bbbb7dee515ee792fc43c7efeece374`
Final staging HEAD at verification: `b5cc38419bbbb7dee515ee792fc43c7efeece374`
Performance branch: `codex/phase5-wpb-public-navigation-performance`
Performance commit: `3b779eea7ce411221dc35b7955858fbba0220831`
Branch tip at report capture: `aade303c48e3ae4feb9f98cc6ab2afa991c16f97`; the final report-only commit is recorded in the chat handoff.
Performance PR: [#76](https://github.com/ocscolabs-platform/crimson/pull/76)

## Executive result

PR #75 was accepted and merged into protected `staging` after all required checks passed. The merged staging Preview is Ready and the authenticated Home Draft Preview remains available.

The separate performance correction materially reduced several route transition timings without introducing caching, migrations, schema/RLS changes, content changes, or Production/main changes. About was effectively unchanged and Work retains a substantial residual delay. Classification: **PARTIAL**. PR #76 is open for Owner/ChatGPT review and was not merged.

Phase 5 closure documentation was not updated and Phase 6 was not started.

## 1. PR #75 merge and post-merge verification

- Base: `staging`.
- Required checks before merge: **3/3 green**; no conflicts.
- Reviewed PR scope: 13 files, limited to the authenticated Preview implementation, safe public renderer extraction, Contact Preview safety, Preview tests, and the required WPB report.
- No migration, schema/RLS, Production, `main`, Work migration, or navigation-performance optimization was in PR #75.
- Merge commit: `b5cc38419bbbb7dee515ee792fc43c7efeece374`.
- Final staging HEAD: `b5cc38419bbbb7dee515ee792fc43c7efeece374`.
- Merged staging Preview deployment: Ready.
- Merged staging CMS Home state: active Draft remains available; Preview Draft action points to revision `ec959aa7-7fca-475b-af78-fd513d1f98ee`.
- Home Preview renders the real Home layout, shows `Preview — unpublished content`, identifies `Homepage · Draft`, shows the exact revision ID, and exposes `Return to CMS`.
- Anonymous isolation, wrong-page/IDOR, Published, Archived, and Work rejection were already verified on the PR #75 Preview; no Preview content was exposed.
- Read-only pointer verification after merge remained unchanged: Home `4d552d8b-b231-4ebd-98cc-882c10d20bfb`; Services `55ed5368-8161-466e-8a8d-dcc4cbf9711f`; About `d6b1cecf-a900-4277-9bb6-212f1ceb8f69`; Contact `a6a40e8f-8cf0-4b79-9473-e19ddaa01cda`.
- Staging public Home remains Published-only and shows `Digital infrastructure, built with precision.`.
- Production `www.ocsco.io` remains unchanged and shows `Digital infrastructure for brands ready to move with precision.`.
- Contact non-submission and Work exclusion remain covered by the passing Preview automation/source evidence.

## 2. Performance branch scope

Exact files changed:

- `src/app/about/page.tsx`
- `src/app/contact/page.tsx`
- `src/app/services/page.tsx`
- `src/app/work/page.tsx`
- `src/components/route-shell.tsx`

No migration, environment, Vercel, Supabase, content, API, or caching file changed.

### Root cause addressed

Before the fix, Services, About, Contact, and Work loaded route data first and then caused `RouteShell` to read shared site chrome, creating a route-composition waterfall:

`route data → RouteShell → settings/navigation`

After the fix, each affected route starts its independent Published reads together:

`route data + shared site chrome (+ Work hero) → await together → render`

The minimal `RouteShell` API now accepts preloaded Published chrome and, for legacy Work, the already-read Published page hero. Home was already parallelized and was not changed.

Logical Supabase read count did not change. The fix only reduces waiting between independent reads. Published-only authority, freshness semantics, Service authority, Work legacy authority, and Contact behavior are preserved. No Draft/Review data is read or cached.

### Before/after dependency order

| Route | Before | After |
|---|---|---|
| Home | site chrome + PageDocument parallel → referenced Services | unchanged |
| Services | PageDocument + Services list parallel → RouteShell chrome | PageDocument + Services list + chrome parallel |
| About | PageDocument → RouteShell chrome | PageDocument + chrome parallel |
| Contact | PageDocument → RouteShell chrome | PageDocument + chrome parallel |
| Work | Work projects + page sections parallel → RouteShell chrome + hero | Work projects + page sections + chrome + hero parallel |

Shared chrome remains settings + primary/footer navigation in parallel inside `getPublishedSiteChrome`.

## 3. Actual Link-click measurements

Method: the same rendered primary navigation Link click sequence on stable staging and the performance Preview. The first route was loaded directly only to establish the starting page; measured transitions used normal clicks. Readiness was the first destination snapshot containing the expected route heading.

### Baseline before fix

| Transition | Cold | Warm baseline |
|---|---:|---:|
| Home → Services | 1703 ms | 1262 ms |
| Services → Work | 3614 ms | 2225 ms |
| Work → About | 1041 ms | 992 ms |
| About → Contact | 1550 ms | 1405 ms |
| Contact → Home | 1610 ms | 1236 ms |

### Performance Preview after fix

| Transition | Cold | Warm pass 1 | Warm pass 2 | Warm median/range |
|---|---:|---:|---:|---:|
| Home → Services | 1051 ms | 1012 ms | 582 ms | 797 ms / 582–1012 |
| Services → Work | 1969 ms | 1260 ms | 1580 ms | 1420 ms / 1260–1580 |
| Work → About | 1036 ms | 1010 ms | 987 ms | 999 ms / 987–1010 |
| About → Contact | 589 ms | 979 ms | 623 ms | 801 ms / 623–979 |
| Contact → Home | 848 ms | 1308 ms | 830 ms | 1069 ms / 830–1308 |

### Approximate warm change versus baseline

- Home → Services: ~465 ms faster at the two-pass median.
- Services → Work: ~805 ms faster at the two-pass median.
- Work → About: effectively unchanged.
- About → Contact: ~604 ms faster at the two-pass median.
- Contact → Home: ~167 ms faster at the two-pass median.

The improvement is material and repeatable on four transitions, but the Work transition remains about 1.3–1.6 seconds in the two warm passes and About remains about 1 second.

## 4. Validation

- Typecheck: passed.
- Lint: 0 errors; one pre-existing unused-variable warning in `scripts/audit-supabase-drift.mjs`.
- Build: passed; all dynamic routes generated successfully.
- PageDocument authority tests: passed.
- PageDocument application/workflow tests: passed.
- Batch 3B Publish tests: passed.
- Batch 3C Restore and Restore UI reset tests: passed.
- Authenticated Preview tests: passed.
- Migration validation: passed with 26 canonical migration files; latest `20260824000000`.
- `git diff --check`: passed.

## 5. Acceptance decision

Classification: **PARTIAL**.

Additional optimization required: **YES**.

The smallest next investigation is **not implemented here**: instrument effective Next Link/RSC prefetch and request reuse, then separately investigate Work-specific query/media fan-out. Narrow Published/shared-chrome caching is a later candidate only after instrumentation and freshness review; no caching was introduced in this correction.

PR #76 is intentionally left open and unmerged for Owner/ChatGPT review. Do not merge it automatically.

## 6. Remaining WPB state

- Remaining FIX NOW finding: residual public navigation latency, especially Services → Work / Work content fan-out.
- Remaining acceptance blockers: Owner/ChatGPT review of PR #76 and a decision on the next optimization investigation.
- Production/main: untouched.
- Phase 5 closure ready: **NO**.
- Phase 5 closure docs: unchanged.
- Phase 6 Insights: not started.
