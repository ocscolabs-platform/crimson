# OCSCO Project Crimson — Work Package A / Batch 3A
## Backend Implementation Report

**Status:** BLOCKED for remote application; repository implementation complete for owner review.

**Scope:** Backend contract only. No remote Supabase project was accessed or mutated. No Production, `main`, `staging` merge, application/UI, 3B, 3C, Work Package B, Phase 6, or UI polish work was performed.

## Branch and base

- Feature branch: `codex/phase5-wpa-batch3a-backend`
- Base: canonical Batch 2 closure state, commit `68dd738`
- Canonical migration count before change: 25
- Canonical migration count after change: 26
- Existing staging Homepage Draft: untouched

## Changed files

- `supabase/migrations/20260824000000_add_phase5a_page_document_workflow_contract.sql`
- `scripts/test-phase5a-backend-contract.mjs`
- `docs/DECISIONS.md` — ADR-062
- `OCSCO-CRIMSON-WPA-BATCH3A-BACKEND-IMPLEMENTATION.md`

## Migration #26

Migration #26 adds one coherent backend contract:

1. `pages.published_revision_id` with a restricted foreign key and indexes.
2. Same-page/current-Published pointer integrity through deferred constraint triggers.
3. Fail-closed pointer backfill for exactly `home`, `services`, `about`, and `contact`.
4. Content and projection verification during backfill. The migration aborts if the sole Published candidate does not match the authoritative page row. Drafts and Reviews are not modified.
5. `cms_workflow_audit_log` with actor, page, affected revision, source/related revision, action, status transition, and timestamp fields. Payloads remain in `cms_revisions`.
6. RLS and read-only CMS-member access for workflow audit records.
7. Dedicated PageDocument RPCs.
8. Generic RPC guards that retain safe Draft compatibility while blocking PageDocument workflow bypasses.

## Dedicated RPC contracts

| RPC | Authorization | Contract |
|---|---|---|
| `cms_page_document_save_draft(page_key, payload)` | Owner/Editor | Validates a complete PageDocument; creates or reuses Draft; rejects editing Review. |
| `cms_page_document_submit_for_review(page_key, revision_id)` | Owner/Editor | Exact active Draft → Review transition; payload unchanged. |
| `cms_page_document_return_to_draft(page_key, revision_id)` | Owner/Editor | Exact active Review → Draft transition; payload unchanged. |
| `cms_page_document_publish(page_key, revision_id, expected_updated_at)` | Owner only | Locks page/revision, validates timestamp and payload, archives the current Published revision, publishes the selected Review, updates public projections and pointer, and audits both transitions atomically. |
| `cms_page_document_restore(page_key, source_revision_id)` | Owner only | Archives active Draft/Review in place, creates a new Review clone, leaves source/public state/pointer unchanged, and audits the operation atomically. |

Publish stale protection is enforced inside the transaction. A mismatch returns:

`This revision changed. Reload before publishing.`

## Generic RPC compatibility

- Existing generic Draft save remains available for the four PageDocuments during rollout, including the currently deployed Batch 2 path.
- Generic PageDocument save cannot submit or mutate Review.
- Generic PageDocument Publish must use the dedicated Publish RPC.
- Generic PageDocument Restore must use the dedicated Restore RPC.
- Settings, Navigation, Services, Case Studies, and Work legacy generic consumers retain their existing paths.

## Restore semantics

Restore preserves the active editorial revision’s ID, payload, creator, and creation time while changing only its status to Archived. It then inserts a new Review with a new ID, cloned validated payload, current actor, and current timestamps. The historical source remains unchanged, public content remains unchanged, and `published_revision_id` remains unchanged.

## Audit coverage

The migration records:

- `draft_saved`
- `submitted_for_review`
- `returned_to_draft`
- `publish_archived_previous`
- `published`
- `restore_archived_active`
- `restored_to_review`

Publish therefore records both `Published → Archived` and `Review → Published`, with related revision IDs.

## Verification evidence

### PASS

- `npm run validate:migrations` — 26 canonical migration files; ordering and filename checks passed.
- `node --test scripts/test-phase5a-backend-contract.mjs` — 5/5 tests passed.
- `git diff --check` — passed.
- `npm run lint` — 0 errors; one existing warning in `scripts/audit-supabase-drift.mjs` (`expectedColumn` unused).

### BLOCKED / environment limitations

- `node --test scripts/test-*.mjs` — 20 tests passed; 9 existing application-oriented test files could not load because the isolated Windows worktree path contains spaces and Jiti resolves `%20` paths incorrectly, while project dependencies are not installed in the worktree.
- `npm run typecheck` — blocked by missing project dependencies in the isolated worktree and existing baseline type errors.
- `npm run build` — blocked because the isolated worktree has no local Next dependency and Next inferred the wrong workspace root.
- No SQL was applied to Supabase. No local isolated PostgreSQL/Supabase test database or `psql` executable was available, so actual PostgreSQL parse/apply verification remains an owner review/staging-gate task.

The Batch 3A-specific static contract checks and migration ordering checks pass. The unresolved checks are environment/tooling limitations, not remote database results.

## Safety confirmation

- Remote staging Supabase: untouched.
- Production Supabase: untouched.
- Vercel/deployments: untouched.
- `main`: untouched.
- `staging`: not merged.
- Existing Homepage Draft: untouched and not used as a fixture.
- No application/UI implementation started.

## Review gate

**NO-GO for remote staging application until owner/ChatGPT reviews the migration and accepts the remaining local verification limitations.**
