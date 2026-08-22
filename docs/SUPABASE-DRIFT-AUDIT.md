# Supabase Staging Drift Audit

## Purpose

The workflow `.github/workflows/audit-staging-supabase-drift.yml` is a read-only Phase 4C audit. It compares the final schema produced by the canonical migrations in `supabase/migrations/` with catalog metadata from the separate `crimson-staging` Supabase project.

It does not apply migrations, repair the Supabase migration ledger, modify staging, query Production, or create a permanent database. The expected state is built in the disposable PostgreSQL/Supabase services provided by the GitHub Actions runner and is destroyed at the end of the run.

## Run procedure

1. Open GitHub Actions for `ocscolabs-platform/crimson`.
2. Select **Audit staging Supabase schema drift**.
3. Choose **Run workflow** from the `staging` branch after the workflow has been merged there.
4. Confirm that the `staging-supabase` environment contains only the existing owner-managed configuration:
   - Secret `SUPABASE_ACCESS_TOKEN`.
   - Secret `SUPABASE_DB_PASSWORD`.
   - Variable `SUPABASE_PROJECT_REF` for `crimson-staging`.
5. Download the `staging-supabase-drift-inventory` artifact after the run.

The preflight prints only `PRESENT` or `MISSING`. Secret values are never printed. The staging snapshot uses PostgreSQL read-only transactions. A non-zero result must be investigated before any reconciliation is designed or applied.

## Report categories

The comparison classifies each catalog object as `MATCH`, `MISSING`, `DIFFERENT`, or `EXTRA` for:

- public tables and columns;
- constraints and indexes;
- RLS enablement and policies;
- public functions and triggers;
- table grants;
- Storage buckets and Storage policies;
- the Supabase migration ledger.

Each mismatch includes migration evidence based on the canonical migration contents. Evidence is a review aid, not an authorization to edit a historical migration.

The report also identifies nullable-column and constraint changes that may require existing staging data validation. It does not expose row values.

## Permanent pre-apply gate

The drift audit must run before any future staging or Production `supabase db push`. A migration release should be blocked when the live schema is not the expected predecessor state, except where an explicitly reviewed reconciliation migration accounts for the difference. The current migration apply workflow remains separate and must not be changed to repair or overwrite an unknown baseline automatically.

## Safety boundary

This audit does not make staging or Production authoritative. It establishes evidence for a later owner-approved reconciliation plan. No migration repair, baseline adoption, staging rebuild, or corrective migration should be performed until the generated report has been reviewed and a backup/rollback plan has been approved.
