# Release Readiness Baseline

This document is the operational baseline for the current CMS release model. Older Phase 4 documents remain useful as implementation history, but this file governs staging-to-Production decisions until the CMS rollout is complete.

## Current verdict

The staging branch is not merge-ready until the database boundary, authentication recovery, production configuration, and release protections have passed the acceptance criteria below.

## Release contract

- `feature/*` is active development.
- `staging` is the integration and QA branch.
- `main` is Production.
- Git merges move application code only. They do not move Supabase rows, Auth users, Storage objects, RLS policies, or environment variables.
- The canonical CMS path is `/crimson-admin-control`. `/admin` is a compatibility redirect, not a security boundary.
- CMS content follows `Draft -> Review -> Published` through revision records.
- Only an owner can publish or restore a revision.
- Public routes read the published boundary only.
- Staging and Production use separate runtime configuration and Supabase projects.
- The staging-to-Production row-copy workflow is temporary migration infrastructure. It is not the steady-state content release mechanism and must be retired after revision publishing is proven in Production.

## Required verification order

1. Confirm the exact migration state, grants, RLS policies, functions, triggers, and Storage policies in staging.
2. Confirm the equivalent Production boundary before deploying code that depends on it.
3. Verify login, logout, password recovery, role checks, revision save, review, publish, restore, media, relationships, and audit history in staging.
4. Verify the Production Vercel variables and Supabase Auth URL configuration without exposing secrets.
5. Enable branch protection and required reviewers for `staging`, `main`, and the `production-cms` environment.
6. Retire the row-copy bridge only after the Production revision workflow is accepted.
7. Run the final QA matrix and merge `staging` into `main` only when every gate passes.

## Password recovery contract

Reset emails must redirect to:

```text
/crimson-admin-control/auth/callback?next=/crimson-admin-control/reset-password
```

The server callback exchanges the one-time Supabase PKCE code and establishes the session before the reset form is shown. The reset page must never exchange the code itself or fall through to the public root.

Each Supabase project must allow its own canonical callback URL. A fresh reset email must be used for every test because Supabase recovery codes are one-time credentials.

## Steady-state architecture

```text
feature/* -> staging -> main
                 |       |
                 |       +--> Production Vercel + Production Supabase
                 +----------> Preview Vercel + Staging Supabase
```

Content publication occurs through the Production CMS after the Production revision boundary is verified. It does not require a second database synchronization workflow.
