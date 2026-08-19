# Phase 4 — Case Study Audit Coverage

**Status:** Migration implemented locally; staging application and verification pending

## Scope

This milestone extends the existing immutable `cms_audit_log` boundary to case studies and `case_study_services` relationship rows. It records database-generated snapshots for future writes without enabling case-study or relationship editing.

## Recorded events

- Case-study creation, updates, status changes, and deletion.
- Relationship additions, changes, and removals, keyed to the case-study ID.
- Authenticated actor ID when a signed-in CMS member performs the change.
- Before and after JSON snapshots where applicable.

## Safety boundary

- The migration does not add insert, update, or delete policies for case studies.
- The migration does not add a case-study editor or relationship editor.
- Audit rows remain readable only by authenticated CMS members under the existing audit read policy.
- Audit rows are not deleted with their source records; the log stores an unowned entity UUID so history remains available for review.
- Production must not receive this migration until the staging workflow is reviewed and the case-study write surface is approved.

## Staging verification

1. Apply `supabase/migrations/20260820070000_add_staging_case_study_audit.sql` in `crimson-staging` after the existing CMS audit migration.
2. Confirm the migration completes without errors.
3. Run the following read-only checks:

```sql
select entity_type, action, count(*)
from public.cms_audit_log
group by entity_type, action
order by entity_type, action;
```

```sql
select tgname, tgrelid::regclass
from pg_trigger
where tgname in ('case_studies_audit_changes', 'case_study_services_audit_changes')
  and not tgisinternal
order by tgname;
```

4. Do not attempt to insert or update case studies as part of this verification; no write policy is enabled yet.
