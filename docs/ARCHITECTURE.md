# Architecture

## Current state

The repository currently contains a minimal Next.js App Router application shell using TypeScript, Tailwind CSS, and ESLint. The shell identifies the repository as OCSCO Project Crimson and communicates that it is a foundation, not a finished website. The foundation is deployed through Vercel at [ocsco-project-crimson.vercel.app](https://ocsco-project-crimson.vercel.app/).

No Supabase project is connected. No authentication, storage, CMS, CRM, protected admin routes, or production service credentials exist in this phase.

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
