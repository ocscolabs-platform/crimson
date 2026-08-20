# Phase 4 — Controlled Global Content Editor

**Status:** Staging implementation in progress

## Scope

The first global-content write slice is intentionally narrow and update-only. Authenticated CMS members can review existing records at `/admin/content`; owners and editors can update:

- the default site settings record;
- existing primary and footer navigation items; and
- existing page metadata, SEO fields, calls to action, and editorial status.

The slice does not create or delete records, upload media, edit arbitrary page JSON, or manage CRM data. Page body sections remain approved application components until a section contract and visibility/order rules are separately reviewed.

## Role boundary

| Role | Read global records | Update settings/navigation/page metadata | Change navigation visibility/group | Publish/archive pages |
| --- | --- | --- | --- | --- |
| `owner` | All staging records | Yes | Yes | Yes |
| `editor` | All staging records | Draft/review page metadata and global copy | No | No |
| `reviewer` | All staging records | No | No | No |

Published page metadata must move through Review before content changes. Database triggers remain the final publication boundary even if the form is bypassed.

## Staging rollout

1. Apply `supabase/migrations/20260820100000_add_staging_global_content_editor.sql` in `crimson-staging` after the membership migration.
2. Sign in at the staging `/admin` route and open `Global content`.
3. As the owner, update one non-sensitive positioning or page metadata field and confirm the success toast and public staging route.
4. Confirm an editor can update draft/review metadata but cannot change navigation visibility or publish a page.
5. Confirm a reviewer sees the content but no save controls.
6. Do not apply the migration in Production or promote the route to `main` until the staging workflow is reviewed.

## Audit and recovery boundary

Updates are recorded in the immutable `cms_global_audit_log` table. This first slice does not include restore controls. A versioned restore workflow should be designed after the global editor is used with real staging content, before broadening the page builder or media surface.
