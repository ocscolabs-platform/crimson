# OCSCO Project Crimson — Phase 5 / Work Package B

## Blocker implementation and performance diagnostic

Date: 2026-08-25  
Branch: `codex/phase5-wpb-authenticated-preview`  
Base: `staging`  
PR: [#75](https://github.com/ocscolabs-platform/crimson/pull/75)  
Commit: `ad026d868706c562894704cf4598e8a16de3cc43`

## Executive result

F-001 and F-002 were corrected through the authenticated staging CMS paths and published once each. F-003 has been implemented on the isolated Preview branch and PR #75 is open against `staging`; it has not been merged.

Code and automated contracts are validated. Live authenticated Preview QA is **BLOCKED** because the branch-specific Vercel Preview host does not share the existing signed-in CMS session and redirects to the CMS login page. Anonymous denial was observed and is expected. No credentials were accessed or handled.

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
- Anonymous visit to `/crimson-admin-control/content/pages/home` redirected to `/crimson-admin-control/login`, confirming the private boundary.
- Authenticated Draft/Review UI QA is **BLOCKED** pending an Owner/Editor/Reviewer sign-in on this branch-specific host. No content state was changed.

## 3. Read-only public navigation latency diagnostic

Stable staging host: `https://ocsco-project-crimson-git-staging-ocscolabs-platforms-projects.vercel.app`

Method: sequential full navigations in the existing browser tab; no cache clearing, deployment, or application change. Timings are approximate end-to-end browser navigation completion times.

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

### Classification

**NEEDS MEASUREMENT / DEFERRED FIX.** The sample shows a material and variable delay, but the authorized task prohibits implementing a navigation fix. The smallest future investigation should compare server timing and Supabase query spans on a warm Production-like deployment, then evaluate parallelizing the shared chrome read and/or a narrowly scoped public cache strategy. No such change is included in PR #75.

## 4. Scope and closure state

Included: F-001 correction, F-002 correction, authenticated PageDocument Preview implementation, safe renderer extraction, Contact Preview safety, focused tests, and this report.  
Excluded: navigation optimization, migration/schema/RLS work, Work migration, Production/main changes, live Publish, live Restore, Phase 6 Insights, and broad CMS UI/UX polish.

Current remaining blocker: authenticated live Preview QA on the branch-specific Vercel host.  
WPB closure readiness: **NO — pending authenticated Preview QA and final Owner review.**

Next safe step: Owner signs in on the exact Preview URL; perform read-only Draft/Review QA for all four approved pages, including Contact non-submission; then update this report and leave PR #75 open for review. Do not merge or begin Phase 6.
