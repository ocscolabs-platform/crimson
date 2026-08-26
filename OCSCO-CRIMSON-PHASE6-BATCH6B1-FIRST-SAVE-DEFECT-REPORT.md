# OCSCO Crimson Phase 6 — Batch 6B1 First-Save Defect Report

Date: 2026-08-26  
Branch: `codex/phase6-6b1-draft-authoring-v2`  
PR: #83 (open, unmerged)

Fix commit: `9b3509444cd9e8cdb1f5247b36d0b772c890603b`

## Investigation result

The Owner-reported attempted article was not present in staging. A direct read of the staging `insights_articles` table, joined to the active revision, found no article created during the QA window and no corresponding Draft revision. The newest returned rows were older, unrelated Phase 6A smoke records. There is therefore no evidence that the reported attempt persisted a title, body, slug, article identity, or orphan revision.

The PR preview loaded and enforced the CMS login boundary, but the available browser session had no authenticated CMS session. The reported authenticated Save Draft request and its Vercel/Next.js/Supabase runtime stack could not be replayed or captured from this environment. This remains an explicit live-QA blocker; no claim is made that the precise server exception was reproduced here.

## Defect confirmed in the submitted B6B1 path

The submitted composer consumed the server action's successful state only as inline feedback. It did not use the returned article ID to transition a first save from `/articles/new` to the persisted `/articles/[id]` route. The action also allowed unexpected exceptions to escape the Server Action boundary, which could surface as the generic Next.js error page, and it discarded a server-created article identity from error states. The latter could cause a retry to start a second create attempt after a post-create failure.

## Fix

- Wrap the first-save action in a server-side safety boundary.
- Log unexpected failures server-side without exposing Supabase or SQL details.
- Return safe, retryable author-facing messages while preserving any created article identity.
- Keep the returned identity in the composer so a retry targets the same article.
- Navigate a successful new-article save to `/crimson-admin-control/insights/articles/[id]`.
- Add a focused regression test for first-save error safety, identity preservation, and success navigation.

No migration or schema change was required. No direct article-table mutation was added. No Publish, Submit, Preview, media, public Insights, B6B2, B6B3, `main`, or Production work was performed.

## QA status

Automated regression gates pass: migration validator 28/28; Phase 5/PageDocument 108/108; Batch 6A 6/6; slug contract 5/5; B6B1 authoring 6/6; typecheck; lint with one pre-existing warning; build; and diff check. PR validation and Preview deployment also pass.

Authenticated first-save, refresh, second-save, failure-safety, and responsive checks at 1440×900, 768×1024, and 390×844 remain Owner-session checks and are not marked passed from this environment.

## Decision

**NO-GO for merge until the Owner repeats the authenticated first-save and responsive QA on PR #83 Preview.** Keep PR #83 open and unmerged.
