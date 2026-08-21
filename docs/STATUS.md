# Project Status

## Current Phase

**Phase 4C — Post-Merge Release Verification and Baseline Stabilization**

The canonical roadmap is [`MASTER-PLAN.md`](./MASTER-PLAN.md). This file records the current implementation state; older detailed phase documents and early task entries are historical implementation records where their statuses conflict with later verified slices.

Phase 0 through Phase 3 are complete. The public route structure, visual system, environment-specific contact workflow, production metadata, and domain release are implemented. Phase 4A and 4B are implemented for the approved CMS slices: schema, published-only public read boundary, role authorization, revision-based publishing, media workflow, relationships, audit history, and canonical `/crimson-admin-control` route. The staging-to-main code merge has already occurred; the current release audit verifies the resulting Production deployment/data boundary and establishes a clean synchronized baseline before Phase 5.

The current CMS is not yet a complete body-content editor for Home, About, Services, and Contact. It currently manages global metadata/settings, navigation, fixed approved section visibility/order, services, case-study editorial data, media, relationships, and revisions. Full page-body editing is Phase 5. Blog / Insights is approved for Phase 6 and has not been implemented. CRM remains Phase 7 and is not implemented beyond inquiry intake.

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
- Completed the staging accessibility/privacy QA pass: admin labels and disclosure controls are associated correctly, select icons are hidden from assistive technology, auth forms have named controls, `/crimson-admin-control` remains session-gated while `/admin` returns `404`, and unapproved case-study media is absent from public routes.
- Verified the controlled case-study media workflow in staging: three normalized media slots are rendered with fixed public frames, the approved package is private until publication rules allow signed delivery, and the public Cairnstack route exposes the approved featured/supporting visuals.
- Verified the controlled case-study relationship workflow in staging: the Cairnstack record has one linked published capability, the audit surface is present, and the public route renders the relationship as an accessible service link.
- Corrected the shared admin presentation copy after Production review: login, recovery, dashboard, content, service, team, and case-study surfaces now use deployment-neutral CMS language instead of incorrectly labeling Production as staging.
- Added the guarded staging-to-Production CMS promotion boundary as a temporary migration bridge. It is not the target editorial workflow and remains only until the Production revision path is verified and the bridge can be retired safely.
- Added the additive revision ledger and protected publish/restore RPCs for the core content types. Global content, Services, and case-study metadata, relationships, and media editor actions now save private Draft/Review revisions; owner-only publish controls are separate from Save, and the public site remains on published base records. Production verification is still required; a Git merge does not apply migrations or promote Supabase data/configuration.
- Verified the live remote Git state on 2026-08-22: `origin/main` (`0b58c03`) is an ancestor of `origin/staging` (`b78976c`); `origin/main` is 0 commits ahead and `origin/staging` is 9 commits ahead. The staging-only history is approved post-merge documentation/reconciliation and merge history; the only non-documentation file difference is a comment-only clarification in the existing Production CMS migration, so there is no unreviewed application-code divergence and staging is not behind main.
- Verified locally that lint, TypeScript checking, the production build, and whitespace validation pass; no automated test suite is configured in the repository.
- Verified the Production public route smoke matrix: the public pages and published Cairnstack route return successfully, `/crimson-admin-control` is session-gated, and `/admin` plus `/admin/*` return normal `404` responses.

## In Progress

- Complete the owner-controlled Production Supabase inspection for migrations, RLS, grants, functions, triggers, Storage policies, and the exact Vercel environment mapping.
- Complete fresh authenticated Production smoke tests for login, logout, password recovery, invitation acceptance, revision save/review/publish/restore, audit, media, relationships, and inquiry behavior.
- Confirm the public published-only read boundary against an intentionally unpublished or review record and verify the approved media contract in Production.
- Resolve or retire the temporary row-copy promotion bridge after the Production revision workflow and rollback path are proven.
- Record the Production release sign-off and keep `staging` synchronized to the approved `main` baseline for the next feature cycle.

## Blocked / Requires Owner Action

- Configure GitHub branch protection for `feature/*`, `staging`, and `main`.
- Verify Production Vercel variables point to the Production Supabase project and contain no staging Supabase URL/key pair; confirm the production deployment is using the expected commit.
- Run the approved read-only Production Supabase verification queries from the owner account. The repository cannot inspect the owner dashboard's migrations, grants, triggers, functions, RLS policies, or Storage policies without owner access.
- Execute the owner-controlled Production mutation smoke matrix. These tests must create or change real revisions/media only within the approved rollback procedure; they cannot be safely inferred from public reads.
- Provide approved case-study facts, outcomes, testimonials, team details, and contact destination before implementation.
- Confirm which visual assets from the existing brand materials may be copied into Crimson.
- Keep WordPress hosting available during the short rollback window, then cancel it after final owner confirmation.

No account IDs, URLs, domains, credentials, or production secrets were fabricated or added.

## Next Recommended Step

Execute the remaining owner-controlled checks in the post-merge Phase 4C checklist in [`docs/MASTER-PLAN.md`](./MASTER-PLAN.md) and [`docs/RELEASE-READINESS.md`](./RELEASE-READINESS.md) in order. Do not begin Phase 5 or Phase 6 until those checks are signed off and `staging` remains synchronized to the approved `main` baseline.
