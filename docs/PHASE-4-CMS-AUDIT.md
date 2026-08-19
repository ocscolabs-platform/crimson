# Phase 4 — CMS Audit and Publishing Safeguards

**Status:** Staging implementation in progress

## Scope

This milestone adds database-generated audit history and defense-in-depth publishing rules to the existing Services editor. It does not add editing for pages, navigation, site settings, case studies, media, or CRM records.

## Audit boundary

- Every service insert or update creates an immutable `cms_audit_log` record.
- Entries record the authenticated actor, service identifier, action, status transition, timestamp, and before/after snapshots.
- CMS members can read history for review; browser clients cannot insert, update, or delete audit entries.
- The audit trigger runs inside the database so history is recorded even if a future editor path bypasses the current server action.

## Publishing safeguards

- Only an owner can publish or archive a service.
- A service must be moved to `review` before it can be published.
- Published content must be moved to `review` before its content can be changed.
- The database normalizes `published_at` when a record becomes published and clears it for non-published states.
- Publishing sets `last_reviewed_at`; public RLS continues to expose only records with `status = 'published'` and a valid publication timestamp.
- There is still no delete action. Archival remains the recoverable owner-controlled alternative.

## Staging rollout

1. Apply `supabase/migrations/20260820060000_add_staging_cms_audit.sql` in `crimson-staging` after the membership and service-editor migrations.
2. Push the staging branch and wait for Vercel to deploy it.
3. Open `/admin/services/branding` as the staging owner and confirm the change-history panel appears.
4. Confirm a published record cannot be edited while it remains published. Move it to Review first, save, make one non-sensitive change, then publish it again.
5. Confirm the audit history shows the status changes and content update. Do not apply this migration in Production.

## Exit criteria

Broader CMS editing remains blocked until the team has reviewed audit history, publication transitions, rollback expectations, and the future versioning model. A future milestone may add version restoration, but this slice intentionally exposes history without a restore button.
