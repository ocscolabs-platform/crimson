# Supabase release pipeline

## Scope

This document defines the Phase 4C database release boundary. It does not begin Phase 5 and it does not replace the CMS content workflow.

- Staging project: `crimson-staging`
- Production project: `ocscolabs-platform-website-crm`
- Canonical history: `supabase/migrations`
- Verification contract: `supabase/verification/release-contract.sql`
- Workflow: `.github/workflows/supabase-release.yml`

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
5. Use `supabase migration list --linked` and `supabase db push --linked --dry-run` to detect unapplied migrations before applying them.

## Staging

On a push to `staging` that changes the migration surface, the workflow:

1. runs lint, typecheck, migration validation, and the production build;
2. links to the project ref configured in the protected `staging-supabase` GitHub Environment;
3. records migration status and runs a dry run;
4. applies the pending canonical migrations to `crimson-staging`.

The staging environment must provide only owner-managed GitHub Environment configuration. No Supabase access token, database password, or project-specific secret is committed.

## Production

On a push to `main`, the workflow validates the same repository state and performs a read-only Production migration plan. It does not apply a migration automatically.

To apply Production migrations, the owner must manually dispatch `Apply versioned Supabase migrations`, select `production`, set `apply` to `true`, and approve the protected `production-supabase` Environment. The workflow then links the Production project, prints migration status, performs a dry run, and applies the same canonical files that passed in staging.

Merging `staging` into `main` therefore does **not** automatically modify Production Supabase. Production database changes require the explicit approval gate.

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

## Phase 4C exit condition

Phase 4C can close only after the workflow is configured and exercised in staging, the Production dry run and parity contract are verified, the owner approves the first Production apply, and the branch/deployment/auth/public-route/revision checks in `docs/RELEASE-READINESS.md` pass. No Phase 5 work starts before that sign-off.
