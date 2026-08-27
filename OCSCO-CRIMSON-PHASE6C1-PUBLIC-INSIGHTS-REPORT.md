# OCSCO Project Crimson — Phase 6C1 Public Insights Core Report

Date: 2026-08-27  
Branch: `codex/phase6-6c1-public-insights-core`  
Target: `staging`  
Commit: `5bebcf4991f467ad5b9be3fc6c741b8c2ec151e7`  
PR: [#87 — feat: add public insights core experience](https://github.com/ocscolabs-platform/crimson/pull/87)

## Implementation summary

Implemented the Batch 6C1 public reading surface:

- Added public `/insights` listing and `/insights/[slug]` detail routes.
- Added the exact `Insights` item to the primary navigation, including the database-navigation fallback when the configured navigation is missing it.
- Reused the existing safe Insights body renderer; the public routes do not load the editor bundle.
- Added Published-only article cards and detail metadata for title, excerpt, category, tags, author, and published date.
- Added stable Published cover and inline media URL resolution from the approved public media bucket.
- Added canonical, Open Graph, Twitter, and article publication metadata.
- Added responsive editorial list/detail styling.
- Added focused automated contract coverage for data isolation, routes, navigation, renderer reuse, and migration stability.

## Public data boundary and security

The public loaders query only `insights_published_articles`. They do not query private editorial tables, expose article/revision identifiers, or use authenticated editorial clients. Body validation runs before and after stable Published media URL resolution. Unpublished, Draft, Review, missing, and malformed records are not rendered publicly.

No new migration was created. The canonical migration count remains 30, with migration 30 as the latest migration. No Production or `main` changes were made.

The previously verified staging Security Advisor result remains 0 errors. No credentials, tokens, signed media URLs, or local environment values are included in this report or commit.

## QA and cleanup

The known fake Published QA records were returned to `UNPUBLISHED` through the normal Owner workflow before public exposure:

- `Post-merge TP Smoke`
- `Editor Draft Complete`
- `Publisher Draft`

The controlled media QA record `B6B3 Editor QA 84935627` remains a private `DRAFT`. Its cover and inline media remain private. No temporary record was left Published.

The public PR Preview landing page showed the Published-only empty state, `New thinking is on its way.` This confirms that cleaned staging QA records are not visible through the public surface.

## Browser results

- Public `/insights`: PASS — loads unauthenticated in the PR Preview and shows the Published-only empty state after cleanup.
- Primary navigation: PASS — exact `Insights` link present.
- Unpublished known slug: PASS — normal `404 / This page could not be found.`
- Unknown slug: PASS — normal `404 / This page could not be found.`
- `1440×900`: PASS — no horizontal overflow.
- `768×1024`: PASS — no horizontal overflow.
- `390×844`: PASS — no horizontal overflow.
- Public Published article detail with live cover and inline media: BLOCKED — no valid Published QA article remained after the required cleanup, and the existing temporary Draft's cover metadata could not be repaired through the available normal form without uploading a replacement asset. No private storage or database bypass was used.

## Automated validation

- `npm run typecheck`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS; public routes compile as dynamic `/insights` and `/insights/[slug]` routes.
- `npm run test:phase6c1:public`: PASS (2/2)
- `npm run test:phase6b3:media`: PASS (6/6)
- `npm run validate:migrations`: PASS (30 canonical migrations)
- `git diff --check`: PASS

## Scope and gate

Batch 6C2 search, filtering, related content, pagination, recommendations, advanced SEO, and analytics remain out of scope.

GO for Owner review of the implemented 6C1 code and automated/public landing-route checks. NO-GO for final public-release sign-off until the staging Owner can provide or create one valid Published QA article with cover and inline media for the final detail/media smoke, after which it must be returned to Unpublished.

