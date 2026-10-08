# Supabase release pipeline

## Scope

This document defines the Phase 4C database release boundary and the deferred Production release gate. It does not replace the CMS content workflow.

- Staging project: `crimson-staging`
- Production project: `ocscolabs-platform-website-crm`
- Canonical history: `supabase/migrations`
- Shared physical catalog contract: `scripts/verify-supabase-catalog-contract.mjs`
- Workflow: `.github/workflows/supabase-release.yml`
- Pinned Supabase CLI: `2.111.0` (stable)

## Release flow

```text
feature/* → CI validation → staging migration apply → owner QA
          → staging → main → Production dry run → owner approval → Production apply
```

The Supabase projects remain separate. A Git merge moves application code and migration files; it does not apply a database migration, copy rows, copy Auth users, copy Storage objects, or copy environment configuration.

## Canonical migration rules

1. Add every schema, RLS, function, trigger, grant, and Storage-policy change as a new timestamped SQL migration.
2. Preserve existing migration filenames and contents after they have been applied. Do not rename, delete, or rewrite historical migrations for cosmetic cleanup.
3. Keep migrations environment-neutral. Project URLs, keys, passwords, users, memberships, SMTP settings, and Auth callback values do not belong in SQL migrations.
4. Run `npm run validate:migrations` in CI and before release work.
5. Keep `supabase link` for exact project association, then use the masked staging Shared Session Pooler URL with `--db-url` for migration status, dry-run, and application commands. This avoids the direct linked IPv6 route that GitHub-hosted runners cannot reach.
6. After a staging apply, compare the ordered canonical timestamp set with `supabase_migrations.schema_migrations`; parity, zero duplicates, and zero pending versions are required for success.
7. After ledger parity passes, run the shared read-only catalog contract against the same approved database transport. Ledger parity and physical catalog parity are separate gates.

## Staging

On a push to `staging` that changes the migration surface, the workflow:

1. runs lint, typecheck, migration validation, and the production build;
2. links to the project ref configured in the protected `staging-supabase` GitHub Environment;
3. confirms the configured Supabase project identity is `crimson-staging`;
4. percent-encodes the protected database password, masks both the encoded password and complete Shared Session Pooler URL, then records migration status and runs a dry run through `--db-url`;
5. applies all pending canonical migrations in order through `supabase db push --db-url "$STAGING_POOLER_DB_URL" --yes`;
6. verifies exact repository/database migration parity and fails closed on duplicates, unexpected remote versions, or pending versions;
7. runs the shared read-only physical catalog contract and fails on missing or mismatched CMS tables, structural columns, functions, triggers, RLS policies, grants, or Storage contracts.

The workflow path itself is included in the staging trigger so a pipeline correction is exercised by the next protected `staging` push. Project linking remains in place for association and identity safeguards, while database-bearing migration commands use the IPv4-reachable Shared Session Pooler. If no migrations are pending, the apply command is an idempotent no-op and the same parity gate still passes. The staging job cannot apply unless the event ref is exactly `refs/heads/staging`, the target project identity check passes, and the staging environment configuration is present.

The staging environment must provide only owner-managed GitHub Environment configuration. No Supabase access token, database password, or project-specific secret is committed.

## Production

On a push to `main`, the workflow validates the same repository state and performs a non-mutating Production migration plan. It authenticates through the protected `production-supabase` Environment, confirms the exact `ocscolabs-platform-website-crm` project through the Management API, retains project linking, constructs and masks the Shared Session Pooler URL, and requires the existing Production ledger to be an exact duplicate-free prefix of canonical Git history before showing status or running `supabase db push --dry-run`. When no migrations are pending, the same read-only physical catalog contract is also a Production precondition. Unexpected remote versions, duplicate versions, gaps, a missing ledger, or catalog drift fail closed for separate reconciliation; ordinary release automation never repairs or adopts migration history.

To apply Production migrations, the owner must manually dispatch `Apply versioned Supabase migrations` from `main`, select `production`, set `apply` to `true`, and approve the protected `production-supabase` Environment. The workflow repeats the same identity, canonical-prefix, status, and dry-run gates, applies only pending forward migrations through the masked pooler URL, then requires exact repository/Production ledger parity with zero duplicates and zero pending versions followed by the shared catalog contract. A pre-apply full-current catalog check runs only when zero migrations are pending; otherwise the post-apply contract is authoritative for the new canonical state.

Merging `staging` into `main` therefore does **not** automatically modify Production Supabase. Production database changes require the explicit approval gate.

The historical one-time `supabase migration repair` loop was removed after Production Readiness Gate 1 proved that the Production ledger exactly matched the then-current canonical repository set. That legacy adoption served an absent-ledger recovery; repeating it in normal releases would make `apply=false` mutating and could conceal future drift. Current expectations are always derived from `supabase/migrations`. Any future ledger reconciliation requires separate evidence and explicit authorization.

### Read-only Production readiness verifier

`.github/workflows/verify-production-supabase-readonly.yml` is a separate, manually dispatched readiness verifier that must run from `staging` through the protected `production-supabase` GitHub Environment. It authenticates the environment-scoped Supabase token with a read-only Management API request, confirms the exact Production project identity, derives the canonical migration set from the checked-out repository, verifies exact Production ledger parity, and invokes the same shared physical catalog contract used for staging.

The verifier cannot repair or apply migrations. It contains no `supabase link`, `supabase migration repair`, `supabase db push`, SQL DDL, or SQL DML. A failed assertion exits without remediation. The ordinary release workflow is likewise forward-only: it plans without mutation unless an owner explicitly dispatches `apply=true` from `main`, and it fails rather than normalizing unexpected ledger drift.

## Parity verification

Run `scripts/verify-supabase-catalog-contract.mjs` against each project using the protected, masked database URL and an environment label. The verifier opens an explicit read-only transaction and checks the same environment-neutral contract in both places. It covers:

- required public CMS tables and operationally important structural columns;
- function signatures, ownership, and security-definer mode where relevant;
- exact trigger table, timing, events, enabled state, function target, and `WHEN` contract;
- RLS enabled state and required policy names, roles, and commands;
- protected-table direct-write revocation and required RPC/read grants;
- required CMS Storage buckets and policy contracts.

The verifier reads only system catalog and Storage configuration metadata; it does not inspect editorial rows or compare staging content with Production content. Any difference is a blocker until separately explained and authorized. The contract must not be changed to hide drift.

## Owner configuration checklist

Configure these values only in GitHub Environments, never in Git:

### `staging-supabase`

- variable `SUPABASE_PROJECT_REF` for `crimson-staging`;
- secret `SUPABASE_ACCESS_TOKEN`;
- secret `SUPABASE_DB_PASSWORD`.

### `production-supabase`

- variable `SUPABASE_PROJECT_REF` for `ocscolabs-platform-website-crm`;
- secret `SUPABASE_ACCESS_TOKEN`;
- secret `SUPABASE_DB_PASSWORD`;
- at least one required owner reviewer.

Run `npm run verify:production-supabase-environment` with an administrator-authenticated GitHub CLI session during release-governance audits. The read-only check fails if the Environment loses required-reviewer protection, the repository owner is no longer an eligible reviewer, self-review would block the sole owner approval path, or an unexpected wait timer is introduced. It reports only non-secret governance metadata.

The owner must verify the project refs without sharing values in chat. Vercel runtime variables and Supabase Auth/SMTP settings remain separately configured per environment.

## Temporary CMS promotion bridge

The guarded row-copy workflow remains transitional. It may be used only for the separately documented CMS content boundary while Production revision publishing is being verified. It is not a database-schema release mechanism and must not be used to recreate tables, policies, functions, triggers, grants, or Storage configuration.

## Rollback

- Before applying Production migrations, review the dry-run and migration list.
- Prefer additive, backward-compatible migrations.
- If an application deployment fails, roll back the Vercel deployment while preserving the migration history; do not run a destructive reverse migration automatically.
- Any required data repair or reverse migration must be a separately reviewed owner-approved migration.
- Record the migration version, deployment commit, approval, and verification result in the release record.

## Phase 4C staging closure and deferred Production gate

The staging portion of Phase 4C is complete after the clean staging rebuild, canonical migration parity, release contract, architecture assertions, application QA, and owner acceptance pass.

The Production dry run, parity contract, first Production apply approval, branch/deployment/Auth/public-route/revision checks, rollback/sign-off, and staging synchronization remain a deferred release gate. They must pass before a future Production CMS/schema promotion, but do not block Phase 5 development and QA in staging.
