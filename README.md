# OCSCO Project Crimson — Phase 0 Foundation

Project Crimson is OCSCO's new platform repository. It will eventually support a public website, a custom CMS, and a custom CRM as one integrated platform. Phase 0 intentionally provides only a minimal, deployment-ready application foundation.

## Stack

- Next.js with the App Router
- TypeScript
- Tailwind CSS
- ESLint
- npm

Supabase, Vercel, and GitHub are planned platform services. No production credentials or external integrations are configured in Phase 0.

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
docs/           Project, architecture, deployment, decisions, and status docs
public/         Public static assets for the application
```

Read [`AGENTS.md`](./AGENTS.md) before making repository changes. Deeper project documentation lives in [`docs/`](./docs/).
