# Phase 4 — CMS Roles and Authorization

**Status:** Role foundation implemented; owner-only Team & Access slice is implemented, with invitation callback remediation under staging verification

## Proposed roles

| Role | Intended responsibility | Current access |
| --- | --- | --- |
| `owner` | Manage CMS membership and approve access policy | Read-only dashboard plus the first service editor; publication remains owner-only |
| `editor` | Prepare structured content and maintain drafts | Draft/review service editing only |
| `reviewer` | Review content for accuracy and publication readiness | Read-only review of service content |

The first implementation deliberately limits content mutation to the services table. Pages, navigation, site settings, case studies, media, and CRM remain read-only or unavailable in the CMS until their workflows are separately approved.

## Owner-only Team & Access slice

The staging CMS includes an owner-only membership surface at `/crimson-admin-control/team`. It may invite a user through the server-side Supabase Auth admin API and assign one of the approved roles. Owners can also change an existing member's role. The browser never receives `SUPABASE_SECRET_KEY`, and the last owner cannot be downgraded.

CMS signup is invite-only. Public signup is disabled. Administrator invitations redirect to `/crimson-admin-control/invite`, where a dedicated implicit-flow client consumes the invitation callback fragment and establishes the session before account setup. This is intentionally separate from the normal PKCE login/recovery client because the invitation is accepted in a different browser context.

This slice does not add account deletion, bulk membership changes, production access, or CRM permissions. Those require separate review.

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
- The controlled Services editor is the only write-enabled surface, and audit history is required for every service change.
