# Phase 4 — CMS Authentication Boundary

**Status:** Staging implementation in progress

## Scope of this slice

The first protected CMS slice adds a Supabase Auth session boundary and a read-only dashboard at `/admin`. It is intentionally limited to reviewing content that is already published through the CMS foundation.

Included:

- Cookie-based Supabase SSR sessions using `@supabase/ssr`.
- Email/password sign-in at `/admin/login`.
- Server-side user verification with `supabase.auth.getUser()`.
- A staging-only dashboard showing published settings, navigation, pages, services, and case studies.
- Sign-out and protected-route redirects.

Not included:

- Content creation, editing, deletion, or publishing.
- Admin roles, invitations, teams, or permission management.
- Draft/review access.
- Media uploads, previews, version history, audit logs, or CRM records.
- Production auth configuration or production CMS access.

## Security boundary

The dashboard uses the existing publishable Supabase key and the authenticated browser session. It does not use `SUPABASE_SECRET_KEY`, and no secret is exposed to client code. Existing CMS RLS policies remain published-only for both anonymous and authenticated readers; no mutation policies are added by this slice.

The dashboard is therefore a review surface, not an editor. A future editor requires a separate decision covering staff identity, roles, authorization, mutation policies, auditability, and content review workflow before it is implemented.

The proposed role model is documented in [`PHASE-4-CMS-ROLES.md`](./PHASE-4-CMS-ROLES.md). Role assignment does not grant content editing in this slice.

## Staging setup

1. In the `crimson-staging` Supabase project, open **Authentication → Users** and create the owner/staff user that should review the CMS. Do not commit the password or share it in repository files.
2. In **Authentication → URL Configuration**, add the current staging deployment URL to the allowed redirect URLs. Keep the production domain out of this staging-only configuration.
3. Confirm the existing Vercel Preview variables point to the staging Supabase project:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Visit `/admin/login` on the staging deployment and sign in with the Supabase Auth user.

## Acceptance criteria

- Anonymous visitors are redirected from `/admin` to `/admin/login`.
- Authenticated staging users can view the dashboard and sign out.
- The dashboard only shows records permitted by the published-only RLS policies.
- No admin page or auth configuration is promoted to `main` until staging QA and the role/permission decision are complete.
