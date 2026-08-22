# Supabase Staging Drift Audit

## Purpose

The temporary workflow `.github/workflows/audit-staging-supabase-drift.yml` was a read-only Phase 4C audit and has been retired after staging baseline closure. The reusable `scripts/audit-supabase-drift.mjs` command remains available for an explicitly requested local or owner-run read-only comparison of the final schema produced by the canonical migrations in `supabase/migrations/` with catalog metadata from the separate `crimson-staging` Supabase project.

It does not apply migrations, repair the Supabase migration ledger, modify staging, query Production, or create a permanent database. When the retained script is run, the expected state is built in a disposable local PostgreSQL/Supabase service and stopped after the comparison.

## Retired workflow / retained read-only logic

The retired GitHub workflow is not an active release gate. If a future owner-approved audit is needed, use the retained script with the existing repository documentation and owner-managed staging configuration:

1. Confirm that the `staging-supabase` environment contains only the existing owner-managed configuration:
   - Secret `SUPABASE_ACCESS_TOKEN`.
   - Secret `SUPABASE_DB_PASSWORD`.
   - Variable `SUPABASE_PROJECT_REF` for `crimson-staging`.
2. Run the script locally or through a separately approved read-only mechanism and retain the generated inventory for review.

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

## Relationship to the permanent release pipeline

The canonical `.github/workflows/supabase-release.yml` workflow and `supabase/verification/release-contract.sql` remain the permanent migration/release infrastructure. The retained drift script is diagnostic only; it does not replace the canonical migration ledger or release contract and must not repair or overwrite an unknown baseline automatically.

## Safety boundary

This audit does not make staging or Production authoritative. It establishes evidence for a later owner-approved reconciliation plan. No migration repair, baseline adoption, staging rebuild, or corrective migration should be performed until the generated report has been reviewed and a backup/rollback plan has been approved.
