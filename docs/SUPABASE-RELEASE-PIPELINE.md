# Supabase release pipeline

## Scope

This document defines the Phase 4C database release boundary and the deferred Production release gate. It does not replace the CMS content workflow.

- Staging project: `crimson-staging`
- Production project: `ocscolabs-platform-website-crm`
- Canonical history: `supabase/migrations`
- Verification contract: `supabase/verification/release-contract.sql`
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
6. After a staging apply, compare the ordered canonical timestamp set with `supabase_migrations.schema_migrations`; parity, zero duplicates, and zero pending versions are required for success. The read-only PostgreSQL check uses the approved direct staging host with an IPv4 address resolved at runtime so a runner without IPv6 routing cannot fail the transport gate.

## Staging

On a push to `staging` that changes the migration surface, the workflow:

1. runs lint, typecheck, migration validation, and the production build;
2. links to the project ref configured in the protected `staging-supabase` GitHub Environment;
3. confirms the configured Supabase project identity is `crimson-staging`;
4. percent-encodes the protected database password, masks both the encoded password and complete Shared Session Pooler URL, then records migration status and runs a dry run through `--db-url`;
5. applies all pending canonical migrations in order through `supabase db push --db-url "$STAGING_POOLER_DB_URL" --yes`;
6. verifies exact repository/database migration parity and fails closed on duplicates, unexpected remote versions, or pending versions.

The workflow path itself is included in the staging trigger so a pipeline correction is exercised by the next protected `staging` push. Project linking remains in place for association and identity safeguards, while database-bearing migration commands use the IPv4-reachable Shared Session Pooler. If no migrations are pending, the apply command is an idempotent no-op and the same parity gate still passes. The staging job cannot apply unless the event ref is exactly `refs/heads/staging`, the target project identity check passes, and the staging environment configuration is present.

The staging environment must provide only owner-managed GitHub Environment configuration. No Supabase access token, database password, or project-specific secret is committed.

## Production

On a push to `main`, the workflow validates the same repository state and performs a non-mutating Production migration plan. It authenticates through the protected `production-supabase` Environment, confirms the exact `ocscolabs-platform-website-crm` project through the Management API, retains project linking, constructs and masks the Shared Session Pooler URL, and requires the existing Production ledger to be an exact duplicate-free prefix of canonical Git history before showing status or running `supabase db push --dry-run`. Unexpected remote versions, duplicate versions, gaps, or a missing ledger fail closed for separate reconciliation; ordinary release automation never repairs or adopts migration history.

To apply Production migrations, the owner must manually dispatch `Apply versioned Supabase migrations` from `main`, select `production`, set `apply` to `true`, and approve the protected `production-supabase` Environment. The workflow repeats the same identity, canonical-prefix, status, and dry-run gates, applies only pending forward migrations through the masked pooler URL, then requires exact repository/Production ledger parity with zero duplicates and zero pending versions.

Merging `staging` into `main` therefore does **not** automatically modify Production Supabase. Production database changes require the explicit approval gate.

The historical one-time `supabase migration repair` loop for versions 1–32 was removed after Production Readiness Gate 1 proved that the Production ledger exists and exactly matches all 48 current-`main` versions. That legacy adoption served PR #97's absent-ledger recovery before migration #33; repeating it in normal releases would make `apply=false` mutating and could conceal future drift. Any future ledger reconciliation requires separate evidence and explicit authorization.

### Read-only Production readiness verifier

`.github/workflows/verify-production-supabase-readonly.yml` is a separate, manually dispatched readiness verifier that must run from `staging` through the protected `production-supabase` GitHub Environment. It authenticates the environment-scoped Supabase token with a read-only Management API request, confirms the exact Production project identity, and uses explicit read-only PostgreSQL transactions to verify connectivity, current-`main` migration-ledger parity, the three expected staging-only Work CMS migrations, and the pre-promotion catalog baseline.

The verifier cannot repair or apply migrations. It contains no `supabase link`, `supabase migration repair`, `supabase db push`, SQL DDL, or SQL DML. A failed assertion exits without remediation. The ordinary release workflow is likewise forward-only: it plans without mutation unless an owner explicitly dispatches `apply=true` from `main`, and it fails rather than normalizing unexpected ledger drift.

## Parity verification

Run the read-only contract in `supabase/verification/release-contract.sql` against each project and compare the result. It covers:

- expected public CMS tables;
- RLS enabled state and policy names/commands;
- required functions;
- public triggers;
- table grants;
- the private `case-study-media` bucket and its file-size/MIME contract;
- Storage policy names, roles, and commands.

Any difference must be classified as expected environment configuration, an approved migration gap, or a blocker. The contract must not be changed to hide drift.

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
