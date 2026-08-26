# OCSCO Crimson Phase 6 — Batch 6B1 Browser QA Closure

Date: 2026-08-26  
Branch: `codex/phase6-6b1-draft-authoring-v2`  
PR: [#83](https://github.com/ocscolabs-platform/crimson/pull/83) — **OPEN / UNMERGED**  
Base: `staging`  
Latest fix: `60fdeec98ef0142a82366d2735b705be5e3299c`

## Closure decision

**NO-GO for merge.** The source defect is fixed and the final PR preview is deployed, but the complete authenticated browser closure could not be completed because the only available authenticated session is scoped to the previous Preview host. No authentication bypass or credential handling was attempted.

Do not start B6B2 or B6B3. Do not merge to `staging`, `main`, or Production.

## Actual first-save defect

The authenticated browser reproduced the generic failure on the earlier Preview host during:

`New Article → Title → Body → Save Draft`

Observed page:

- `This page couldn’t load`
- `A server error occurred. Reload to try again.`
- `ERROR 3618364563@E352`

The Vercel runtime log for the failing `POST` returned HTTP 500 with the exact Next.js exception:

```text
Error: A "use server" file can only export async functions, found object.
Read more: https://nextjs.org/docs/messages/invalid-use-server-value
digest: '3618364563@E352'
```

The cause was an object (`EMPTY_STATE`) exported from a module marked `"use server"`. Next.js rejected the module before the Server Action could complete. This is the root cause of the generic error page—not a Supabase article/revision transaction failure.

## Direct staging verification

After the failed valid save, Supabase was queried directly for the attempted title, recent article rows, active revisions, slug, body type, and body text length. The result was `[]`. The attempted article did not appear in the Insights list, and no partial article, Draft revision, slug, title, or body row was found.

The blank New Article route was also checked before saving; the article count remained unchanged at 4. Invalid blank-title submission stayed on `/articles/new`, showed `Enter a Title before saving this Draft.`, preserved the body, and created no row.

## Fixes delivered

- Removed the invalid object export from the `"use server"` module; only async Server Actions remain exported.
- Kept the initial action state local to the client composer.
- Preserved a server-created article identity across retryable failures.
- Routed successful first saves to `/crimson-admin-control/insights/articles/[id]`.
- Kept safe author-facing errors and server-side diagnostic logging.
- Disabled the duplicate Tiptap Link registration reported by the earlier Preview.

Relevant commits:

- `9b3509444cd9e8cdb1f5247b36d0b772c890603b` — first-save error handling and redirect
- `b5da5e6eeba367080fb6cfcd0fb70f3c82352e77` — defect verification record
- `60fdeecf98ef0142a82366d2735b705be5e3299c` — invalid Server Action export fix and Tiptap cleanup

## Authenticated browser evidence and blocker

The available authenticated Owner session was successfully used on:

`https://ocsco-project-crimson-4qlbxxx1e-ocscolabs-platforms-projects.vercel.app`

That host is the older deployment containing the defect. The latest PR deployment is:

`https://ocsco-project-crimson-git-c-91bf9a-ocscolabs-platforms-projects.vercel.app`

Opening the latest host in a separate browser tab redirected to the CMS login page. The existing session was not shared across these preview hosts, and no credentials were available for a legitimate sign-in. The final Preview therefore could not be authenticated for a second first-save attempt.

## Required QA matrix

| Check | Result | Evidence / reason |
|---|---|---|
| New Article open creates no row | PASS on authenticated old host | Direct staging count unchanged |
| Invalid title validation | PASS on authenticated old host | Inline validation; no row; body preserved |
| Authenticated first save on final fix | **FAIL / BLOCKED** | Old host reproduced defect; final host requires separate sign-in |
| Article/revision/server slug/Draft persistence | **NOT VERIFIED** | Final host authentication blocker |
| Route to persisted article ID | **NOT VERIFIED** | Final host authentication blocker |
| Refresh persistence and Insights list | **NOT VERIFIED** | Final host authentication blocker |
| Second save without duplicate | **NOT VERIFIED** | Final host authentication blocker |
| Valid/invalid/duplicate slug editing | **NOT VERIFIED** | Final host authentication blocker |
| Tiptap toolbar interaction | **NOT VERIFIED** | Editor rendered on old host; final build not authenticated |
| Review and Published read-only behavior | **NOT VERIFIED** | Final host authentication blocker |
| Insights-only authorization and direct `/admin` denial | PASS by focused contract suite; live matrix not rerun on final host | Existing authorization boundary unchanged |
| Responsive 1440×900 | **NOT VERIFIED** | Final host authentication blocker |
| Responsive 768×1024 | **NOT VERIFIED** | Final host authentication blocker |
| Responsive 390×844 | **NOT VERIFIED** | Final host authentication blocker |

## Automated gates

- Migration validation: **PASS — 28 canonical migrations**
- Phase 5/PageDocument regression: **PASS — 108/108**
- Phase 6A foundation: **PASS — 6/6**
- Phase 6B1 slug contract: **PASS — 5/5**
- Phase 6B1 authoring/body/slug: **PASS — 6/6**
- Typecheck: **PASS**
- Production build: **PASS**
- Lint: **PASS**, with one pre-existing unused-variable warning in `scripts/audit-supabase-drift.mjs:316`
- Git diff check: **PASS**
- PR validation: **PASS**
- Vercel Preview and Preview Comments: **PASS**
- PR merge state: **CLEAN**, while PR remains open and unmerged

## Final owner handoff

The root cause is identified and fixed in `60fdeec`. Merge remains blocked until the latest PR Preview is authenticated and the required first-save, persistence, slug, Tiptap, read-only, authorization, and three-viewport checks are completed with evidence.
