# Architecture Decision Log

Dates use the repository work date where a decision was made during Phase 0.

## ADR-001 — Replace WordPress

- **Decision:** Replace the existing WordPress website with a custom OCSCO platform.
- **Rationale:** OCSCO needs a foundation that can support its public website and future integrated CMS, CRM, and custom application capabilities.
- **Status:** Accepted
- **Date:** 2026-08-19

## ADR-002 — Use Next.js as the application framework

- **Decision:** Use Next.js with the App Router and TypeScript.
- **Rationale:** It provides a production-ready application framework with clear support for public routes, protected application areas, server-side functionality, and future Supabase integration.
- **Status:** Accepted
- **Date:** 2026-08-19

## ADR-003 — Use GitHub as source control and source of truth

- **Decision:** GitHub will host the canonical repository and code review workflow.
- **Rationale:** A shared Git source of truth supports history, collaboration, branch protection, and deployment integration.
- **Status:** Accepted
- **Date:** 2026-08-19

## ADR-004 — Use Vercel as planned deployment infrastructure

- **Decision:** Vercel is the planned deployment platform.
- **Rationale:** It aligns with the Next.js application model and supports preview, staging, and production deployment workflows.
- **Status:** Accepted; foundation deployment connected
- **Date:** 2026-08-19

## ADR-005 — Use Supabase as the planned backend platform

- **Decision:** Supabase is the planned platform for PostgreSQL, authentication, and storage.
- **Rationale:** It provides the backend capabilities expected by the future CMS and CRM while preserving a clear integration boundary for the Next.js application.
- **Status:** Accepted; credentials and project configuration pending
- **Date:** 2026-08-19

## ADR-006 — Build a custom CMS

- **Decision:** The CMS will be custom-built for OCSCO.
- **Rationale:** OCSCO needs content structures and workflows tailored to its platform rather than an unrelated off-the-shelf product.
- **Status:** Planned
- **Date:** 2026-08-19

## ADR-007 — Build a custom CRM

- **Decision:** The CRM will be custom-built for OCSCO.
- **Rationale:** OCSCO's internal business workflows should be represented in a system designed around its actual operations.
- **Status:** Planned
- **Date:** 2026-08-19

## ADR-008 — Integrate CMS and CRM into one OCSCO platform

- **Decision:** The CMS and CRM will be integrated into the OCSCO platform rather than delivered as separate unrelated products.
- **Rationale:** Shared platform foundations, access control, data boundaries, and workflows can reduce duplication and support a coherent operating system for OCSCO.
- **Status:** Planned
- **Date:** 2026-08-19

## ADR-009 — Require development, staging, and production separation

- **Decision:** Development, staging, and production must remain separate environments with separately managed configuration and secrets.
- **Rationale:** Separation reduces the risk of accidental production changes and protects production data and credentials during development and review.
- **Status:** Accepted
- **Date:** 2026-08-19

## ADR-010 — Use a documentation-first Phase 1

- **Decision:** Define the public sitemap, content model, audiences, and acceptance criteria before implementing visual design or application features.
- **Rationale:** Clear information architecture reduces rework and gives future design, CMS, and CRM work an agreed product boundary.
- **Status:** Accepted
- **Date:** 2026-08-19

## ADR-011 — Use the OCSCO Brand Style Guide as the visual reference

- **Decision:** Use the existing OCSCO Brand Style Guide, Version 2.0, as the reference for Phase 2 visual direction. The guide remains an external reference and is not copied into the application repository.
- **Rationale:** It provides an existing, owner-created foundation for positioning, tone, color, typography, spacing, interaction, and image direction. Reusing it reduces visual drift and prevents speculative branding decisions.
- **Status:** Proposed for owner confirmation
- **Date:** 2026-08-19

## ADR-012 — Implement the public website homepage first

- **Decision:** Use the homepage as the first Phase 3 implementation slice, with shared visual tokens and in-page sections for capabilities, approach, proof placeholder, and contact direction.
- **Rationale:** A homepage slice provides a reviewable expression of the visual system and messaging hierarchy without prematurely committing to the full route set, CMS, CRM, or unapproved proof content.
- **Status:** Accepted for Phase 3; owner review pending
- **Date:** 2026-08-19

## ADR-013 — Establish the public route skeleton before visual refinement

- **Decision:** Implement the approved public route tree and structured local content boundaries before spending additional effort on visual polish.
- **Rationale:** The route and content structure are the next product risk to resolve. Establishing them first allows navigation, metadata, page responsibilities, and future CMS boundaries to be reviewed independently from the visual treatment.
- **Status:** Accepted for current Phase 3 slice; owner review pending
- **Date:** 2026-08-19

## ADR-014 — Use a standalone HTML style guide as the visual source of truth

- **Decision:** Maintain the OCSCO visual system in `public/style-guide/index.html` before applying the redesign across the public application routes.
- **Rationale:** A browsable, implementation-oriented reference gives the owner and development work a shared source of truth for color, typography, spacing, layout, logo usage, components, content voice, and accessibility. It reduces visual drift while the public website is redesigned and later extended into CMS-driven surfaces.
- **Status:** Accepted for the current redesign preparation step; owner review pending
- **Date:** 2026-08-19

## ADR-015 — Align typography with the live OCSCO.io site

- **Decision:** Use Plus Jakarta Sans across the OCSCO application and standalone style guide with weights 400, 500, 600, 700, and 800.
- **Rationale:** The owner identified OCSCO.io as the preferred reference for typography and overall visual language. Matching its observed font family and weight hierarchy creates continuity between the existing brand presence and Project Crimson.
- **Status:** Accepted for the redesign preparation step; owner review pending
- **Date:** 2026-08-19

## ADR-021 — Use a server-side Supabase staging inquiry slice

- **Decision:** Connect the staging contact form to the dedicated `crimson-staging` Supabase project through a server-side Next.js route. Keep the Supabase secret key server-only, enable RLS on `public.inquiries`, and grant the minimum insert access required for the route.
- **Rationale:** A database-backed staging submission gives the team a testable workflow without opening a native email application or placing privileged credentials in the browser. Owner notification, anti-abuse hardening beyond the honeypot, and production delivery remain separate approvals.
- **Status:** Accepted for staging; production promotion pending workflow approval
- **Date:** 2026-08-19

## ADR-022 — Notify the owner through a server-side Resend integration

- **Decision:** After a validated inquiry is stored in Supabase, send a plain-text owner notification through the Resend Email API. Keep `RESEND_API_KEY` and notification configuration server-only, set Reply-To to the visitor email, and preserve the database record if notification delivery fails.
- **Rationale:** Storing first prevents loss of inquiries when an external email provider is unavailable. Resend provides a narrow server-side API path for the staging test without coupling the public form to Gmail credentials or a native mail client.
- **Status:** Accepted; staging and Production provider configuration verified
- **Date:** 2026-08-19

## ADR-023 — Use an existing clean Supabase project for Production

- **Decision:** Use the owner-confirmed clean and untouched Supabase project as the separate Production backend for Project Crimson. Keep the dedicated `crimson-staging` project isolated for Preview and staging work.
- **Rationale:** The owner’s Supabase account has reached its free-project limit. Reusing a verified empty project avoids unnecessary plan changes while preserving environment separation and preventing unrelated data from being mixed into Crimson.
- **Status:** Accepted; Production migration and environment configuration verified
- **Date:** 2026-08-19

## ADR-019 - Extend the v1.0 atmosphere across public route shells

- **Decision:** Apply the CSS-native glass/noise treatment to shared route heroes, use the approved Lucide mapping for Services capability cards, and use an atmospheric labeled placeholder for Work until approved media is available.
- **Rationale:** The public routes should feel like one OCSCO system rather than a styled homepage followed by generic templates. Extending the treatment through the shared shell creates continuity without introducing unapproved imagery or fabricated proof.
- **Status:** Accepted for Phase 3 staging review
- **Date:** 2026-08-19

## ADR-020 - Use a sticky glass shell with a mobile navigation menu

- **Decision:** Use a full-width sticky header with a restrained translucent glass treatment on long pages. Hide desktop navigation at mobile widths and expose the same links through an accessible menu button and expandable navigation panel. Use one shared footer component with a structured primary row and utility row.
- **Rationale:** Persistent navigation reduces friction on long public pages, while a burger menu preserves space and hierarchy on mobile. Shared shell components prevent the homepage and route pages from drifting apart. The footer hierarchy gives the wordmark, positioning statement, project metadata, and next action clear roles.
- **Status:** Accepted for Phase 3 staging review
- **Date:** 2026-08-19

## ADR-018 - Lock the official OCSCO design system v1.0

- **Decision:** Declare the current OCSCO HTML design style guide the official v1.0 baseline for Project Crimson and publish it through the Vercel application at `/style-guide`. Future non-breaking refinements become v1.1; structural or system-level changes become v2.0 and require explicit owner approval.
- **Rationale:** A stable public URL gives the team one accessible source of truth while Git and Vercel preserve review history, previews, and production promotion. Versioning prevents silent drift in typography, art direction, iconography, spacing, and interaction states.
- **Status:** Accepted; official v1.0 baseline
- **Date:** 2026-08-19

## ADR-017 - Use a CSS-native editorial hero and Lucide iconography

- **Decision:** Build the OCSCO hero atmosphere with CSS-native animated grain, blurred translucent planes, and a restrained contrast overlay. Use Lucide React as the application icon family, with icons paired to visible labels. Use clearly labeled placeholders for portfolio media until approved project assets are supplied.
- **Rationale:** The owner prefers the dark, editorial, grain-and-glass mood of walaszczyk.studio but wants a distinct OCSCO composition. A native treatment avoids copying third-party artwork, keeps the hero lightweight, and allows reduced-motion support. Lucide provides a coherent line system for capability and platform concepts without introducing decorative icon noise. Honest placeholders protect the project from fabricated proof while portfolio assets are pending.
- **Status:** Accepted for the current redesign slice; owner review pending
- **Date:** 2026-08-19

## ADR-016 — Use pill-shaped actions and stateful top navigation

- **Decision:** Use fully rounded pill buttons for primary and secondary actions, with documented default, hover, and active states. Use quiet top navigation links with a compact graphite surface for hover and active states.
- **Rationale:** The owner identified the rounded action treatment and compact active navigation surface as key characteristics of the preferred OCSCO.io visual language. Defining these states in the source-of-truth guide prevents inconsistent interaction styling across the public site and future platform surfaces.
- **Status:** Accepted for the redesign preparation step; owner review pending
- **Date:** 2026-08-19

## ADR-024 — Establish the CMS foundation as a relational, published-only boundary

- **Decision:** Start Phase 4 with relational tables for site settings, navigation items, pages, services, case studies, and case-study/service relationships. Use explicit `draft`, `review`, `published`, and `archived` states, with RLS policies that expose only intentionally published records to public roles.
- **Rationale:** The approved content model needs to remain independent from page components and must not leak draft or review content. A small relational foundation creates a stable backend boundary while deferring admin authentication, media, scheduling, version history, and CRM scope until they receive separate review.
- **Status:** Accepted for the Phase 4 staging foundation; migration application pending review
- **Date:** 2026-08-20

## ADR-025 — Introduce a staging-only read-only CMS auth boundary

- **Decision:** Add Supabase Auth with cookie-based SSR sessions and protect a read-only `/admin` dashboard on staging. Use the existing publishable key and published-only RLS policies; do not add CMS mutation policies yet.
- **Rationale:** The team needs a safe way to inspect the content boundary before building an editor. Separating authentication from editing allows session handling, route protection, and environment setup to be tested without prematurely deciding staff roles, draft visibility, publishing permissions, audit history, or mutation safeguards.
- **Status:** Accepted for staging review; editor and production access pending separate approval
- **Date:** 2026-08-20

## ADR-026 — Separate CMS membership roles from content mutation

- **Decision:** Establish `owner`, `editor`, and `reviewer` membership roles in a dedicated `cms_members` table, but keep all content mutation policies disabled in this slice. The first staging owner is assigned manually after reviewing the Auth user UUID.
- **Rationale:** Identity and authorization need to be testable before an editor can change public content. Separating the role map from content policies avoids granting broad write access while the team is still deciding draft visibility, review gates, publishing authority, and audit requirements.
- **Status:** Accepted for staging review; mutation policy and editor workflow pending separate approval
- **Date:** 2026-08-20

## ADR-027 — Start CMS editing with a controlled Services slice

- **Decision:** Enable a protected staging editor for service records only. Owners may create, update, publish, and archive services; editors may create and update draft or review records; reviewers remain read-only. No CMS delete action is exposed in this slice.
- **Rationale:** Services are the smallest useful editorial surface because they already power the public capability pages. A narrow first write boundary lets the team validate role checks, draft/review safeguards, and the editor experience before adding broader page, navigation, case-study, media, or publishing workflows.
- **Status:** Accepted for staging review; broader CMS editing remains pending workflow and audit review
- **Date:** 2026-08-20

## ADR-028 — Require database audit history and review-before-publish

- **Decision:** Add an immutable, database-generated audit log for every service insert/update and require published service content to pass through `review` before publication or edits. Only owners may publish or archive. Do not add version restoration or broader CMS write surfaces in this milestone.
- **Rationale:** Role checks in the editor are not sufficient evidence for a publishing workflow. Database-generated history gives reviewers a trustworthy change trail, while review-before-publish prevents silent edits to live content. Deferring restoration keeps the first audit slice small and makes rollback requirements explicit before expansion.
- **Status:** Accepted for staging review; Production and broader CMS editing remain out of scope
- **Date:** 2026-08-20

## ADR-029 — Restore audited service snapshots as Review only

- **Decision:** Allow only the staging owner to restore a selected service audit snapshot. Restoration clears publication timestamps, sets the service to `review`, requires explicit UI confirmation, and creates a new audit entry. It never publishes automatically.
- **Rationale:** Audit snapshots are useful for recovery, but automatic rollback to live content would create an unsafe publishing shortcut. A review-only restore preserves control while the team evaluates whether a dedicated version table, diffs, release notes, and bulk rollback are needed.
- **Status:** Accepted for staging review; broader version management and Production use remain out of scope
- **Date:** 2026-08-20
