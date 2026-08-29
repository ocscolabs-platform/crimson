# OCSCO Crimson — Scheduled Publishing v1 Step 4A-1 Idle Fix

Date: 2026-08-30  
Scope: staging-only Batch 2C2A-1; idle/no-due contract only

## Root cause

The staging runtime log identified SQLSTATE `42702`: `column reference "scheduled_publish_at" is ambiguous`. The claim RPC returns a table containing an output column named `scheduled_publish_at`; its due-row selector also referenced the `insights_articles.scheduled_publish_at` column without a table qualifier. PostgreSQL therefore raised an actual claim RPC error before the valid no-row/idle return could execute. The route correctly distinguishes an RPC error from a null claim, so the incorrect layer was the claim SQL.

## Layer changed

Only the existing claim RPC SQL was changed. The due-row selector now aliases `public.insights_articles` as `article` and qualifies its selected, filtered, and ordering columns. Claim/lease, authorization, publication/media, Cron, Vault, UI, roles, and scheduling behavior were not redesigned or changed.

The existing 2C1 focused test assertion was updated to match the corrected qualified SQL. A new focused Batch 2C2A-1 test covers valid idle results, future schedules, no claim/projection mutation, genuine claim errors, and due-article claim behavior.

## Pre-fix staging evidence

Before this change, the active staging Cron job `crimson_insights_scheduled_publish` ran four consecutive minute cycles against the unique Preview deployment. Each request reached the application and passed route authorization, then returned HTTP 500 with `Scheduled publication could not be claimed.` The Vercel runtime log exposed the underlying `42702` ambiguity described above. Staging had zero due articles, zero active claim fields, and zero public projection rows throughout. No QA article was created or scheduled.

## Verification

Local focused checks passed:

- `npm run test:batch2c2a1:idle`
- `npm run test:batch2c1:execution` — 39/39
- `npm run typecheck`
- `npm run validate:migrations` — 41 canonical migration files
- `npm run lint` — zero errors; three pre-existing warnings

Staging protected PR and post-merge idle-cycle verification are pending. The existing staging Cron configuration is to remain unchanged unless the post-merge deployment URL changes; in that case only the staging Vault URL entry will be updated.

## Stop boundary

No timed article acceptance test, Cron redesign, additional job, UI change, `main` merge, Production deployment, or Production data change is in scope.
