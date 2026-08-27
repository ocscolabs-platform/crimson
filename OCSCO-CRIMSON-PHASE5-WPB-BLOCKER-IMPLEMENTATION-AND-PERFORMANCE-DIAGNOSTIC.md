# OCSCO Project Crimson — Phase 5 / Work Package B

## Blocker implementation and performance diagnostic

Date: 2026-08-25  
Branch: `codex/phase5-wpb-authenticated-preview`  
Base: `staging`  
PR: [#75](https://github.com/ocscolabs-platform/crimson/pull/75)  
Commit: `ad026d868706c562894704cf4598e8a16de3cc43`

## Executive result

F-001 and F-002 were corrected through the authenticated staging CMS paths and published once each. F-003 has been implemented on the isolated Preview branch and PR #75 is open against `staging`; it has not been merged.

Code and automated contracts are validated. The owner-assisted authenticated Preview session is now available. Home has a safe active Draft and passed live Preview QA. Services, About, and Contact have no active Draft/Review revision, so no editorial state was manufactured; their Preview eligibility and rendering contracts are covered by automation/source evidence. No credentials were accessed or handled.

Public navigation latency was measured read-only on stable staging. No performance fix was implemented.

## 1. Staging-only corrections

### F-001 — navigation residue

- Corrected only the `/services` primary navigation item through `/crimson-admin-control/content`.
- Saved one private Review, verified it, and published it once as Owner.
- Published revision: `a235ff1f-eb2e-4d2c-bed6-e3468dd3661d`.
- Final label/href/group/order/visibility: `Services`, `/services`, `primary`, `10`, `true`.
- The old `Services 2` revision remains immutable history; no source/seed occurrence of `Services 2` was found.

### F-002 — Branding test residue

- Corrected only the Branding `short_description` through `/crimson-admin-control/services/branding`.
- Saved one private Review, verified it, and published it once as Owner.
- Published revision: `48ac0cd6-8f27-47a1-9b8e-9dd5e7703ec8`.
- Final canonical text: `Positioning and identity systems that give the quality of your business a clear, credible expression.`
- Name, slug, audience, and outcome were left unchanged.
- The old polluted revision remains immutable history; `PHASE 4C TEST` is absent from checked staging routes.

### Safety

- Staging public `/`, `/services`, `/about`, `/contact`, `/work`, and `/services/branding` were checked after correction.
- Production `/`, `/services`, and `/services/branding` remained unchanged and contained no test residue.
- Staging migrations remain 26/26; latest `20260824000000`; migration #26 exactly once; duplicate list empty.
- No schema migration, RLS change, user creation, Work migration, Production change, or `main` change was made.

## 2. F-003 authenticated PageDocument Preview

### Implemented contract

- Route: `/crimson-admin-control/content/pages/[pageKey]/preview?revision_id=<uuid>`.
- Approved pages: Home, Services, About, Contact. Work is rejected by the PageDocument adapter allowlist.
- Server-side authentication and CMS membership are required. Owner, Editor, and Reviewer are accepted; anonymous users are denied.
- The revision query is bound to the exact page entity and `entity_type = page`; only `draft` and `review` statuses are accepted.
- Payloads pass the existing `validatePageDocument` validator before rendering.
- The public Published-only loader remains unchanged.
- Route rendering is request-time and no-store (`force-dynamic`, `revalidate = 0`, `force-no-store`). No public metadata or OG generation is used.
- Preview has no save, submit-for-review, return-to-draft, publish, restore, audit, or pointer mutation path.
- The CMS page exposes Preview only when a valid active Draft or Review document exists and passes the exact revision ID.
- Existing public renderers are reused through shared body components; public routes retain their Published-only data boundary.
- Contact Preview uses the real form layout but disables the submit control, prevents submit handling, and shows `Preview mode — submissions are disabled.` No inquiry API or database write is reachable from Preview.

### Automation

Focused Preview contract tests: **5 passed**.  
Typecheck: **passed**.  
Lint: **0 errors**, one pre-existing warning in `scripts/audit-supabase-drift.mjs`.  
Production build: **passed**; Preview route appears as dynamic `/admin/content/pages/[pageKey]/preview`.  
Existing authority, application workflow, Batch 3B Publish, Batch 3C Restore, Restore UI reset, and migration validation suites: **passed**.

### Live Preview QA

- Vercel deployment: Ready.
- Preview URL: `https://ocsco-project-crimson-git-c-b93eb9-ocscolabs-platforms-projects.vercel.app`
- Home active Draft Preview: **PASS**. Active revision `ec959aa7-7fca-475b-af78-fd513d1f98ee` appeared as the sole Preview action, rendered the real Home layout, showed the persistent unpublished banner and `Draft` state, showed the exact revision ID, and exposed `Return to CMS`.
- Services, About, and Contact: **NOT APPLICABLE LIVE** because each currently has no active Draft/Review revision; the CMS correctly showed no Preview action. No state was manufactured.
- Contact Preview non-submission: **PASS by focused automation/source evidence**. The actual Contact layout is shared, Preview disables the submit control and prevents the inquiry handler; the focused test suite passed. No inquiry request or row was created.
- Anonymous visit to `/crimson-admin-control/content/pages/home` on the Preview host redirected to `/crimson-admin-control/login`, confirming private isolation.
- Wrong page/revision relationship, Published Home revision `4d552d8b-b231-4ebd-98cc-882c10d20bfb`, an Archived Home revision, and `/work` Preview all returned the not-found surface with no Preview content.
- Read-only SQL before and after QA showed unchanged Published pointers: Home `4d552d8b-b231-4ebd-98cc-882c10d20bfb`, Services `55ed5368-8161-466e-8a8d-dcc4cbf9711f`, About `d6b1cecf-a900-4277-9bb6-212f1ceb8f69`, Contact `a6a40e8f-8cf0-4b79-9473-e19ddaa01cda`.
- No Preview QA action changed content, workflow state, pointer, audit, or public output.

## 3. Corrected read-only public navigation latency diagnostic

Stable staging host: `https://ocsco-project-crimson-git-staging-ocscolabs-platforms-projects.vercel.app`

Method: loaded the starting page once, then clicked the actual rendered primary navigation Link for each transition in the existing browser tab. Readiness was the first observed destination snapshot containing the route's expected heading. No direct destination URL was used for measured transitions; no cache clearing, deployment, or application change occurred.

### Actual Link-click samples (milliseconds)

Cold sequence: Home → Services → Work → About → Contact → Home.
Warm sequence: the same click sequence after all five routes had already been visited.

| Transition | Cold click-to-ready | Warm click-to-ready |
|---|---:|---:|
| Home → Services | 865 | 1355 |
| Services → Work | 2546 | 1894 |
| Work → About | 1681 | 844 |
| About → Contact | 1246 | 818 |
| Contact → Home | content ready after URL change; heading confirmed immediately after the polling window | 914 |

The cold Contact → Home timing was not recorded as a numeric value because the initial readiness probe used the older headline string; the destination URL changed and the correct current heading, `Digital infrastructure, built with precision.`, was confirmed immediately afterward. This is retained as a measurement limitation rather than backfilled.

The URL changed promptly after each click; the material delay was destination content readiness, especially for Work. The available browser surface did not expose request-start timestamps or the Performance API, so RSC/data start-before-click versus after-click and response reuse are **UNKNOWN**.

### Prefetch verification

- Primary nav anchors were rendered as `/services`, `/work`, `/about`, and `/contact` with no explicit `prefetch` attribute.
- No navigation `link[rel=prefetch]` or RSC preload marker was present in the rendered DOM; only the logo SVG and a JavaScript chunk were preloaded.
- The browser automation surface exposed no network timeline, request interception, or usable Performance API (`window.performance` was unavailable), so prefetch request observed before click: **UNKNOWN** for each link; destination server/RSC request timing: **UNKNOWN**; prefetched response reuse: **UNKNOWN**.
- Source confirms normal Next `Link` usage, but source presence alone is not treated as proof of effective prefetch.

| Route | First pass | Warm pass | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|---:|
| `/` | 1791 | 874 | 1447 | 1160 |
| `/services` | 1212 | 2043 | 1184 | 1821 |
| `/work` | 2738 | 2277 | 2365 | 1785 |
| `/about` | 1188 | 1622 | 1382 | 1455 |
| `/contact` | 1182 | 786 | 1435 | 822 |

### Observed mechanism

- Public routes are request-time dynamic and read Published CMS data from Supabase.
- Home starts its site-chrome and PageDocument reads in parallel, then resolves referenced Services.
- Services, About, and Contact load PageDocument data before `RouteShell` loads site chrome, creating serialized server-side reads on those routes.
- Header links use normal Next `Link` behavior; no separate navigation-performance change was made.
- The measured variability is consistent with dynamic Preview/server response and Supabase round trips. `/work` was consistently among the slowest samples, but this diagnostic does not establish a single production-only defect.

### Server fetch waterfall

- Home: `site chrome + PageDocument` in parallel → referenced Home Services read → render. The shared chrome is two parallel reads (settings plus primary/footer navigation); Home PageDocument is one Published read; referenced Services are one read.
- Services: PageDocument + full Published Services list in parallel → `RouteShell` shared chrome read. The route data and shared chrome are separated by the current component structure, so the user-visible server work is not one unified parallel group.
- About: PageDocument read → `RouteShell` shared chrome read. The PageDocument and chrome are sequential at the route composition boundary.
- Contact: PageDocument read → `RouteShell` shared chrome read. The PageDocument and chrome are sequential at the route composition boundary.
- Work: Work projects + legacy Work page sections in parallel → `RouteShell` shared chrome plus legacy Work page hero read. Work project loading itself may include case-study links, related Services, and approved media URL work.
- Shared across every `RouteShell` route: settings and primary/footer navigation are fetched together by `getPublishedSiteChrome`. Work additionally uses the legacy Work authority; Work is intentionally outside PageDocument migration.

Approximate normal server read counts before storage/media fan-out: Home 4 logical reads (2 chrome + PageDocument + referenced Services); Services 5 (PageDocument + full Services list + 2 chrome); About 3 (PageDocument + 2 chrome); Contact 3 (PageDocument + 2 chrome); Work at least 5 (projects, Work sections, 2 chrome, legacy hero/page read), with additional case-study relationship/media reads depending on records.

### Classification

**FIX NOW — recommendation only; not implemented.** Normal warm primary-navigation clicks repeatedly exceeded approximately one second, especially Services → Work at 1.894s and the cold equivalent at 2.546s. The strongest supported cause is avoidable request-time server work and route composition that separates route data from shared chrome reads, compounded by dynamic Supabase/Preview response latency. The smallest correction to evaluate first is to parallelize independent route data and shared chrome reads at the route boundary, then remeasure. Preserve Published-only authority and post-Publish freshness; do not cache Draft/Review or introduce broad caching without evidence. Prefetch effectiveness remains unconfirmed and should be instrumented separately. No performance fix was made.

## 4. PR #75 gate result

- Authenticated Preview QA: **PASS for applicable live state**.
- Home Preview: **PASS** — active Draft `ec959aa7-7fca-475b-af78-fd513d1f98ee`.
- Services Preview: **NOT APPLICABLE LIVE** — no active Draft/Review; eligibility automation passed.
- About Preview: **NOT APPLICABLE LIVE** — no active Draft/Review; eligibility automation passed.
- Contact Preview: **NOT APPLICABLE LIVE** — no active Draft/Review; non-submission automation/source evidence passed.
- Anonymous/IDOR isolation: **PASS** — anonymous, wrong-page, Published, Archived, and Work probes exposed no Preview content.
- Contact non-submission: **PASS by automation/source evidence**.
- PR #75 recommendation: **HOLD** pending Owner review and the separately authorized navigation-performance decision.
- Confirmation: **No performance fix was made.**

## 5. Scope and closure state

Included: F-001 correction, F-002 correction, authenticated PageDocument Preview implementation, safe renderer extraction, Contact Preview safety, focused tests, and this report.  
Excluded: navigation optimization, migration/schema/RLS work, Work migration, Production/main changes, live Publish, live Restore, Phase 6 Insights, and broad CMS UI/UX polish.

Current remaining FIX NOW finding: public navigation/server waterfall optimization is still outstanding by explicit instruction.
WPB closure readiness: **NO — PR #75 should be held for Owner review; do not merge while the authorized performance correction remains unimplemented.**

Next safe step: Owner reviews PR #75 and this evidence. If the performance recommendation is separately authorized, implement and validate it in a later scoped change. Do not merge PR #75 automatically, do not begin Phase 6, and do not modify Production/main.
