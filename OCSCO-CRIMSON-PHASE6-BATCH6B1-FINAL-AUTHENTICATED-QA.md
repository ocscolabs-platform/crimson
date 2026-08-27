# OCSCO Crimson Phase 6 — Batch 6B1 Final Authenticated QA

Date: 2026-08-26  
Branch: `codex/phase6-6b1-draft-authoring-v2`  
PR: [#83](https://github.com/ocscolabs-platform/crimson/pull/83)  
Target: `staging`  
Stable Preview: `https://ocsco-project-crimson-git-c-91bf9a-ocscolabs-platforms-projects.vercel.app`  
QA deployment: `9Rs8dyMDhDwy2PW1wEKjv4y3BdQ5`  
QA source commit: `b41c539` (`Accept Tiptap ordered-list metadata`)

## Status

PR #83 remains **OPEN / UNMERGED**. Vercel Preview, Preview Comments, and validation checks passed. Merge is explicitly **NO-GO** for this gate; do not merge, start B6B2/B6B3, touch `main`, or touch Production.

## Root causes fixed during this QA loop

1. A non-function object was exported from a `"use server"` module. Next.js rejected the Server Action module and returned the generic error page. Fixed in `60fdeec`.
2. Link authoring used `window.prompt()`, which failed in the Codex browser. Replaced with an inline validated URL control in `3c37644`.
3. The inline Link control could lose the editor selection. Selection preservation and mouse-down focus protection were added in `a33a975` and `67836ff`.
4. The uncontrolled hidden body field could revert after editor/toolbar rerenders. The submitted body is now controlled React state in `fa231e5`.
5. Tiptap-safe link metadata and ordered-list `type: null` were rejected by the body validator. The validator now accepts those exact safe payloads in `2bbf259` and `b41c539`.

## Authenticated first-save evidence

The Owner session was authenticated on the stable branch alias as `ocscolabs@gmail.com` / Owner. Opening New Article created no matching revision. Blank-title save showed inline validation, preserved the body, and created no row.

Valid first save completed without a generic error page and navigated to:

`/crimson-admin-control/insights/articles/0d2026eb-0dc4-483d-89a0-a789a6966dcd`

The persisted record was verified directly in staging with the same article ID, Draft status, active revision, server slug, title, excerpt, category, and tags. The Insights list then contained 5 articles: the original 4 plus this one controlled QA Draft, with no second article created for the subsequent saves.

## Final QA matrix

| Gate | Result | Evidence |
|---|---|---|
| New Article open creates no row | **PASS** | Direct staging query returned 0 matching revisions before save |
| Invalid title validation | **PASS** | Inline title error, body preserved, no generic error, no row |
| Authenticated first save | **PASS** | Stable Preview created the Draft and routed to the article ID |
| Article/revision/slug/Draft persistence | **PASS** | Direct Supabase verification; one article identity and active revision |
| Refresh persistence | **PASS** | Title, body, Draft status, metadata, and slug survived refresh |
| Second save | **PASS** | Same article ID updated; list remained at 5; slug stayed stable after title change |
| Valid slug editing | **PASS** | Own Draft changed to `b6b1-stable-authenticated-qa-20260826-revised` and persisted |
| Invalid/duplicate slug safety | **PASS** | Invalid value disabled safely; duplicate returned safe author-facing error; identity unchanged |
| Tiptap H2/H3/Bold/Italic | **PASS** | Toolbar interaction rendered the expected stored nodes/marks |
| Tiptap Link | **PASS** | Inline URL control; unsafe URL rejected; safe link stored and rendered; no current console errors |
| Tiptap lists/blockquote/undo/redo | **PASS** | Stored body contained bullet list, ordered list, blockquote, and formatting survived refresh |
| Review read-only | **NOT VERIFIED** | Review view contained 0 staging articles; no safe Review record was available |
| Published read-only | **PASS** | Existing Published article rendered read-only with no composer or Save Draft control |
| Authorization smoke | **PARTIAL** | Owner control room/Insights access passed; direct `/admin` was blocked by the browser client before a page response; authorization contract regression passed |
| 1440×900 | **PASS** | Landing, New, Edit; all controls present; no horizontal overflow |
| 768×1024 | **PASS** | Landing, New, Edit; all controls present; no horizontal overflow |
| 390×844 | **PASS** | Landing, New, Edit; all controls present; Advanced slug reachable; no horizontal overflow |

Responsive checks used exact viewport overrides with inner dimensions 1440×900, 768×1024, and 390×844. Save controls remained reachable lower in the page flow, and `scrollWidth` never exceeded the viewport client width.

## Direct staging result

Final staging verification for article `0d2026eb-0dc4-483d-89a0-a789a6966dcd` returned:

- slug: `b6b1-stable-authenticated-qa-20260826-revised`
- status: `draft`
- body type: `object`
- stored body size: 1409 characters
- H2/H3, bold, italic, bullet list, ordered list, blockquote, and link markers: present
- category: present
- revision tag count: 2

No partial/orphan row was observed for the Owner-reported failed attempt. The only new row in this final QA loop is the controlled Draft used for the successful authenticated verification.

## Automated regression gates

- Migration validator: **PASS — 28/28 canonical migrations**
- Phase 5/PageDocument: **PASS — 108/108**
- Phase 6A foundation: **PASS — 6/6**
- Phase 6B1 slug contract: **PASS — 5/5**
- Phase 6B1 authoring/body/slug: **PASS — 6/6**
- Typecheck: **PASS**
- Lint: **PASS**, with one pre-existing unused-variable warning at `scripts/audit-supabase-drift.mjs:316`
- Production build: **PASS**
- Git diff check: **PASS**
- PR validation, Vercel Preview, and Preview Comments: **PASS**

## Decision

Functional Draft authoring, persistence, rich body handling, slug safety, and responsive behavior are **GO for QA completion** on the stable authenticated Preview. PR merge remains **NO-GO** because this is an explicit no-merge gate and the Review-state browser case is unavailable in staging. Keep PR #83 open and unmerged.
