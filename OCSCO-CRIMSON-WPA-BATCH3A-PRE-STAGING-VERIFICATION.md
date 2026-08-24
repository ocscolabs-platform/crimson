# OCSCO Project Crimson — Work Package A / Batch 3A
## Pre-Staging Backend Verification Report

**Decision state:** CONDITIONAL PASS for repository review; BLOCKED for actual database execution and staging authorization.

**Hard stop honored:** Migration #26 was not applied to staging. Production, `main`, `staging`, the application/UI, 3B, 3C, Work Package B, Phase 6, and UI polish were not touched. The existing Homepage Draft was not accessed or mutated.

## 1. Repository and commit state

- Feature branch: `codex/phase5-wpa-batch3a-backend`
- Base commit: `68dd73847380433fca74db305cfd7f7741c404b3`
- Implementation starting HEAD: `efd813d4a32e254cc41394b4a0c915570aea824e`
- Final verification HEAD: reported in the handoff after approved-scope hardening is committed.
- Implementation was already committed before this verification gate.
- Original worktree: clean before verification changes.
- Changed files in the implementation commit: migration #26, Batch 3A static contract test, ADR-062, and the implementation report.
- Verification hardening changes: CRLF-normalized static test signatures; generic PageDocument Publish rejection made lock-order safe; dedicated Publish now fails closed when the current Published pointer is missing.

## 2. Isolated verification environment

A detached temporary worktree was created at:

`C:\Users\Lenovo\OneDrive\Documents\OSCO\crimson-batch3a-verify`

This path contains no spaces, so it removes the earlier Jiti `%20` path issue. The repository lockfile was used with `npm ci --ignore-scripts` and a separate local npm cache. npm failed with:

`npm error Exit handler never called!`

The worktree therefore contained incomplete dependency directories rather than a valid installed dependency set. No tracked files were modified by the install attempt.

## 3. Verification commands and results

### PASS

- `npm run validate:migrations`
  - 26 canonical migration files found.
  - Migration #26 is ordered last:
    `20260824000000_add_phase5a_page_document_workflow_contract.sql`
- `node --test scripts/test-phase5a-backend-contract.mjs`
  - 5/5 Batch 3A contract tests passed after CRLF normalization.
- `git diff --check`
  - No diff whitespace errors.
- `npm run lint` in the original implementation worktree
  - 0 errors.
  - One pre-existing warning in `scripts/audit-supabase-drift.mjs` for unused `expectedColumn`.

### Baseline/tooling failures

- `node --test scripts/test-*.mjs`
  - 20 tests passed.
  - 9 application-oriented test files could not load because the isolated dependency installation did not complete. The earlier space-containing worktree additionally produced Jiti `%20` resolution failures; the short-path rerun removed the path-space factor but still lacked usable dependencies.
- `npm run lint` in the short-path worktree
  - Blocked by incomplete ESLint installation.
- `npm run typecheck`
  - Blocked by incomplete dependencies and existing baseline TypeScript errors.
- `npm run build`
  - Blocked by incomplete dependencies and Next.js workspace-root inference; no application files were changed in this task.

These failures are environment/baseline verification limitations, not evidence of a Batch 3A migration regression.

## 4. Local PostgreSQL/Supabase execution

Local SQL execution is **BLOCKED**.

The repository contains `supabase/config.toml` for local configuration and declares PostgreSQL major version 15, but this environment has none of the required execution tools:

- Supabase CLI: unavailable.
- Docker: unavailable.
- PostgreSQL `psql`: unavailable.
- Local PostgreSQL/Supabase container: unavailable.

No migration was applied to any database. PostgreSQL parse, clean rebuild, migration 1–25 baseline verification, migration #26 application, and synthetic RPC execution could not be honestly claimed.

## 5. Independent migration #26 review

The actual SQL file was reviewed directly, independently of the static test script.

### Published pointer

`public.pages.published_revision_id`:

- is a UUID foreign key to `public.cms_revisions(id)`;
- uses `ON DELETE RESTRICT`;
- has a lookup index and a partial unique index so one revision cannot be current for multiple pages;
- is checked by deferred constraint triggers on both `pages` and `cms_revisions`;
- must reference an approved PageDocument page, a `page` revision for the same page ID, and a revision whose status is `published`.

During Publish, the selected Review is locked, the previous pointed Published revision is locked and changed to Archived, the selected revision is changed to Published, and the page pointer is updated to the selected revision in the same transaction. The deferred triggers tolerate the intermediate state inside that transaction and validate the final state at commit. If any final pointer or revision invariant fails, the transaction aborts and the prior public state remains intact.

The dedicated Publish RPC now also fails closed before any publication if the target page has no current Published pointer.

### Backfill

The backfill is limited to the four exact slugs:

- `home`
- `services`
- `about`
- `contact`

For each page it requires exactly one `cms_revisions` row with `entity_type = 'page'`, the page ID as `entity_key`, and `status = 'published'`. It aborts on zero or multiple candidates.

The candidate is compared against:

- `pages.title`;
- `pages.page_purpose`;
- `pages.audience`;
- the complete `pages.content` PageDocument object;
- `pages.published_at` versus candidate `published_at`;
- `pages.status = 'published'` and non-null `published_at`;
- `pages.seo_title` versus `content.seo.title`;
- `pages.seo_description` versus `content.seo.description`;
- `pages.og_image_path` versus the approved generated/default projection `/opengraph-image`.

Any mismatch aborts the migration. The block only updates `pages.published_revision_id`; it does not insert, update, archive, delete, or recreate any revision. The existing Homepage Draft therefore remains untouched.

### SECURITY DEFINER safety

Every new or replaced SECURITY DEFINER function sets `search_path = public`:

- workflow audit writer;
- pointer-integrity trigger function;
- five dedicated PageDocument RPCs;
- replaced generic Save, Publish, and Restore RPCs.

Dedicated RPCs enforce the required Owner/Editor/Reviewer boundaries through `cms_has_role`, validate the four-page allowlist, lock and verify page/revision ownership, and validate PageDocument payloads. The audit writer and trigger function are internal-only with public execution revoked; dedicated RPCs are explicitly granted only to `authenticated`. Generic RPCs retain authenticated execution for legacy consumers but reject prohibited PageDocument operations.

### Direct-table safety

- `pages`: authenticated insert/update/delete privileges were already revoked by the prior direct-write lock migration; migration #26 adds no write grant.
- `cms_revisions`: authenticated direct writes are already revoked; authenticated access is read-only.
- `cms_workflow_audit_log`: authenticated direct insert/update/delete is revoked; authenticated CMS members receive select access only.

### Generic RPC guards

For the four approved PageDocuments:

- generic Draft Save remains compatible for the Batch 2 application path when no active revision or an active Draft exists;
- generic Draft Save rejects an active Review and cannot silently return it to Draft;
- generic Save cannot submit to Review;
- generic Publish rejects before locking the revision and requires the dedicated Publish RPC;
- generic Restore rejects PageDocument history and requires the dedicated Restore RPC.

The guard uses the page slug allowlist, so legacy Work remains outside the PageDocument path. Settings, Navigation, Services, Case Studies, and Work legacy behavior remains in the replaced generic functions.

## 6. Dedicated RPC execution tests

Actual database execution was not available. The following are contract-level conclusions from direct SQL review, not live execution claims:

- Owner/Editor Draft Save, Submit, Return are role-gated.
- Owner-only Publish and Restore are role-gated.
- Reviewer has no mutation role through the dedicated RPCs.
- Review payload mutation is rejected by dedicated Save and generic Save.
- Submit and Return are explicit status-only transitions.
- Publish checks the locked revision’s current `updated_at` against `p_expected_updated_at` inside the transaction.
- Restore archives active editorial state in place and inserts a new Review ID.

The requested synthetic Owner/Editor/Reviewer execution matrix, stale publish replay, atomicity failure injection, and Restore assertions remain blocked pending an isolated PostgreSQL/Supabase runtime.

## 7. Workflow audit verification

The schema supports the complete action taxonomy:

- `draft_saved`;
- `submitted_for_review`;
- `returned_to_draft`;
- `publish_archived_previous`;
- `published`;
- `restore_archived_active`;
- `restored_to_review`.

Each writer supplies actor, page, affected revision, optional source/related revision, previous status, new status, and the database timestamp. Publish writes two events: the prior Published → Archived event and selected Review → Published event. Restore writes the active-row archival event and the new Review event. Payloads are not duplicated into the audit table.

## 8. Transitional Batch 2 compatibility

The current Batch 2 action sends a complete PageDocument payload to the existing generic `cms_save_revision` RPC with `p_status = 'draft'`. Migration #26 preserves that path for an absent or active Draft revision. It does not require a new RPC for the already-deployed Draft Save behavior.

Public Published routes remain unchanged because migration #26 does not change public loaders or rendering. Legacy Global Content, Services, Case Studies, Navigation, Settings, and Work consumers retain their generic RPC contracts.

## 9. Read-only staging preflight

**Not performed.** No approved authenticated read-only Supabase connector or owner-provided staging database access was available in this task. The ambient browser tab was not used as a database connector. No staging query, RPC, mutation, or configuration access occurred.

Therefore, the live counts of Draft, Review, Published, and Archived rows for Home, Services, About, and Contact remain independently unverified. The Homepage Draft headline and public Published headline were not queried or exposed during this verification, and the existing Draft remains protected by scope.

## 10. Remaining blockers and decision

Blockers before migration #26 can be authorized for staging:

1. Run migration #26 against an isolated local PostgreSQL/Supabase environment, if one is provisioned.
2. Execute the synthetic role, stale-publish, atomicity, Restore, audit, and direct-write test matrix.
3. Obtain a separate approved read-only staging connector and perform the four-page preflight.
4. Re-run the complete dependency-based repository suite after a successful normal dependency installation.

**Current gate:** CONDITIONAL PASS for repository review; BLOCKED for database execution and live preflight; NO authorization to apply migration #26 to staging is implied.
