# OCSCO Project Crimson — Phase 6C1 Closure

Date: 2026-08-27  
PR: [#87 — feat: add public insights core experience](https://github.com/ocscolabs-platform/crimson/pull/87)  
Branch: `codex/phase6-6c1-public-insights-core`  
Validated PR head: `cc57b2f` (`docs: add phase 6c1 public insights report`)  
Final staging HEAD: `72a5d2016da93443f55c31f3d4e90a6fb91bc4af`  
Merge SHA: not applicable — PR #87 was not merged.

## Required result

**BATCH 6C1 NOT CLOSED.**

The implementation and public landing-route checks passed, but the final Published article detail/media hard gate could not be completed.

## Gate results

- Controlled Published QA article: FAIL — a valid new Published QA article with cover and inline media was not created.
- `/insights` listing with Published article: FAIL — cleanup correctly left the Published projection empty, so no live card was available for detail verification.
- `/insights/[slug]`: FAIL — missing and unpublished slugs returned the normal 404, but a live Published detail page was not available to verify.
- Cover public artifact: FAIL — not exercised on a live Published article.
- Inline public artifact: FAIL — not exercised on a live Published article.
- SEO/OG live: FAIL — static implementation and automated route checks passed, but live article metadata could not be verified without a Published article.
- 1440×900 detail: FAIL — landing passed; detail unavailable.
- 768×1024 detail: FAIL — landing passed; detail unavailable.
- 390×844 detail: FAIL — landing passed; detail unavailable.
- Public/private isolation: PASS — public loaders are Published-projection-only; unpublished/unknown slugs returned 404; no private storage bypass was used.
- QA article Unpublish cleanup: PASS — existing fake Published QA records were returned to Unpublished through the normal Owner workflow; the controlled media record remains a private Draft.
- PR #87 merge: NOT ATTEMPTED — conditional merge was correctly withheld.
- Migration parity 30/30: PASS.
- Security Advisor: PASS — previously verified staging result remains 0 errors.

## Exact blocker

The staging Owner workflow has no cover-alt-only update action. Existing temporary Draft media has missing cover alternative text, so Submit for Review rejects it. Creating a fresh media package requires a file upload, but the available in-app browser interaction cannot provide a local file to the file input. Direct SQL, private Storage manipulation, and workflow bypasses were not used.

To close 6C1, the Owner must provide one staging-safe cover and inline image through the normal CMS upload flow, publish the labelled QA article, complete the live detail/media checks, then Unpublish it through the normal workflow.

## Verified implementation checks

- `npm run test:phase6c1:public`: PASS (2/2)
- `npm run test:phase6b3:media`: PASS (6/6)
- `npm run validate:migrations`: PASS (30 canonical migrations)
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS
- PR #87: open, targeting `staging`, 3/3 checks successful after the report commit.
- `main` and Production were not touched.

## Next step

**NO-GO for Batch 6C2.** Complete the 6C1 Published article detail/media gate first. Do not begin 6C2.

