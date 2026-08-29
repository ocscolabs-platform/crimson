# Phase 4 — CMS Roles and Authorization

**Status:** Owner-only Team & Access is implemented; Reviewer is deprecated for new assignments while retained internally for backward compatibility.

## Proposed roles

| Role | Intended responsibility | Current access |
| --- | --- | --- |
| `owner` | Manage CMS membership and approve access policy | Read-only dashboard plus the first service editor; publication remains owner-only |
| `editor` | Prepare structured content and maintain drafts | Draft/review service editing only |
| `reviewer` | Retained only for existing memberships | Existing records remain readable and retain their existing permissions; it cannot be assigned through Team & Access |

The first implementation deliberately limits content mutation to the services table. Pages, navigation, site settings, case studies, media, and CRM remain read-only or unavailable in the CMS until their workflows are separately approved.

## Owner-only Team & Access slice

The staging CMS includes an owner-only membership surface at `/crimson-admin-control/team`. It may invite a user through the server-side Supabase Auth admin API and assign `owner` or `editor`. Owners can also change an existing member's role to one of those two roles. Existing `reviewer` memberships remain readable and are shown as legacy state until an owner explicitly changes them. The browser never receives `SUPABASE_SECRET_KEY`, and the last owner cannot be downgraded.

CMS signup is invite-only. Public signup is disabled. Administrator invitations redirect to `/crimson-admin-control/invite`, where a dedicated implicit-flow client consumes the invitation callback fragment and establishes the session before account setup. This is intentionally separate from the normal PKCE login/recovery client because the invitation is accepted in a different browser context.

This slice does not add account deletion, bulk membership changes, production access, or CRM permissions. Those require separate review.

## Role storage compatibility

No database migration is required for Reviewer retirement. The existing `cms_members.role` check intentionally continues to accept `reviewer`, and existing authorization policies continue to recognize it so current memberships and historical records remain safe. The application separates persisted roles from assignable roles; it does not convert or delete any member.

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
