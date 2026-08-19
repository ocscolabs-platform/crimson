# Project Status

## Current Phase

**Phase 3 — Public Website Launch Readiness**

Phase 0, Phase 1, and Phase 2 are complete. The public route structure, visual system, and environment-specific contact workflow are implemented. The reviewed workflow is now promoted to `main`; CMS, CRM, and authentication remain unimplemented, while the controlled Production test and DNS cutover are pending.

## Completed

- Connected the local project workspace to the empty GitHub repository `ocscolabs-platform/crimson`.
- Added the repository operating contract in `AGENTS.md`.
- Added setup, structure, and validation guidance in `README.md`.
- Added project vision, architecture, deployment, decision log, and status documentation.
- Added a minimal Next.js App Router, TypeScript, Tailwind CSS, and ESLint application shell.
- Added `.env.example` with variable names and comments only.
- Added Git ignore rules for dependencies, build output, local environment files, and secrets.
- Created the initial local foundation commit.
- Pushed the foundation to GitHub on the `main` branch.
- Connected the repository to Vercel and verified the live foundation deployment.
- Added the Phase 1 information architecture, content model, and acceptance criteria documents.
- Reviewed the existing OCSCO Brand Style Guide as the reference for Phase 2 direction.
- Added Phase 2 content briefs, visual design direction, and acceptance criteria.
- Implemented the first public homepage slice with responsive layout, shared visual tokens, capability sections, approach, contact CTA, and honest proof-state copy.
- Inspected the homepage at desktop and mobile viewport sizes with no browser console errors.
- Added route shells for Services, five service detail pages, Work, About, and Contact.
- Added structured local service content and generated static service detail routes.
- Smoke-tested all public routes and confirmed page titles and H1 content.
- Promoted the reviewed Phase 3 contact workflow to `main` in commit `1dc5c54`.
- Applied the Production `public.inquiries` migration to the selected clean Supabase project.
- Configured separate Production Supabase and Resend variables in Vercel, including the verified `send.ocsco.io` sender domain.

## In Progress

- Locked the standalone OCSCO HTML design style guide as the official v1.0 visual source of truth for typography, native hero atmosphere, iconography, media placeholders, and component states.
- Completing owner content, accessibility, privacy/consent, controlled Production submission testing, and DNS cutover.

## Blocked / Requires Owner Action

- Configure GitHub branch protection for `feature/*`, `staging`, and `main`.
- Provide approved case-study facts, outcomes, testimonials, team details, and contact destination before implementation.
- Confirm which visual assets from the existing brand materials may be copied into Crimson.
- Run the controlled Production submission and confirm the database row, owner email, and deployment logs.
- Switch `ocsco.io` and `www.ocsco.io` DNS from WordPress to Vercel after the controlled test passes.

No account IDs, URLs, domains, credentials, or production secrets were fabricated or added.

## Next Recommended Step

Run one controlled Production form submission, verify the `inquiries` row and owner email, then switch the approved DNS records from WordPress to Vercel. Future guide changes must be versioned as v1.1 or v2.0 and approved before production promotion. Do not begin CMS or CRM work until Phase 3 is approved and released.
