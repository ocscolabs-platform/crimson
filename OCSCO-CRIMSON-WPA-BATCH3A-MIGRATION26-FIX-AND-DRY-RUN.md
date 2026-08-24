# OCSCO Project Crimson — WPA / Batch 3A
## Migration #26 Defect Correction and Transactional Staging Dry-Run

**Result:** PASS — corrected migration #26 executed successfully inside a transaction and rolled back completely.  
**Environment:** `crimson-staging` only  
**Supabase project:** `sdfbcgctquagfcrkvoyw`  
**Permanent application:** Not performed; still forbidden

## Repository checkpoint and correction

- Branch: `codex/phase5-wpa-batch3a-backend`
- Failed dry-run execution checkpoint: `9b8034cf9f742405ec40db1d9df64721d3d5df01`
- Documentation-only commits existed after that checkpoint; no unauthorized implementation changes were found.
- Correction commit: `3e38d76e755050187b5bf1e9dd8ad77b7de1d51b`
- Corrected migration blob: `b5feb8bfd9663c8212432c554834378808e6ad38`
- Migration file: `supabase/migrations/20260824000000_add_phase5a_page_document_workflow_contract.sql`
- Repository migration count: `26`
- Worktree was clean before staging execution.

The approved architecture and workflow semantics were not changed. The only implementation correction was parenthesizing one existing `CASE` expression. One static contract assertion was added to prevent regression.

## Original defect diagnosis

The first dry-run returned:

```text
ERROR: 42601: syntax error at end of input
LINE 270: and page_row.content->'seo'->'ogImageRef'->>'key' = 'default'
^
```

The failing construct was the fail-closed Published backfill `IF` condition. Its `CASE` expression was written directly inside `IS DISTINCT FROM` without expression-level parentheses. In a PL/pgSQL `IF` condition, that left the nested `CASE` terminator and the outer `IF ... THEN` terminator insufficiently delimited for PostgreSQL's condition parser. PostgreSQL treated the condition as incomplete and reported end-of-input near the nested `CASE` condition.

### Before

```sql
      or page_row.og_image_path is distinct from case
        when page_row.content->'seo'->'ogImageRef'->>'kind' = 'generated'
          and page_row.content->'seo'->'ogImageRef'->>'key' = 'default'
        then '/opengraph-image'
        else null
      end
    then
```

### After

```sql
      or page_row.og_image_path is distinct from (
        case
          when page_row.content->'seo'->'ogImageRef'->>'kind' = 'generated'
            and page_row.content->'seo'->'ogImageRef'->>'key' = 'default'
          then '/opengraph-image'
          else null
        end
      )
    then
```

The comparison, generated OG path, `NULL` fallback, and fail-closed behavior are unchanged.

## Full migration structural review

The complete 1,156-line migration was reviewed after correction. The review covered both `DO $$` blocks, all function bodies, `CASE` expressions, `IF/ELSIF/ELSE` branches, dollar-quoted bodies, block terminators, trigger definitions, constraints, policies, grants, and revokes.

The backfill `CASE` inside an `IF` is now explicitly parenthesized. The other migration `CASE` is an `UPDATE` assignment and is structurally complete. No additional unparenthesized `CASE`-inside-`IF` defect or incomplete block was found.

## Local validation

| Check | Result |
|---|---|
| `npm run validate:migrations` | PASS — 26 canonical migration files |
| `node --test scripts/test-phase5a-backend-contract.mjs` | PASS — 5 tests |
| `git diff --check` | PASS |
| `npm run lint` | PASS — 0 errors, 1 pre-existing warning in `scripts/audit-supabase-drift.mjs` |

The regression assertion checks that the backfill uses the parenthesized `CASE` structure.

## Staging preflight

The authenticated SQL Editor showed `crimson-staging` and the project URL under `/dashboard/project/sdfbcgctquagfcrkvoyw/`. Production was not selected or accessed.

The preflight immediately before the corrected run returned `true` for all baseline checks:

- applied migration count `25`;
- latest migration `20260823030000`;
- `pages.published_revision_id` absent;
- `cms_workflow_audit_log` absent;
- Homepage Draft ID `4d552d8b-b231-4ebd-98cc-882c10d20bfb`;
- Draft status, headline, and payload fingerprint preserved;
- Published Homepage headline preserved.

Draft payload fingerprint:

`7f4b31f2d419ac8b557bf3940148a4f3`

## Transaction execution

The complete corrected canonical migration file was loaded verbatim and executed in one SQL Editor batch:

```sql
BEGIN;

[complete corrected migration #26]

[in-transaction verification SELECT]

ROLLBACK;
```

The batch contained no `COMMIT`. PostgreSQL accepted and executed the complete corrected migration. The verification query returned one successful result row before the required `ROLLBACK`.

## In-transaction verification

Every verification flag returned `true`.

### Schema, security, and RPC contract

- `pages.published_revision_id` exists with UUID type: true
- Foreign key to `cms_revisions(id)` with `ON DELETE RESTRICT`: true
- Pointer index and unique pointer index: true
- Pointer function and both deferred integrity triggers: true
- Workflow audit table columns: true
- Workflow audit RLS enabled: true
- Authenticated audit SELECT grant: true
- Authenticated direct INSERT/UPDATE/DELETE denied: true
- CMS-member audit read policy: true
- Dedicated PageDocument RPC signatures: true
- Dedicated RPC authenticated grants: true
- Publish expected-`updated_at` stale protection: true
- Generic PageDocument guards: true
- Legacy generic RPC grants: true

### Backfill

All four temporary pointers matched the exact preflight Published candidates, and each pointed to a same-page Published revision:

| Page | Pointer | Expected | Same-page Published |
|---|---|---|---|
| `home` | `c26b7cca-f054-4638-9fc1-8d96444d2a43` | `c26b7cca-f054-4638-9fc1-8d96444d2a43` | true |
| `services` | `55ed5368-8161-466e-8a8d-dcc4cbf971f1` | `55ed5368-8161-466e-8a8d-dcc4cbf971f1` | true |
| `about` | `d6b1cecf-a900-4277-9bb6-212f1ceb8f69` | `d6b1cecf-a900-4277-9bb6-212f1ceb8f69` | true |
| `contact` | `a6a40e8f-8cf0-4b79-9473-e19ddaa01cda` | `a6a40e8f-8cf0-4b79-9473-e19ddaa01cda` | true |

### Homepage protection

All protection flags returned `true`:

- Draft revision ID unchanged;
- Draft remained `draft`;
- Draft payload fingerprint unchanged;
- Draft headline remained `Digital infrastructure, built with precision.`;
- Published headline remained `Digital infrastructure for brands ready to move with precision.`;
- revision counts remained unchanged inside the transaction.

No workflow RPC was called and no real content mutation was performed.

## Rollback and post-rollback proof

The corrected batch ended with `ROLLBACK;`. Subsequent SELECT-only checks returned `true` for every check:

- `pages.published_revision_id` absent again;
- `cms_workflow_audit_log` absent again;
- pointer indexes and triggers absent;
- dedicated migration functions absent;
- applied migration count remained `25`;
- latest migration remained `20260823030000`;
- Home, Services, About, and Contact revision counts preserved;
- Homepage Draft ID, status, payload fingerprint, and headline preserved;
- Published Homepage headline preserved.

No migration #26 artifact persisted.

## Decision

The corrected migration is **qualified by this transactional dry-run**, but it is **not permanently applied**. Permanent staging application remains a separate owner/ChatGPT authorization gate. No Production, `main`, `staging` merge, deployment, application/UI implementation, 3B, 3C, Work Package B, or Phase 6 work was started.
