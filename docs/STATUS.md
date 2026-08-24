# Project Status

## Current Phase

**Phase 5B Slice 4A — Shared PageDocument public loader and renderer foundation — Closed**
**Phase 4C staging baseline and QA — Complete**
**Production release/promotion gate — Deferred release gate**

The canonical roadmap is [`MASTER-PLAN.md`](./MASTER-PLAN.md). This file records the current implementation state; older detailed phase documents and early task entries are historical implementation records where their statuses conflict with later verified slices.

Phase 0 through Phase 3 are complete. The public route structure, visual system, environment-specific contact workflow, production metadata, and domain release are implemented. Phase 4A and 4B are complete for the approved staging CMS slices: schema, published-only public read boundary, role authorization, revision-based publishing, media workflow, relationships, audit history, and canonical `/crimson-admin-control` route. Owner-approved staging Phase 4C baseline and QA are complete. Production deployment, configuration, Auth, database, and promotion verification remain a deferred release gate and do not block Phase 5 development in staging.

The current CMS is not yet a complete body-content editor for Home, About, Services, and Contact. It currently manages global metadata/settings, navigation, fixed approved section visibility/order, services, case-study editorial data, media, relationships, and revisions. Full page-body editing is Phase 5. Insights is approved for Phase 6 and has not been implemented. CRM remains Phase 7 and is not implemented beyond inquiry intake.

The deferred Production gate still includes the invitation-flow remediation: Supabase administrator invitations must establish an implicit callback session at `/crimson-admin-control/invite` before the CMS membership is activated. Public signup remains disabled.

## Phase 5B Slice 3 — Staging backfill complete

The owner-approved Slice 3 backfill is complete in `crimson-staging`. The four Phase 5 page rows—Home, Services, About, and Contact—now contain validated `schemaVersion: 1` PageDocument objects and four migration-generated Published baseline snapshots. Work remains a legacy array and was not converted. Transitional `page_sections` compatibility remains available for the current public renderer, and the two scoped anti-drift guards remain intentionally installed until the approved later cutover.

The active read-only staging verifier now checks post-Slice-3 migration state structurally: canonical local and remote ledgers must match with no pending versions, the Slice 3 version must be recorded exactly once, and the linked Supabase dry-run must exit successfully without applying anything. The temporary one-shot Slice 3 execution workflow was retired after the successful staging apply. Its post-apply false negative was caused by an alias typo in its temporary guard query (`pg_trigger` was aliased as `trg` but referenced as `trigger`); this was verification infrastructure only and did not indicate a database or migration failure. The Phase 5B staging bootstrap correction remains in place, with global content seeded before the Phase 5 page-section seed and registry verification.

Production release and promotion remain a deferred release gate. Slice 4A is closed after automated staging-health verification; public route cutover has not begun. The verifier now runs on every push to `staging`. Phase 6 Insights remains not started.

## Phase 5B Slice 4A — Shared loader and renderer foundation — Closed

The approved Slice 4A foundation adds a typed published PageDocument loader for Home, Services, About, and Contact, a static code-owned section renderer registry, deterministic enabled-section render plans, and runtime Service-reference resolution. It does not change public route rendering authority, metadata authority, Work, PageDocument rows, `page_sections`, migrations, or Supabase data. Legacy section controls for migrated pages are presented as read-only during the transition; Work controls remain unchanged. Automated `Verify clean crimson-staging` run #11 passed on the merged `staging` commit, confirming the staging baseline and contracts remain intact.

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
- The latest refreshed Git comparison is `origin/main` (`f098902`) versus `origin/staging` (`b78976c`): `git rev-list --left-right --count origin/main...origin/staging` returned `3 1`. The remote branches are divergent; the remediation branch is based on the latest `origin/main` and must enter `staging` through a normal pull request. No force reset or history rewrite is allowed.
- Added the canonical Supabase CLI configuration, migration-history validator, read-only parity contract, and approval-gated staging/Production migration workflow. Local lint, typecheck, migration validation, production build, and diff checks pass; no automated application test suite is configured in the repository.
- The CMS row-copy promotion workflow remains transitional and separate from the database migration pipeline. Production database changes require explicit owner approval through the protected `production-supabase` environment.
- Verified the Production public route smoke matrix: the public pages and published Cairnstack route return successfully, `/crimson-admin-control` is session-gated, and `/admin` plus `/admin/*` return normal `404` responses.
- Closed the owner-approved staging Phase 4C baseline and QA acceptance: clean rebuild, migration parity, CMS workflows, media, inquiry persistence, route protection, metadata isolation, Production endpoint/domain isolation, and browser/runtime health all passed.

## Deferred Release Gate / Requires Owner Action

- Complete the owner-controlled Production Supabase inspection for migrations, RLS, grants, functions, triggers, Storage policies, and the exact Vercel environment mapping before Production promotion.
- Configure and verify the GitHub `staging-supabase` and `production-supabase` environments required by the canonical migration workflow; no secret values belong in Git.
- Complete fresh authenticated Production smoke tests for login, logout, password recovery, invitation acceptance, revision save/review/publish/restore, audit, media, relationships, and inquiry behavior.
- Confirm the public published-only read boundary against an intentionally unpublished or review record and verify the approved media contract in Production.
- Resolve or retire the temporary row-copy promotion bridge after the Production revision workflow and rollback path are proven.
- Record the Production release sign-off and keep `staging` synchronized to the approved `main` baseline before Production promotion.
- After Phase 4C QA, remove or set the Preview/staging `INQUIRY_SUBMISSIONS_ENABLED` override to `false` unless an owner-approved staging inquiry test is actively required. Production remains independently configured.

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

Proceed with the approved Phase 5B Slice 4B About public PageDocument cutover. Keep the deferred Production release gate visible, and keep Phase 6 Insights unstarted until the remaining Phase 5B slices are complete.
