# Historical Production CMS rollout

> This document is retained as migration history. The current merge and environment contract is [`RELEASE-READINESS.md`](./RELEASE-READINESS.md). Do not follow this document as a standalone instruction set.

This is the one-time setup for the canonical `https://ocsco.io/crimson-admin-control` boundary. It is intentionally separate from Git merges: Git deploys code, while Supabase owns CMS data, Auth, Storage, and RLS.

## Owner steps

1. Deploy the code branch containing the canonical `/crimson-admin-control` route to staging and verify the public site still renders normally.
2. In the Production Supabase project, open **SQL Editor** and run [`supabase/migrations/20260821010000_enable_production_cms_admin.sql`](../supabase/migrations/20260821010000_enable_production_cms_admin.sql).
3. In Production Supabase **Authentication → Users**, create or confirm the owner account. Do not reuse a staging password in a repository or share it in chat.
4. Copy that user's UUID. In the Production SQL Editor, run this after replacing the placeholder:

```sql
insert into public.cms_members (user_id, role)
values ('PASTE_PRODUCTION_OWNER_UUID_HERE', 'owner')
on conflict (user_id) do update
set role = excluded.role;
```

5. In Production Supabase **Authentication → URL Configuration**, set:

```text
Site URL: https://ocsco.io
Redirect URL: https://ocsco.io/crimson-admin-control/auth/callback
```

6. Confirm Production Vercel has the Production Supabase URL, publishable key, and server secret already configured. Do not copy Preview values into Production.
7. Open `https://ocsco.io/crimson-admin-control`. Anonymous visitors should see the login screen; the owner should reach the CMS dashboard. Direct `/admin` requests should return `404`.

## Important transition rule

This historical boundary was intended to make Production `/admin` reachable and authenticated. The current release baseline keeps editorial work on the staging CMS until the Production revision boundary and configuration are separately verified. It does not retire the row-copy promotion bridge or make direct global-content edits revision-safe.

Preview inquiry submissions are disabled by default. Production is the only environment that automatically accepts real inquiries.
