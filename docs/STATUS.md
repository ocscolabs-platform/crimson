# Project Status

## Current Phase

**Phase 4 — Custom CMS Foundation**

Phase 0 through Phase 3 are complete. The public route structure, visual system, environment-specific contact workflow, production metadata, and domain release are implemented. Phase 4 is active with a reviewed CMS schema, published-only public read boundary, staging-only protected admin auth, the initial role/authorization boundary, a controlled Services editor, audit/publishing safeguards, owner-only restore-as-review, a privacy-safe Work renderer, controlled global content and page-section composition, the case-study media contract, an update-only case-study editor, and verified staging media and relationship workflows. Case-study creation/deletion, general version management, and production admin access remain unimplemented.

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
- Added the staging-only case-study and relationship audit migration locally; Supabase application and verification remain pending.
- Added a protected read-only case-study review panel; authenticated staging preview QA completed.
- Added the staging-only case-study media contract and single published featured-project migration locally; staging application and verification remain pending.
- Added and verified the update-only staging case-study editor and role-aware publication safeguards in `crimson-staging`; the core review/publish workflow passed, and the latest save-feedback UX is ready for staging deployment.
- Completed the first Admin UX hardening slice: shared spacing/navigation treatment, visible select cues, server-side audit pagination, password recovery screens, accessible authentication feedback, and responsive case-study detail layout.
- Implemented Admin UX hardening v2 locally: responsive global-content rows, corrected select spacing, primary/secondary action hierarchy, accessible disclosure groups, and sticky global-content section navigation. Staging desktop QA passed; responsive rules remain in place for tablet/mobile review.
- Applied the Admin UX follow-up locally: replaced the literal select caret with a shared icon control, widened the jump navigation rhythm, increased disclosure and row spacing, and moved global-content rows to a two-column field layout earlier at tablet widths to prevent collisions. Staging desktop QA passed; responsive rules remain in place for tablet/mobile review.
- Applied the action hierarchy follow-up locally: media replacement actions now use the neutral secondary treatment while upload and approval actions remain primary. Staging desktop QA passed.
- Fixed the confirmed global-content grid collision by constraining shared admin inputs and select wrappers to their grid tracks; staging QA completed successfully at desktop width with no horizontal overflow.
- Admin UX refinement is implemented locally: shared account controls, full-shell audit rows and pagination, inline page-status accordions, reduced admin hero density, a consistent select icon, and a separated media approval action row. Staging desktop QA passed with aligned right edges, 40px pagination-to-footer spacing, and no control overflow.
- Completed the staging accessibility/privacy QA pass: admin labels and disclosure controls are associated correctly, select icons are hidden from assistive technology, auth forms have named controls, `/admin` remains session-gated, and unapproved case-study media is absent from public routes.
- Verified the controlled case-study media workflow in staging: three normalized media slots are rendered with fixed public frames, the approved package is private until publication rules allow signed delivery, and the public Cairnstack route exposes the approved featured/supporting visuals.
- Verified the controlled case-study relationship workflow in staging: the Cairnstack record has one linked published capability, the audit surface is present, and the public route renders the relationship as an accessible service link.
- Corrected the shared admin presentation copy after Production review: login, recovery, dashboard, content, service, team, and case-study surfaces now use deployment-neutral CMS language instead of incorrectly labeling Production as staging.
- Added the guarded staging-to-Production CMS promotion boundary: a Production public-read migration, an owner-triggered dry-run/apply runner, and a protected GitHub workflow that promotes published content and approved WebP media without copying users, inquiries, audit history, or credentials.

## In Progress

- Keep the Work library read-only while the owner reviews the case-study workflow and publication checklist.
- Keep case-study creation/deletion and Production administration separate until the content and consent review is complete.
- Apply the Production CMS boundary migration once, configure the protected GitHub `production-cms` environment secrets, run a dry-run, then promote the owner-approved staging package. Keep editorial work in staging after the first release.

## Blocked / Requires Owner Action

- Configure GitHub branch protection for `feature/*`, `staging`, and `main`.
- Provide approved case-study facts, outcomes, testimonials, team details, and contact destination before implementation.
- Confirm which visual assets from the existing brand materials may be copied into Crimson.
- Keep WordPress hosting available during the short rollback window, then cancel it after final owner confirmation.

No account IDs, URLs, domains, credentials, or production secrets were fabricated or added.

## Next Recommended Step

The staging CMS media and relationship workflows are verified on the Cairnstack record, the Admin UX hardening follow-up passed review, and a guarded staging-to-Production promotion path is now implemented. The owner must apply the one-time Production boundary migration and add the four protected GitHub Environment Secrets before running the dry-run and apply workflow.
