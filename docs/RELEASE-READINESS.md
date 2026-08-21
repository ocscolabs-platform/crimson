# Release Readiness Baseline

This document is the operational baseline for the current CMS release model. Older Phase 4 documents remain useful as implementation history, but this file governs post-merge Production verification and the next staging baseline.

## Current verdict

The previous staging-to-main code merge has completed. The release is not baseline-stable until the Production database boundary, authentication recovery, production configuration, and release protections have passed the acceptance criteria below.

## Release contract

- `feature/*` is active development.
- `staging` is the integration and QA branch.
- `main` is Production.
- Git merges move application code only. They do not move Supabase rows, Auth users, Storage objects, RLS policies, or environment variables.
- The canonical CMS path is `/crimson-admin-control`. Direct `/admin` and `/admin/*` requests return `404`; the uncommon path is not treated as a security boundary.
- CMS content follows `Draft -> Review -> Published` through revision records.
- Only an owner can publish or restore a revision.
- Public routes read the published boundary only.
- Staging and Production use separate runtime configuration and Supabase projects.
- The staging-to-Production row-copy workflow is temporary migration infrastructure. It is not the steady-state content release mechanism and must be retired after revision publishing is proven in Production.

## Required post-merge verification order

1. Confirm the exact migration state, grants, RLS policies, functions, triggers, and Storage policies in Production; compare them with the approved staging baseline.
2. Verify the main deployment uses the expected commit and the correct Production Vercel variables, Supabase URL/key pair, Resend configuration, and no staging values.
3. Verify Production Auth Site URL, callback, password recovery, invite, and canonical CMS redirects.
4. Verify login, logout, password recovery, role checks, revision save, review, publish, restore, media, relationships, and audit history in Production.
5. Verify public routes read published content only and that `/crimson-admin-control` remains protected while `/admin` and `/admin/*` return `404`.
6. Confirm branch protection, required checks, required reviewers, and the `production-cms` environment are documented and working.
7. Retire the temporary row-copy bridge only after the Production revision workflow is accepted and its rollback path is recorded.
8. Update `staging` to the approved `main` baseline and record owner signoff before beginning Phase 5.

## Password recovery contract

Reset emails must redirect to:

```text
/crimson-admin-control/auth/callback?next=/crimson-admin-control/reset-password
```

The server callback exchanges the one-time Supabase PKCE code and establishes the session before the reset form is shown. The reset page must never exchange the code itself or fall through to the public root.

Each Supabase project must allow its own canonical callback URL. A fresh reset email must be used for every test because Supabase recovery codes are one-time credentials.

## Invitation contract

CMS accounts are invite-only. Public/self-service signup is disabled; the owner creates members through the server-side Supabase administrator invitation API at `/crimson-admin-control/team`. The invitation email must redirect to `/crimson-admin-control/invite`.

Administrator invitations are accepted in a different browser context from the one that created them, so the invite page uses a dedicated implicit-flow browser client to consume the `access_token` and `refresh_token` returned in the invitation URL fragment. It establishes the session before account setup, clears the fragment from browser history, never logs token values, and then assigns the requested CMS membership role. The normal CMS client remains PKCE-based for login and recovery.

If Auth invitation creation succeeds but membership creation fails, the server performs a compensating Auth-user cleanup and returns a recoverable error. A retry must use a new invitation. A Production invitation test is not accepted until a fresh staging first-click test passes.

## Steady-state architecture

```text
feature/* -> staging -> main
                 |       |
                 |       +--> Production Vercel + Production Supabase
                 +----------> Preview Vercel + Staging Supabase
```

Content publication occurs through the Production CMS after the Production revision boundary is verified. It does not require a second database synchronization workflow. The prior staging-to-main merge was application-code promotion only.
