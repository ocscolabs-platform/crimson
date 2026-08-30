# OCSCO Crimson — Work Library Batch 3A Create-Draft RPC

**Scope:** STAGING-only implementation; no UI

**Base:** `origin/staging` at `eb768c87cc959b3ce0322b0189f5c7fa9a4fdd6a`

## RPC contract implemented

Added `public.cms_create_case_study(p_project_name text)` in:

`supabase/migrations/20260831100000_add_case_study_create_draft_rpc.sql`

The security-definer RPC returns only:

- `id`
- final `slug`

It creates the initial row with only `project_name` and the table-controlled defaults, leaving the existing revision/editor/publish contracts in place.

## Authorization result

- Authenticated current CMS Owners and Editors are allowed through the existing `cms_has_role` boundary.
- Unauthenticated callers and legacy Reviewers are rejected.
- No direct authenticated INSERT grant was added.
- No roles, Team & Access behavior, Insights publishing capability, or service-role browser access was changed.

## Slug strategy

- Project name is trimmed and validated at 1–180 characters.
- The server lowercases and replaces non-ASCII-safe characters with hyphens, trims hyphen edges, and falls back to `case-study` when normalization produces no slug characters.
- A transaction-scoped advisory lock serializes candidates derived from the same base slug.
- Collisions receive deterministic suffixes: `-2`, `-3`, and so on.
- Unexpected uniqueness errors are converted to a safe retry message rather than exposing raw database errors.

## Draft/default behavior

The insert relies on existing defaults for `project_type = 'case-study'`, `status = 'draft'`, `client_visibility = 'hidden'`, empty narrative/list/media fields, `media_status = 'pending'`, `is_featured = false`, and null publication/review timestamps. No service relationship or media row/object is created. The existing case-study audit trigger records the insert.

## Focused tests and validation

- `npm run test:batch3a:case-study-create` — 4 focused contract tests passed.
- `npm run validate:migrations` — passed; 43 canonical migration files, new migration last.
- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `git diff --check` — passed.

The focused tests cover the RPC signature/security boundary, Owner/Editor-only behavior, name validation, slug normalization and deterministic suffixing, safe defaults, audit reuse, and preservation of existing editor/media/relationship/publish paths. Disposable staging mutation verification remains pending protected staging integration.

## Scope exclusions

No `+ New Case Study` UI, `/case-studies/new` page, editor change, Preview change, media/relationship UI change, Work redesign, Scheduled Publishing, Cron/Vault, Insights, Team & Access, Cairnstack, `main`, or Production change was made.

## Release status

Feature branch: `codex/batch-3a-case-study-create-rpc`

Protected PR/staging integration and focused staging database verification: pending.

