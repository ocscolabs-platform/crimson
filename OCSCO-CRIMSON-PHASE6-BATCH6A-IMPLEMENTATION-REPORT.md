# OCSCO Project Crimson — Phase 6 Insights

## Work Package A / Batch 6A Implementation Report

**Date:** 2026-08-26  
**Branch:** `codex/phase6-6a-insights-foundation`  
**Base:** live `staging` at `eea1819db1c10e56ce8158f1ab35b62edec25d1c`  
**Mode:** Implementation; feature branch remains unmerged

## Scope delivered

Batch 6A establishes the secure Insights foundation without building the composer, autosave, media pipeline, or public `/insights` routes.

- Added migration `20260826000000_add_phase6a_insights_foundation.sql` after the untouched 26-migration Phase 5 history.
- Added `cms_member_access` with `full_cms` and `insights_only` scopes, `insights_access`, and `can_publish_insights`.
- Added scoped authorization helpers and changed existing `cms_has_role` callers to remain full-CMS-only, preventing Insights-only inheritance of legacy Pages, Global Content, Services, Work, Team, or other administration.
- Added immutable article ownership, article-specific revisions, Draft/Review/Published/Archived revision states, article workflow states, optimistic timestamp checks, repeat-action guards, and workflow audit history.
- Added Category, Tag, article-revision tag relationships, Owner-managed public display-name storage, and revision attribution snapshot support.
- Added Owner/Editor/Trusted Publisher RPC boundaries for create, Draft save, Submit, Withdraw, Return, Publish, Unpublish, and Restore-as-new-Draft.
- Added the safe `insights_published_articles` projection. Base article, revision, audit, and membership data remain unavailable to anonymous users.
- Added the minimum Insights-only admin route and server-side route denial for forbidden broad Crimson areas.
- Added read-only staging verification SQL and static security-contract tests.

## Security contract

Trusted Publisher publication is enforced in the database as capability plus ownership:

`Owner OR (cms_can_publish_insights() AND article.author_id = auth.uid())`

Article ownership is derived by `insights_create_article()` from `auth.uid()` and is immutable. Existing broad CMS RPCs and RLS policies resolve through the full-CMS-only `cms_has_role` boundary.

The static Batch 6A contract suite covers Editor, Trusted Publisher, Owner, anonymous/public isolation, ownership manipulation, route denial, private revisions, audit isolation, category-before-submit/publish, optimistic concurrency, and repeat-action protections. Live RPC/RLS execution requires the migration to be applied to `crimson-staging`; that application remains an Owner review gate and was not performed in this task.

## Validation evidence

- Migration validation: **PASS — 27 canonical migrations; #27 is Batch 6A; migrations 1–26 unchanged.**
- Batch 6A contract tests: **PASS — 6/6.**
- Existing Phase 5/page-document regression tests: **PASS — 108/108.** One stale Batch 2 assertion was aligned to the current dedicated `cms_page_document_save_draft` RPC already used by the live staging code.
- Typecheck: **PASS.**
- Production build: **PASS.**
- Lint: **PASS with one pre-existing warning** in `scripts/audit-supabase-drift.mjs` for unused `expectedColumn`; no lint errors.

## Explicitly not included

No Tiptap dependency, composer, autosave, media buckets, public delivery artifacts, `/insights`, `/insights/[slug]`, comments, collaboration, scheduled publishing, analytics, CRM work, `main` change, Production change, or staging database mutation was made.

## Review recommendation

**GO for Owner review of the feature branch and PR.**  
**NO-GO for merge into `staging` or staging migration application until the Owner-approved live RPC/RLS security matrix and migration verification SQL pass against `crimson-staging`.**
