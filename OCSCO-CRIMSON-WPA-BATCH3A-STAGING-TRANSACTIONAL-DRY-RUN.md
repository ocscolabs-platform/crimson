# OCSCO Project Crimson — WPA / Batch 3A
## Staging Transactional Migration Dry-Run

**Result:** FAIL — canonical migration #26 did not parse successfully.  
**Environment:** `crimson-staging` only  
**Supabase project:** `sdfbcgctquagfcrkvoyw`  
**Date:** 2026-08-25  
**Permanent migration application:** Not performed

## Repository checkpoint

The authorized implementation checkpoint was reconciled before database access.

- Feature branch: `codex/phase5-wpa-batch3a-backend`
- Documentation-only difference from the previously reported HEAD: `OCSCO-CRIMSON-WPA-BATCH3A-STAGING-DRY-RUN.md`
- Existing untracked read-only preflight report was inspected, contained no secrets, and was committed as documentation:
  `9b8034cf9f742405ec40db1d9df64721d3d5df01`
- Execution checkpoint HEAD: `9b8034cf9f742405ec40db1d9df64721d3d5df01`
- Worktree was clean before staging execution
- Repository migration count: `26`
- Canonical migration #26:
  `supabase/migrations/20260824000000_add_phase5a_page_document_workflow_contract.sql`
- Migration #26 blob matched the approved implementation exactly:
  `1bcec22444854b529345e13d8e83e70d79f970c7`

No implementation file, migration, test, RPC contract, configuration, or dependency was changed.

## Environment confirmation and preflight

The authenticated SQL Editor showed:

`SQL Editor | crimson-staging | ocscolabs-platform | Supabase`

The active project URL was under `/dashboard/project/sdfbcgctquagfcrkvoyw/`. Production was not selected or accessed.

The read-only preflight passed immediately before the transaction:

| Check | Result |
|---|---|
| Applied migration count | `25` |
| Latest applied migration | `20260823030000` |
| `pages.published_revision_id` absent | `true` |
| `cms_workflow_audit_log` absent | `true` |
| Homepage Draft revision | `4d552d8b-b231-4ebd-98cc-882c10d20bfb` |
| Homepage Draft status | `draft` |
| Homepage Draft headline | `Digital infrastructure, built with precision.` |
| Homepage Published headline | `Digital infrastructure for brands ready to move with precision.` |
| Homepage Draft payload fingerprint | `7f4b31f2d419ac8b557bf3940148a4f3` |

Baseline revision counts were:

| Page | Draft | Review | Published | Archived |
|---|---:|---:|---:|---:|
| `home` | 1 | 0 | 1 | 0 |
| `services` | 0 | 0 | 1 | 0 |
| `about` | 0 | 0 | 1 | 0 |
| `contact` | 0 | 0 | 1 | 0 |

## Transaction execution

The exact contents of migration #26 were loaded from the canonical repository file and executed in the SQL Editor as:

```sql
BEGIN;

[complete, unmodified contents of migration #26]

[in-transaction verification SELECT]

ROLLBACK;
```

The batch contained no `COMMIT`. Supabase displayed a destructive-operation warning because the migration contains DDL; the authorized run was explicitly confirmed.

### Exact PostgreSQL error

The complete migration batch failed during parsing:

```text
ERROR: 42601: syntax error at end of input
LINE 270: and page_row.content->'seo'->'ogImageRef'->>'key' = 'default'
^
```

The error was reported in the migration's fail-closed Published backfill block. The migration was not modified, and no unrelated fix was attempted. The in-transaction verification SELECT therefore did not complete.

## Rollback evidence

Because the batch failed, an explicit standalone `ROLLBACK;` was issued immediately afterward. Supabase returned:

```text
Success. No rows returned
```

No workflow RPCs were called and no real content was mutated.

## Post-rollback verification

All post-rollback checks returned `true`:

| Check | Result |
|---|---|
| `pages.published_revision_id` absent | true |
| `cms_workflow_audit_log` absent | true |
| Pointer indexes/triggers absent | true |
| Dedicated migration functions absent | true |
| Applied migration count remains 25 | true |
| Latest migration remains `20260823030000` | true |
| Home/Services/About/Contact revision counts preserved | true |
| Homepage Draft ID/status/payload/headline preserved | true |
| Homepage Published headline preserved | true |

Therefore, no migration #26 artifact persisted after rollback.

## Decision and next gate

**Do not permanently apply migration #26.** The dry-run is not a qualification pass. The owner/ChatGPT next gate is migration defect review and correction of the canonical repository migration, followed by a new authorized dry-run. No production, merge, deployment, UI implementation, or workflow acceptance testing was performed.
