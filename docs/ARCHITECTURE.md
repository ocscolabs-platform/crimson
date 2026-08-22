# Architecture

## Current state

The repository contains a Next.js App Router application using TypeScript, Tailwind CSS, and ESLint. The public route structure is implemented for the homepage, Services, service detail pages, Work, About, and Contact. The public website is deployed through Vercel and the contact workflow uses environment-specific Supabase and Resend server integrations. Public content uses the published Supabase read boundary. The authenticated CMS is exposed only at the canonical `/crimson-admin-control` path; direct `/admin` and `/admin/*` requests return `404` before the internal route rewrite. Revision records, owner-only publish/restore RPCs, role-aware RLS, and database-generated audit history define the target CMS workflow. The current release gates are documented in [`RELEASE-READINESS.md`](./RELEASE-READINESS.md).

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

## Approved roadmap extensions

The next CMS extension is full structured body-content editing for Home, About, Services, and Contact. After that foundation is stable, Insights will use the same Next.js application, Supabase data boundary, Auth membership roles, RLS, revision ledger, audit history, private media contract, SEO metadata conventions, and published-only public reads. It will not introduce a third-party CMS or a parallel publishing system. The CRM remains a separate internal capability with its own scope, permissions, and workflow; the public inquiry form is not itself a complete CRM.

The planned public Blog routes are `/insights` and `/insights/[slug]`. The Cairnstack URLs supplied as references define only a structural content expectation and must not drive copied design or implementation.

## Current protected boundary

The `/crimson-admin-control` route uses Supabase Auth cookies through `@supabase/ssr` and verifies the current user server-side. The password recovery callback exchanges the one-time PKCE code on the server before exposing the reset form. CMS signup is disabled; owner invitations use the server-side Supabase administrator API and the dedicated `/crimson-admin-control/invite` implicit callback flow, while normal login/recovery remains PKCE-based. Membership assignment is recoverable if the Auth invite succeeds but the CMS membership write fails. CMS writes use revision RPCs and role checks; direct content-table writes are not the normal editor path. Production migration state and external environment configuration must be verified after the staging-to-main code merge and before the release is declared baseline-stable.
