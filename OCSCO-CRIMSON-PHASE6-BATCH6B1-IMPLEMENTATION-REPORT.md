# OCSCO Crimson Phase 6 — Batch 6B1 Draft Authoring Foundation

Date: 2026-08-26
Branch: `codex/phase6-6b1-draft-authoring-v2`
Base: `733547852a7b2d22c56d4759fff1a24dabe29f75`
Implementation commit: `07919e9641b94d23aaf3a89a6a032aae935dce29`; first-save defect follow-up commit is recorded in the handoff.

## Implementation summary

Batch 6B1 now provides the protected Insights Draft authoring foundation:

- Insights landing/list with All, My Drafts, Review, and Published views;
- New Article route that creates no record on open;
- Edit Article route with owner/ownership protection;
- constrained Tiptap editor with the approved text-first toolbar;
- versioned `insights-body` schema v1 validator with node, mark, attribute, URL, size, node-count, and nesting limits;
- server-safe React renderer independent of the Tiptap runtime;
- explicit Save Draft server action using `insights_create_article` and `insights_save_draft`;
- server-side first-save slug generation with collision suffixes;
- Advanced pre-publication slug editing through `insights_update_article_slug`;
- Title, Excerpt, active Category, and controlled Tag persistence;
- truthful unsaved/saving/saved/error/conflict states and before-unload protection;
- immutable read-only display for Review, Published, and other non-Draft states;
- responsive and accessible structural styling for the protected authoring surface.

No migration was added or changed. No Submit, Publish, Preview, media, public Insights, B6B2, B6B3, `main`, or Production work was performed.

## Tiptap packages added

- `@tiptap/core` `3.30.3`
- `@tiptap/react` `3.30.3`
- `@tiptap/starter-kit` `3.30.3`
- `@tiptap/extension-link` `3.30.3`
- `@tiptap/extension-placeholder` `3.30.3`

No image/media extension was added.

## Tests and checks

- Migration validator: **PASS — 28 canonical migrations**
- Phase 5/PageDocument suite: **PASS — 108/108**
- Batch 6A focused suite: **PASS — 6/6**
- Batch 6B1 slug contract suite: **PASS — 5/5**
- Batch 6B1 authoring/body/slug static and runtime-contract suite: **PASS — 5/5**
- Typecheck: **PASS**
- Lint: **PASS**, with one pre-existing warning in `scripts/audit-supabase-drift.mjs`
- Production build: **PASS**
- Git diff check: **PASS**

## Security and regression result

Authoring stays behind the existing canonical `/crimson-admin-control` boundary and authenticated Insights capability. Server actions call the approved RPCs and do not write article or revision tables directly. RLS and backend ownership rules remain authoritative. Anonymous and direct `/admin` protections remain unchanged. Review and Published states render read-only and are not silently converted into Drafts.

## First-save defect follow-up

The Owner-reported attempted article was checked directly in staging and was not present: no matching recent `insights_articles` row or active Draft revision was found, so no title, body, slug, or orphan revision from that attempt was observed.

The submitted composer did not navigate a successful new-article save to the returned persisted article route, and unexpected Server Action exceptions were not contained. The fix adds safe server-side exception handling and logging, preserves a server-created article identity across retryable errors, and routes successful first saves to `/crimson-admin-control/insights/articles/[id]`. A focused regression test covers these behaviors. The exact Owner runtime stack could not be captured because the available browser session was not authenticated to the CMS; Owner re-test remains required.

## Responsive QA result

Responsive CSS is implemented for desktop, tablet, and mobile breakpoints, including one-column mobile authoring, reachable metadata, usable toolbar wrapping, and full-width Save Draft access. Local browser verification confirmed the canonical sign-in gate with no page-level overflow at the available browser viewport. Authenticated composer interaction at 1440×900, 768×1024, and 390×844 could not be completed because the available local browser session has no CMS sign-in; no credentials were available to perform that session step.

## Known issue / blocker

Authenticated browser QA and live first-save persistence remain Owner-review checks requiring a signed-in CMS session. The implementation is otherwise locally compiled and contract-tested. Keep PR #83 unmerged until the Owner repeats the first-save and responsive checks.

## Review decision

**NO-GO for merge pending Owner authenticated re-test.** Do not begin B6B2 or B6B3 from this branch.
