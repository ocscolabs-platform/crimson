# Phase 4 — Controlled Service Version Restoration

**Status:** Staging implementation in progress

## Scope

The existing immutable service audit snapshots now support a controlled restoration action. This is not a general version-management system: it covers Services only, it is owner-only, and it always restores a snapshot into `review`.

## Restoration rules

- The owner selects an audited snapshot from the protected service editor.
- The UI requires an explicit confirmation before submitting the restore action.
- The database RLS boundary still authorizes the resulting update; the server action never uses `SUPABASE_SECRET_KEY`.
- Restored content is set to `review`, with `published_at` and `last_reviewed_at` cleared.
- Restoration never publishes automatically.
- The restoration itself creates a new audit entry, preserving a trace of the recovery action.
- Editors and reviewers can read history but cannot restore snapshots.

## Staging rollout

1. Push the version restoration implementation to `staging` after the audit migration has been applied.
2. Open `/admin/services/branding` as the owner.
3. Choose a prior audited snapshot and select **Restore as review**.
4. Confirm the warning, verify the success message, and confirm the content/status return to `review`.
5. Confirm a new audit entry appears, then publish only after reviewing the restored content.
6. Do not expose the restore action to the public website or promote it to Production yet.

## Exit criteria

Before expanding this workflow to pages, navigation, or case studies, review whether the team needs field-level diffs, named release notes, bulk rollback, or a dedicated version table. The current snapshot mechanism is intentionally small and service-specific.
