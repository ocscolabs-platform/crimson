# OCSCO Project Crimson — Phase 1 Information Architecture

Project Crimson is OCSCO's new platform repository. It will eventually support a public website, a custom CMS, and a custom CRM as one integrated platform. The Phase 0 foundation is complete; the current phase defines the product and information architecture before visual or feature implementation begins.

## Stack

- Next.js with the App Router
- TypeScript
- Tailwind CSS
- ESLint
- npm

Supabase is a planned backend service. GitHub is the source repository and Vercel hosts the current foundation deployment. No production credentials or Supabase integrations are configured.

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

Read [`AGENTS.md`](./AGENTS.md) before making repository changes. Deeper project documentation lives in [`docs/`](./docs/), including the current [`INFORMATION-ARCHITECTURE.md`](./docs/INFORMATION-ARCHITECTURE.md), [`CONTENT-MODEL.md`](./docs/CONTENT-MODEL.md), and [`PHASE-1-ACCEPTANCE.md`](./docs/PHASE-1-ACCEPTANCE.md).
