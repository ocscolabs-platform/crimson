# Canonical migration history

This directory is the single version-controlled database history for OCSCO
across both Supabase projects:

- `crimson-staging`
- `ocscolabs-platform-website-crm`

The migration files are environment-neutral. Some historical filenames retain
the `staging` wording because they were already applied and must not be
renamed, deleted, or rewritten. Their filename is historical metadata; the
same ordered migration set must be applied to both projects.

## Release rule

1. A migration is committed on a feature branch.
2. CI validates the sequence and the application build.
3. The `staging-supabase` workflow applies the approved history to staging.
4. Staging is verified.
5. The same commit is merged to `main`.
6. The `production-supabase` GitHub Environment requires owner approval before
   the migration engine can apply the same history to Production.

The CMS row-copy promotion workflow is transitional content promotion only. It
does not replace this migration history and does not apply schema, RLS,
functions, triggers, grants, or Storage configuration.

Never edit an already-applied migration to repair drift. Add a new forward
migration and verify both environments with the read-only contract at
`supabase/verification/release-contract.sql`.

Migration `20260831000000_reconcile_production_legacy_baseline.sql` is a
forward-only baseline-adoption migration. It exits without DDL or data changes
when the canonical Phase 6 shape is already present, and it fail-closes unless
the audited legacy signature is present. Its legacy branch converts the four
approved PageDocuments from existing `pages` and `page_sections` rows, preserves
the Work row and existing Storage objects, installs the validated Phase 5/6
contracts, adds only the two private Insights buckets, and re-locks direct
authenticated writes. It must be proven against a disposable database with a
pinned Supabase CLI before any Production execution is considered.
