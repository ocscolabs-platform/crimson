# OCSCO Project Crimson — Public Platform and Staging CMS Foundation

Project Crimson is OCSCO's new platform repository. It will eventually support a public website, a custom CMS, and a custom CRM as one integrated platform. The Phase 0 foundation, Phase 1 information architecture, and Phase 2 design direction are complete; the current phase is implementing the public website in reviewed slices.

## Stack

- Next.js with the App Router
- TypeScript
- Tailwind CSS
- ESLint
- npm

Supabase is the backend service. Preview/Staging and Production use separate Supabase projects and Resend configuration; no credentials or backend configuration values are stored in the repository. GitHub is the source repository and Vercel hosts the deployments.

## Local development

Requirements: Node.js 20.9 or newer and npm.

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

The staging branch also contains a protected CMS review dashboard at `/admin` and a controlled service editor at `/admin/services/[slug]`. It uses Supabase Auth sessions and RLS-backed role boundaries; staging setup and current publishing limits are described in [`docs/PHASE-4-CMS-AUTH.md`](./docs/PHASE-4-CMS-AUTH.md) and [`docs/PHASE-4-CMS-EDITOR.md`](./docs/PHASE-4-CMS-EDITOR.md). Broader CMS editing and Production publishing are intentionally not enabled.

Read [`AGENTS.md`](./AGENTS.md) before making repository changes. Deeper project documentation lives in [`docs/`](./docs/), including the information architecture, content model, visual direction, content briefs, and [`PHASE-3-IMPLEMENTATION.md`](./docs/PHASE-3-IMPLEMENTATION.md).
