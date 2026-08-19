# Architecture

## Current state

The repository currently contains a Next.js App Router application using TypeScript, Tailwind CSS, and ESLint. The first public route structure is implemented for the homepage, Services, service detail pages, Work, About, and Contact. The public website is deployed through Vercel and the contact workflow uses environment-specific Supabase and Resend server integrations. Public page, service, work, and shared chrome content now use a reviewed published-only Supabase read boundary with local fallbacks. A staging-only Supabase Auth boundary protects `/admin`, where the controlled Services editor uses role-aware RLS and database-generated audit history; broader CMS mutations remain out of scope.

No CMS editor, role/permission model, storage/media library, CRM, or production admin access exists yet. Production credentials remain outside the repository.

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

The staging `/admin` route uses Supabase Auth cookies through `@supabase/ssr` and verifies the current user server-side. It reads records through the published-only RLS boundary, with the first controlled write slice limited to service records for assigned owner/editor roles. Pages, navigation, site settings, case studies, media, and CRM remain outside the editor.
