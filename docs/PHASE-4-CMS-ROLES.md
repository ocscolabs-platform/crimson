# Phase 4 — CMS Roles and Authorization

**Status:** Staging implementation in progress

## Proposed roles

| Role | Intended responsibility | Current access |
| --- | --- | --- |
| `owner` | Manage CMS membership and approve access policy | Read-only dashboard; membership management policy is prepared but not exposed in the UI |
| `editor` | Prepare structured content and maintain drafts | No additional access yet |
| `reviewer` | Review content for accuracy and publication readiness | No additional access yet |

The first implementation deliberately separates role identity from content mutation. All three roles continue to see only the published content permitted by the current RLS policies until editing and publishing rules are approved.

## Staging migration

Apply `supabase/migrations/20260820040000_create_cms_members.sql` in `crimson-staging` only. It creates the `cms_members` membership map, enables RLS, and adds server-side role helper functions. It does not create an account-specific seed and does not grant content insert, update, or delete access.

## Assigning the first owner

After the migration succeeds, use the Supabase Auth Users page to copy the UUID for the `ocscolabs@gmail.com` user. In the `crimson-staging` SQL Editor, replace `PASTE_AUTH_USER_UUID_HERE` and run:

```sql
insert into public.cms_members (user_id, role)
values ('PASTE_AUTH_USER_UUID_HERE', 'owner')
on conflict (user_id) do update
set role = excluded.role;
```

Do not commit the UUID, password, or any Supabase secret to the repository.

## Acceptance criteria

- The intended staging user has exactly one membership row with role `owner`.
- The signed-in dashboard displays the assigned role.
- An authenticated user with no membership remains read-only and receives no elevated content access.
- No CMS content mutation policy is added until the editor workflow, draft visibility, reviewer boundaries, and audit requirements are separately approved.
