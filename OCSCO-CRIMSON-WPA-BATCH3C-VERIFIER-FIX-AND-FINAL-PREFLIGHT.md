# OCSCO Project Crimson — Work Package A / Batch 3C

## Stale verifier correction and final pre-Restore preflight

Date: 2026-08-25
Branch: `codex/phase5-wpa-batch3c-verifier-fix`
Base: locally available `staging` at `51b955663f4292c972ec0884f96625aec4e1eb41`

## Status

**PASS for the repository-only verifier correction. BLOCKED for final staging and CMS pre-Restore verification.**

No Supabase write, migration application, Restore, Publish, Production change, or `main` change was performed.

## Authoritative contract finding

The failing assertion in `supabase/verification/phase5-contract-alignment.sql` expected the pre-migration-#26 Slice 2 implementation of the generic `cms_publish_revision(uuid)` RPC. That expectation required the generic RPC to perform the PageDocument projection, including the `/opengraph-image` projection and PageDocument payload validation.

Migration #26 intentionally superseded that design. The canonical contract is:

- `cms_publish_revision(uuid)` rejects approved PageDocument revisions with `PageDocument publication requires the dedicated Publish RPC` and preserves legacy non-PageDocument compatibility branches.
- `cms_page_document_publish(text, uuid, timestamptz)` is the owner-only, Review-only PageDocument publication path for `home`, `services`, `about`, and `contact`.
- `cms_page_document_restore(text, uuid)` is the owner-only, non-destructive PageDocument restore path and creates a new Review without changing the public pointer.

## Exact files changed

Only these two files are in the correction scope:

1. `supabase/verification/phase5-contract-alignment.sql`
2. `OCSCO-CRIMSON-WPA-BATCH3C-VERIFIER-FIX-AND-FINAL-PREFLIGHT.md`

No migration, application, UI, environment, or Production file changed.

## Verifier correction result

The verifier now checks:

- the exact four-page PageDocument target allowlist;
- the generic Publish guard and dedicated-RPC error;
- legacy generic Publish branches for site settings, navigation, page sections, legacy pages, Services, and case studies;
- the separate dedicated PageDocument Publish contract, including owner role, Review-only state, exact `updated_at` protection, payload validation, Published pointer, previous Published archival, PageDocument projection, and workflow audit events;
- the separate dedicated PageDocument Restore contract, including owner role, published/archived source eligibility, payload validation, active editorial archival, public-pointer preservation, new Review creation, and workflow audit events;
- the existing legacy generic Save and Restore compatibility checks;
- the existing PageDocument validation and published-Service-reference checks.

The obsolete generic Slice 2 PageDocument projection expectation was removed only where migration #26 made it invalid; the relevant publication checks were placed on the dedicated Publish RPC.

## Repository validation

Passed:

- 26 canonical migration files;
- migration #26 remains unchanged, blob hash `b5feb8bfd9663c8212432c554834378808e6ad38`;
- Batch 3A backend contract tests;
- Batch 3A application workflow tests;
- Batch 3B Publish tests;
- Batch 3C Restore tests;
- mixed Phase 5B public-authority validation;
- migration validation;
- typecheck;
- lint, with one pre-existing unused-variable warning in `scripts/audit-supabase-drift.mjs`;
- webpack production build;
- `git diff --check`.

The default Turbopack build path was not usable with the temporary local dependency junction used for this isolated worktree; the equivalent webpack production build completed successfully. No source workaround was added.

## Staging contract and migration parity

The prior read-only staging reconciliation established:

- `STAGING_MATCHES_MIGRATION_26 = true`;
- `STAGING_MATCHES_OLD_SLICE2_EXPECTATION = false`;
- 26/26 migrations;
- migration #26 exactly once;
- zero duplicate versions;
- remote migration state up to date;
- migration #26 blob unchanged.

The corrected verifier has not yet run in the staging workflow because this branch has not yet been pushed and merged. No migration application is required or authorized for this verifier-only correction.

## PR and staging merge

PR number: pending creation after the branch is pushed.
Staging merge commit: pending.
Final staging HEAD: pending.

The PR must target `staging`, never `main`, and must contain only the two files listed above. After required checks pass, the authorized staging merge may proceed. No Supabase migration step should apply because the migration set is unchanged.

## Merged CMS Restore recheck

**BLOCKED / pending post-merge owner authentication.**

The deployment-specific Preview URL previously expired. The stable staging Preview requires the owner to complete the normal CMS sign-in flow before the following read-only checks can be completed:

- Current Published revision `4d552d8b-b231-4ebd-98cc-882c10d20bfb` has no Restore control;
- archived revision `c26b7cca-f054-4638-9fc1-8d96444d2a43` exposes Restore;
- Restore confirmation explains that the public site will not change, a new Review will be created, and later Publish is required;
- Cancel works and zero Restore submissions occur.

Responsive QA is already owner-verified PASS at 1440×900, 768×1024, and 390×844 and will not be repeated.

## Production safety

No Production or `main` mutation was performed in this task. Final post-merge verification of `main`, Production Supabase, Vercel Production, and `www.ocsco.io` remains pending with the staging workflow and owner-authenticated Preview recheck.

## Decision

Repository correction: **PASS**.
Staging contract workflow: **PENDING post-merge**.
Final Restore preflight: **BLOCKED pending post-merge CMS authentication/recheck**.
Controlled live Restore acceptance: **NO-GO until the corrected verifier passes in staging and the read-only CMS Restore recheck passes.**

If all post-merge checks pass, the next gate is:

`READY FOR CONTROLLED 3C LIVE RESTORE ACCEPTANCE`

Do not perform Restore yet. Do not begin Work Package B or Phase 6 Insights.
