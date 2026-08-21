# Architecture

## Current state

The repository contains a Next.js App Router application using TypeScript, Tailwind CSS, and ESLint. The public route structure is implemented for the homepage, Services, service detail pages, Work, About, and Contact. The public website is deployed through Vercel and the contact workflow uses environment-specific Supabase and Resend server integrations. Public content uses the published Supabase read boundary. The authenticated CMS is exposed at the canonical `/crimson-admin-control` path, with `/admin` retained only as a compatibility redirect. Revision records, owner-only publish/restore RPCs, role-aware RLS, and database-generated audit history define the target CMS workflow. The current release gates are documented in [`RELEASE-READINESS.md`](./RELEASE-READINESS.md).

Production credentials remain outside the repository. Staging and Production remain separate runtime environments; Git merges move code only and do not synchronize CMS rows, Auth users, or Storage objects. The row-copy runner is temporary migration infrastructure and must not become the normal editorial release path.

## Planned high-level architecture

```text
Public Website                 Protected Admin Application
       │                                      │
       └────────────── Next.js ──────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
          Custom CMS                   Custom CRM
                │                           │
                └────────── Supabase ───────┘
                              │
                  PostgreSQL / Auth / Storage

GitHub → source control and source of truth
Vercel → deployment infrastructure
```

## Planned responsibilities

- **Public Website:** public-facing OCSCO pages and content delivery.
- **Protected Admin Application:** authenticated workspace for authorized staff.
- **Custom CMS:** structured content management and publishing workflows.
- **Custom CRM:** internal business and relationship workflows.
- **Next.js:** application framework and route boundary for public and protected experiences.
- **Supabase:** planned PostgreSQL, authentication, and storage platform.
- **Vercel:** hosting and preview/production deployment platform for the application.
- **GitHub:** source control and the canonical repository workflow.

These are plans, not claims that the systems already exist. Future architecture changes must be documented in [`DECISIONS.md`](./DECISIONS.md).

## Current protected boundary

The `/crimson-admin-control` route uses Supabase Auth cookies through `@supabase/ssr` and verifies the current user server-side. The password recovery callback exchanges the one-time PKCE code on the server before exposing the reset form. CMS writes use revision RPCs and role checks; direct content-table writes are not the normal editor path. Production migration state and external environment configuration must be verified before the staging branch is merged.
