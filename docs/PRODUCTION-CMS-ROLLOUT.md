# Production CMS rollout

This is the one-time setup for the canonical `https://ocsco.io/admin` boundary. It is intentionally separate from Git merges: Git deploys code, while Supabase owns CMS data, Auth, Storage, and RLS.

## Owner steps

1. Deploy the code branch containing the canonical `/admin` route to staging and verify the public site still renders normally.
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
Redirect URL: https://ocsco.io/admin/reset-password
```

6. Confirm Production Vercel has the Production Supabase URL, publishable key, and server secret already configured. Do not copy Preview values into Production.
7. Open `https://ocsco.io/admin`. Anonymous visitors should see the login screen; the owner should reach the CMS dashboard.

## Important transition rule

This boundary makes Production `/admin` reachable and authenticated. It does not yet retire the row-copy promotion bridge or make direct global-content edits revision-safe. The revision migration must be implemented and verified before the owner uses Production `/admin` for ordinary editorial publishing or before the bridge is deleted.

Preview inquiry submissions are disabled by default. Production is the only environment that automatically accepts real inquiries.
