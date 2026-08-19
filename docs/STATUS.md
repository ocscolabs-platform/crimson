# Project Status

## Current Phase

**Phase 4 — Custom CMS Foundation**

Phase 0 through Phase 3 are complete. The public route structure, visual system, environment-specific contact workflow, production metadata, and domain release are implemented. Phase 4 is active with a reviewed CMS schema, published-only public read boundary, staging-only protected admin auth, the initial role/authorization boundary, a controlled Services editor, audit/publishing safeguards, owner-only restore-as-review, and a privacy-safe Work renderer. Broader CMS editing, case-study mutations, general version management, media storage, and production admin access remain unimplemented.

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
- Confirmed the Production inquiry row and owner email notification.
- Switched `ocsco.io` and `www.ocsco.io` from WordPress DNS to Vercel.
- Added the Phase 4 CMS foundation scope and an RLS-protected relational migration for settings, navigation, pages, services, and case studies.
- Updated public Work rendering to redact hidden case-study identity, copy, and external links while preserving approved presentation.

## In Progress

- QA the privacy-safe case-study renderer, then resolve audit coverage, media contract, and featured-project rule before enabling case-study mutations.
- Keep the Work library read-only while the owner reviews the case-study workflow and publication checklist.
- Complete live QA of CMS-backed Services, Work, navigation, footer settings, page metadata, and protected auth routing before broader CMS work.
- Complete owner content, accessibility, and privacy/consent follow-up from the technical release.

## Blocked / Requires Owner Action

- Configure GitHub branch protection for `feature/*`, `staging`, and `main`.
- Provide approved case-study facts, outcomes, testimonials, team details, and contact destination before implementation.
- Confirm which visual assets from the existing brand materials may be copied into Crimson.
- Keep WordPress hosting available during the short rollback window, then cancel it after final owner confirmation.

No account IDs, URLs, domains, credentials, or production secrets were fabricated or added.

## Next Recommended Step

QA the privacy-safe Work renderer in staging, then extend audit coverage before adding a case-study review panel or editor. Do not promote case-study mutations or any staging content change to Production. Future guide changes must be versioned as v1.1 or v2.0 and approved before production promotion.
