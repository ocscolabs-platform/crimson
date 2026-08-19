# Phase 4 — Controlled Service Editor

**Status:** Staging implementation in progress

## Scope

The first write-enabled CMS slice is limited to service records. It provides a protected route at `/admin/services/[slug]` and uses Supabase RLS as the final authorization boundary.

| Role | Read service records | Create/update | Publish/archive |
| --- | --- | --- | --- |
| `owner` | All except no hidden access outside the protected route | Yes | Yes |
| `editor` | Draft, review, and published | Draft and review only | No |
| `reviewer` | Draft, review, and published | No | No |

Pages, navigation, site settings, case studies, media, and CRM records remain outside this editor slice.

## Editorial flow

```text
Draft → Review → Published
  ↑                 │
  └────── revisions ┘

Published → Archived (owner only)
```

- Editors prepare or revise draft/review service content.
- Reviewers inspect content but cannot change it.
- Owners control publication and archival.
- Public routes continue to receive only published records with a valid publication timestamp.
- The editor does not provide version history or audit logs yet; those are required before broad CMS rollout.

## Staging rollout

1. Apply `supabase/migrations/20260820050000_add_staging_service_editor_policies.sql` in `crimson-staging` after the membership migration.
2. Push the staging branch and wait for Vercel to deploy it.
3. Sign in at `/admin`, open a service, and review the controlled form.
4. As the staging owner, update one non-sensitive service field and save it. Confirm the success state and public staging route.
5. Do not run either migration in Production and do not promote the editor to `main` until the workflow is reviewed.

## Safeguards

- The browser never uses `SUPABASE_SECRET_KEY`.
- RLS policies enforce the role and status boundary even if the UI is bypassed.
- No delete policy is granted; archival is an explicit owner status instead.
- The editor is not linked from the public website.
- Any future publishing workflow should add audit logging, review evidence, and a clear rollback path before expanding beyond services.
