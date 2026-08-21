# OCSCO Project Crimson — Public Platform and Staging CMS Foundation

Project Crimson is OCSCO's integrated public website, custom CMS, Blog / Insights, and CRM platform repository. Phase 0 through Phase 3 are complete; the approved CMS slices are implemented and the staging-to-main code merge has occurred. The current phase is post-merge Production verification and baseline stabilization before new page-content, Blog, or CRM implementation begins. The canonical roadmap is [`docs/MASTER-PLAN.md`](docs/MASTER-PLAN.md).

## Stack

- Next.js with the App Router
- TypeScript
- Tailwind CSS
- ESLint
- npm

Supabase is the backend service. The CMS release model is being reset to a single published-content source with revision-based publishing; the transition plan is documented in [`docs/RELEASE-ARCHITECTURE.md`](docs/RELEASE-ARCHITECTURE.md). No credentials or backend configuration values are stored in the repository. GitHub is the source repository and Vercel hosts the deployments.

## Local development

Requirements: Node.js 22.x and npm. The repository uses `.nvmrc` and the package engine declaration to keep local and CI validation aligned.

```bash
npm install
npm run dev
```

Open `http://localhost:3000` to view the foundation shell.

## Validation and production build

```bash
npm run lint
npm run build
npm run start
```

Copy `.env.example` to `.env.local` only when local configuration is needed. Keep real values local and never commit them.

## Repository structure

```text
src/app/       App Router application shell and global styles
docs/          Project, architecture, deployment, decisions, and status docs
public/        Public static assets and the browsable HTML design style guide
```

The official v1.0 visual source of truth is [`public/style-guide/index.html`](./public/style-guide/index.html), available at `/style-guide` in the deployed application and locally while the development server is running. It documents the OCSCO visual principles, tokens, components, content voice, and implementation rules used for the redesign.

The CMS is available only at the canonical `/crimson-admin-control` path. Direct `/admin` and `/admin/*` requests return `404`; the generic namespace is not a CMS entry point. It uses Supabase Auth sessions, revision-based publishing, and RLS-backed role boundaries. The current release contract and merge gates are documented in [`docs/RELEASE-READINESS.md`](./docs/RELEASE-READINESS.md). The guarded row-copy workflow in [`docs/CMS-PROMOTION.md`](./docs/CMS-PROMOTION.md) is transitional infrastructure only and is not the target editorial workflow.

Read [`AGENTS.md`](./AGENTS.md) before making repository changes. Deeper project documentation lives in [`docs/`](./docs/), including the information architecture, content model, visual direction, content briefs, and [`PHASE-3-IMPLEMENTATION.md`](./docs/PHASE-3-IMPLEMENTATION.md).
