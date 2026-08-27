# OCSCO Crimson Phase 6 — Migration 33 Disposable CI Proof and Staging Gate

Date: 2026-08-28
Branch: `codex/production-baseline-reconciliation-33`

## Result

PR #95 is open into `staging` from `codex/production-baseline-reconciliation-33`.
The existing proof workflow is pinned to Supabase CLI `2.111.0` and uses a
disposable local Supabase stack, synthetic legacy schema/data, CLI-only
migration-history repair, explicit history rollback after a failed #33 attempt,
and a canonical no-op run.

The first proof run failed in fixture setup because separately-created
databases did not inherit the stack's `auth` schema. The narrow workflow fix
bootstraps the stack-provided `auth`, `extensions`, and `storage` schemas before
loading the synthetic fixture. The next run exposed a proof-query bigint
concatenation error, which was also fixed narrowly. The following run reached
Migration #33 and exposed a real SQL failure during legacy page
canonicalization: `new row for relation "pages" violates check constraint
"legacy_pages_content_array"`.

The evidenced Migration #33 fix is committed locally as `800f997`, but the
current environment rejected publishing that migration-history change. No
staging merge, staging migration application, or staging Security Advisor run
exists for this gate. Production and `main` were not touched.

## Requested gate results

- Supabase CLI version: `2.111.0` pinned in CI; unavailable locally
- real disposable legacy DB created: PASS — proof run reached the legacy database migration step
- migration #33 real SQL execution: FAIL — `legacy_pages_content_array` blocked canonical page conversion
- legacy → canonical reconciliation: FAIL — blocked by the #33 SQL failure
- data preservation: FAIL — proof stopped at the #33 SQL failure
- PageDocument conversion: FAIL — proof stopped at the #33 SQL failure
- real fail-closed tests: FAIL — proof stopped before the remaining databases
- canonical no-op: FAIL — proof stopped before the canonical database
- absent-ledger CLI adoption: FAIL — not completed
- exact ledger strategy proven: NO
- false-parity recovery proven: NO
- PR number / merge result: #95 / not merged
- staging #33 application: FAIL — not attempted
- staging migration parity 33/33: FAIL — not attempted
- staging data unchanged: PASS — no staging action occurred
- Security Advisor: FAIL — not run
- remaining Production blocker, if any: the environment rejected pushing local commit `800f997` with `This action was rejected due to unacceptable risk ... pushing this migration-history change is therefore unauthorized.` No alternate publication path or bypass was attempted. The supported CLI `--db-url`, migration list, repair, and push behavior is documented in the [Supabase CLI reference](https://supabase.com/docs/reference/cli/supabase-db-advisors)
- GO / NO-GO for actual Production baseline execution: NO-GO

STOP. Do not merge PR #95, apply #33 to staging, repair any Production ledger,
apply any Production migration, merge `main`, begin 6C2, or begin Phase 7 until
the published Migration #33 fix has passed the disposable CI proof.
