# Architecture

## Current state

The repository currently contains a Next.js App Router application using TypeScript, Tailwind CSS, and ESLint. The first public route structure is implemented for the homepage, Services, service detail pages, Work, About, and Contact. The public website is deployed through Vercel and the contact workflow uses environment-specific Supabase and Resend server integrations. Public page and service content still uses a structured local boundary; the CMS foundation is now being introduced through a reviewed Supabase migration.

No CMS admin UI, authentication boundary, storage/media library, CRM, or protected admin routes exist yet. Production credentials remain outside the repository.

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
