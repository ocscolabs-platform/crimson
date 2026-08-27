# OCSCO Project Crimson — Phase 6C1 Final Closure

Date: 2026-08-27  
Public PR: [#87 — feat: add public insights core experience](https://github.com/ocscolabs-platform/crimson/pull/87)  
Public PR head: `58f2e46`  
Hotfix PR: [#88 — fix: allow draft cover alt edits](https://github.com/ocscolabs-platform/crimson/pull/88)  
Hotfix merge: `39d7c0d` into `staging`  
Final staging HEAD: `39d7c0d`

## Result

**WORK PACKAGE C / BATCH 6C1 NOT CLOSED.**

The Cover-alt authoring defect was fixed and merged into staging. The remaining publication gate is blocked by a separate existing B6B3 media/revision-association defect in the controlled QA Draft.

## Required gate results

- Cover-alt hotfix: PASS — existing Cover alt text can be edited and saved without replacing the asset; the same Cover ID persisted after refresh and private Preview showed the updated alt text.
- Hotfix PR/merge result: PASS — PR #88 merged through protected GitHub workflow with 3/3 checks successful.
- Migration parity: PASS — 30/30; no new migration.
- Controlled article Publish: FAIL — normal Submit for Review still rejects the Draft.
- `/insights` listing: FAIL — no live Published QA article was available; the public listing correctly showed the empty state after cleanup.
- `/insights/[slug]`: FAIL — the live Published detail route could not be exercised.
- Cover artifact: FAIL — not exercised on a live Published article.
- Inline artifact: FAIL — not exercised on a live Published article.
- SEO/OG: FAIL — implementation and automated checks pass, but live article metadata could not be verified without a Published article.
- 1440×900: FAIL — detail unavailable; landing passed previously.
- 768×1024: FAIL — detail unavailable; landing passed previously.
- 390×844: FAIL — detail unavailable; landing passed previously.
- Public/private isolation: PASS — public loaders remain Published-projection-only, private canonical media is not used by public routes, and Draft/Review/Unpublished/unknown article slugs return the normal 404. Live Published artifact access was not exercised because publication was blocked.
- QA article Unpublish: FAIL — the controlled article never reached Published, so no Unpublish transition was performed; it remains a private Draft.
- PR #87 merge: FAIL — merge withheld and not attempted because the public detail/media hard gate did not pass.
- Security Advisor: PASS — no new error was identified; the previously verified staging result remains 0 errors.

## Exact blocker

Read-only staging verification shows the controlled Draft has one ready Cover and one ready inline asset, but zero ready assets matching its active revision. The Draft was produced through the existing restore path, which copied media relationships without re-associating the canonical media assets to the new active revision. `insights_revision_is_publishable` correctly rejects that mismatch. The Cover-alt hotfix does not and should not alter those revision associations.

Resolving this requires a separately scoped B6B3 restore/media-association fix or a fresh normal CMS media package. The requested QA instruction explicitly prohibits replacing the Cover merely for this test, and no SQL, Storage, or workflow bypass was used.

## Validation

- `npm run test:phase6b3:cover-alt`: PASS (2/2)
- `npm run test:phase6c1:public`: PASS (2/2)
- `npm run test:phase6b3:media`: PASS (6/6)
- `npm run test:phase6:public-projection-security`: PASS (5/5)
- `npm run validate:migrations`: PASS (30 canonical migrations)
- `npm run typecheck`: PASS
- `npm run lint`: PASS with existing warnings only
- `npm run build`: PASS
- `git diff --check`: PASS
- PR #87 synchronized with current staging hotfix; current checks: 3/3 successful.
- `main` and Production were not touched.

## Next step

**NO-GO for Batch 6C2.** Do not begin 6C2. Resolve the separate media/revision-association blocker, then repeat only the real Published article-detail/media gate before merging PR #87.

