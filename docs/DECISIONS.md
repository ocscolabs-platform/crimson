# Architecture Decision Log

> Current release guidance is consolidated in [`RELEASE-READINESS.md`](./RELEASE-READINESS.md). Earlier ADR entries are historical decisions; where older entries describe `/admin` or row-copy publication as the current workflow, the release-readiness baseline supersedes that wording.

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

## ADR-030 — Gate case-study editing behind privacy and media approval

- **Decision:** Keep case studies read-only in the CMS until public identity redaction, case-study audit coverage, media/alt-text rules, and featured-project behavior are explicitly implemented and reviewed. Plan for one featured project plus a supporting grid, with the initial five-record staging set preserved.
- **Rationale:** Case studies publish proof about real projects and carry higher privacy, legal, and credibility risk than service descriptions. The public mapper now protects hidden identity, while the media contract and owner review remain prerequisites for a safe write surface.
- **Status:** Accepted as the next Phase 4 design gate; no case-study mutations enabled
- **Date:** 2026-08-20

## ADR-031 - Define a validated case-study media contract

- **Decision:** Keep case-study media relative to a case-study storage path, require meaningful alt text, track media review state, and enforce at most one published featured project. Do not create upload or mutation policies in this milestone.
- **Rationale:** A predictable media boundary prevents arbitrary remote assets, inaccessible imagery, and ambiguous featured placement from entering the future editor. Database validation creates a durable safety net while the review panel remains read-only.
- **Status:** Accepted for staging design gate; migration application pending
- **Date:** 2026-08-20

## ADR-032 - Start case-study editing with an update-only owner/editor slice

- **Decision:** Enable a protected staging editor for existing case-study records only. Owners may update, approve client visibility, publish, and archive; editors may update draft/review records; reviewers remain read-only. Keep inserts, deletes, relationships, media uploads, and Production access disabled.
- **Rationale:** The team needs a real review and publication workflow, but case-study creation and media handling carry higher risk than text preparation. An update-only slice exercises RLS, review-before-publish, and audit history without opening the full portfolio surface.
- **Status:** Accepted for staging review; migration application pending

## ADR-033 - Keep CMS membership management owner-only and server-side

- **Decision:** Add a staging-only Team & Access surface where owners can invite CMS users and assign `owner`, `editor`, or `reviewer`. Perform Auth administration through a server-only Supabase admin client; never expose the Supabase secret key to browser code. Protect the last owner from downgrade.
- **Rationale:** Role assignment should not require routine access to Supabase administration, but it is itself a privileged operation. Keeping it owner-only and server-side reduces accidental privilege escalation while preserving the existing environment boundary. Account deletion, production access, and CRM permissions remain separate decisions.
- **Status:** Accepted for staging implementation
- **Date:** 2026-08-20
## ADR-034 - Keep the first global content editor update-only

- **Status:** Accepted for staging
- **Decision:** Expose existing site settings, navigation items, and page metadata through one protected `/admin/content` route. Do not add record creation/deletion, media uploads, or freeform page-section editing in this slice.
- **Reason:** These records affect the public site globally. A constrained update surface with role-aware publication safeguards gives the owner useful control without turning the first CMS milestone into an unbounded page builder.
- **Consequence:** Page body sections and section visibility/order remain an application-level contract. A separate migration and review is required before adding them.
## ADR-035 - Use a fixed page-section registry instead of a freeform builder

- **Status:** Accepted for staging
- **Decision:** Model approved top-level page sections as fixed database rows with owner-controlled visibility and order. Keep section types, markup, and content contracts in the application until each is deliberately approved.
- **Reason:** Section toggles are useful for staging composition, but a freeform builder would introduce layout, accessibility, SEO, and content-governance risk before the reusable contracts are mature.
- **Consequence:** The CMS can compose the existing public system but cannot create arbitrary sections, service-detail sections, case-study layouts, or media blocks in this milestone.

## ADR-036 - Keep case-study media private until owner approval

- **Status:** Accepted for staging
- **Decision:** Store case-study images in a private staging bucket. Owners may upload existing-record media with required alternative text and explicitly approve the media package. Public storage reads are allowed only when the attached case study is published and its media package is approved.
- **Reason:** Portfolio imagery is public proof and may contain private client information. A private-by-default bucket prevents an uploaded draft asset from becoming public merely because its path is known, while keeping the upload workflow useful for staging review.
- **Consequence:** Uploads are owner-only, replacements do not automatically delete old objects, and case-study creation, relationships, transformations, and Production media remain separate decisions.

## ADR-037 - Normalize case-study uploads to WebP

- **Status:** Accepted for staging
- **Decision:** Accept AVIF, JPEG, PNG, and WebP source files up to 2 MB, then rotate, constrain the longest edge to 2400px, and convert them to WebP quality 82 before storage. Enforce a 2 MB limit on the final object as well.
- **Reason:** A single storage format makes public delivery predictable and reduces the risk of large unoptimized portfolio assets. The final limit protects staging storage and page performance without requiring the user to prepare every image manually.
- **Consequence:** Original files are not retained by the upload workflow; replacing an image creates a new normalized WebP object, while previous stored objects remain available for later owner-reviewed cleanup.

## ADR-038 - Keep public case-study media frames dimensionally consistent

- **Status:** Accepted for staging
- **Decision:** Use fixed 16:9 display frames for featured work media and work-library cards, and fixed 4:3 frames for supporting gallery media. Preserve the uploaded composition during WebP conversion and use a non-destructive contain treatment rather than cropping source visuals.
- **Reason:** A portfolio grid should not change height based on an individual upload. Screenshots and product visuals often contain important edge content, so automatic cropping would create avoidable publication risk.
- **Consequence:** The CMS recommends 2400 × 1350 for featured media and 1600 × 1200 for supporting media. Other ratios remain valid but may appear with letterboxing inside the fixed public frame.

## ADR-039 - Set the upload request ceiling above the media file limit

- **Status:** Accepted for staging
- **Decision:** Configure Next.js Server Actions with a 3 MB request limit while keeping the application and storage source limit at 2 MB.
- **Reason:** Multipart form overhead means a request containing a valid 2 MB image must exceed 2 MB. The higher request ceiling prevents valid uploads from being rejected by the framework before application validation runs.
- **Consequence:** The application remains the source-of-truth validator at 2 MB, and the private Supabase bucket continues to enforce the final 2 MB WebP limit.

## ADR-040 - Use one hero and two supporting visual slots for case studies

- **Status:** Accepted for staging
- **Decision:** Give each case study one featured 16:9 visual and two independently replaceable 4:3 supporting visual slots. Render the supporting slots as a two-column desktop grid and a vertical mobile stack.
- **Reason:** One hero followed by one half-width supporting image leaves the case-study page visually unbalanced. Two controlled supporting slots create a clearer portfolio rhythm without hiding proof behind a carousel.
- **Consequence:** A carousel remains deferred for projects that need a true visual sequence. The CMS now exposes explicit supporting slots instead of an unbounded append-only gallery.

## ADR-041 - Make media removal explicit and owner-confirmed

- **Status:** Accepted for staging
- **Decision:** Add a trash action to each configured media preview. Only the owner can remove media, only Review records can be changed, and the UI requires confirmation before removing a featured or supporting asset.
- **Reason:** Upload and replacement without removal creates clutter and makes mistakes difficult to correct. A visible, confirmed removal action gives the media package a complete lifecycle without opening case-study deletion.
- **Consequence:** The case-study row is updated first so the audit trigger records the change; the private storage object is then removed. If storage cleanup fails, the record remains correct and the CMS reports that cleanup is still needed.

## ADR-042 - Use a neutral presentation surface for light case-study media

- **Status:** Accepted for staging
- **Decision:** Give public featured and supporting case-study images consistent rounded corners and a subtle neutral light frame. Keep the source pixels unchanged and do not apply a global contrast or color filter.
- **Reason:** Client screenshots are evidence and often use light backgrounds. A dark `object-fit: contain` matte creates visible dark edging around rounded or anti-aliased image boundaries, while a contrast filter would alter the fidelity of the client work. A restrained light surface separates the image from the page without changing its content.
- **Consequence:** Featured media uses the same 16:9 frame with a 12px radius as supporting media's 4:3 frame. Work-card images inherit the card's existing clipping so the library does not acquire a double border.

## ADR-043 - Use progressive visual previews on the Work library

- **Status:** Accepted for staging
- **Decision:** Apply one shared hover/focus treatment to all Work library cards. Cards with multiple approved visuals may crossfade through their available views and show a small view count; cards with one or no visual retain the same elevation and focus treatment without simulating a gallery. On touch layouts, cards remain tap-first and do not require hover to understand the interaction.
- **Reason:** The Work page should reward exploration consistently across projects, not only for Cairnstack. A restrained preview adds proof density without turning every card into a full carousel or hiding the primary navigation action.
- **Consequence:** The effect is limited to approved media already returned by the public CMS mapper, uses reduced-motion support, and introduces no database or storage changes.

## ADR-044 - Render published case-study relationships on the public detail route

- **Status:** Accepted for staging
- **Decision:** Render each published case study's linked, published capabilities on its public detail route as a compact list of links to the corresponding service pages. Do not render an empty relationship section, and do not expose links when either side of the relationship is unpublished.
- **Reason:** A relationship field is only useful to visitors when it explains the capabilities behind a project and creates a clear path into the service library. Keeping the read path published-only preserves the existing privacy boundary and avoids exposing editorial or unpublished content.
- **Consequence:** The public mapper performs a published-only relationship read and the detail page owns the presentation. No new CMS write controls, CRM relationship model, or production policy is introduced.

## ADR-045 - Use disclosure groups and contextual action hierarchy in the admin CMS

- **Status:** Accepted for staging
- **Decision:** Structure long admin editing surfaces around native, keyboard-accessible disclosure groups. Use a responsive two-level layout for navigation rows, reserve the green primary treatment for commit/publish actions, and use a neutral secondary treatment for repeated row-level updates.
- **Reason:** The first global-content editor was functionally safe but visually dense: navigation fields were compressed into a fragile five-column grid, repeated green buttons weakened action hierarchy, and page metadata created unnecessary scroll. Native disclosure controls reduce cognitive load without introducing a page-builder abstraction, while contextual action colors make the consequence of each action easier to understand.
- **Consequence:** `/admin/content` gains collapsible global sections, collapsed page metadata records, a sticky section jump bar, and clearer responsive field grouping. The change is presentation-only and does not change CMS roles, RLS, server actions, or the production boundary.

## ADR-046 - Use shared responsive controls for admin editing surfaces

- **Status:** Accepted for staging
- **Decision:** Keep admin select controls on one shared component with a consistent icon cue, give jump navigation deliberate internal spacing, and move global-content rows to a stacked field layout before tablet widths make four controls compete for space.
- **Reason:** A literal text glyph is inconsistent across fonts and can look like a stray character or misaligned chevron. The previous breakpoint allowed four fields to remain compressed at intermediate widths, creating the perception of overlap and making the editor harder to scan.
- **Consequence:** The follow-up is presentation-only. It changes no form names, server actions, role checks, RLS policies, content values, or production routes.

## ADR-047 - Reserve primary media actions for additions and approval

- **Status:** Accepted for staging
- **Decision:** Use the primary green treatment for new media uploads and media-package approval. Use the neutral secondary treatment for replacing an existing supporting visual.
- **Reason:** Replacement is a maintenance action, not a new editorial milestone. Giving it the same visual weight as approval makes the action hierarchy ambiguous and increases the chance of an accidental destructive-looking operation.
- **Consequence:** The media workflow remains functionally unchanged; only the visual treatment of the supporting-media replacement action changes.

## ADR-048 - Force admin controls to honor their grid tracks

- **Status:** Accepted for staging
- **Decision:** Shared admin inputs and select wrappers use `min-width: 0` and `width: 100%` so intrinsic control sizing cannot overflow a responsive grid column.
- **Reason:** Number inputs can retain a browser-defined intrinsic minimum width. In the global-content navigation editor, that caused Sort order to extend into Visibility at wide desktop widths even though the grid itself had a defined gap. Fixing the shared control primitive prevents the same collision across CMS forms.
- **Consequence:** Existing field names, server actions, permissions, and stored values remain unchanged; the correction only prevents visual overflow in responsive admin grids.

## ADR-049 - Use compact, shared admin interaction patterns

- **Status:** Accepted for staging
- **Decision:** Standardize the signed-in account cluster across CMS routes, use compact bordered pagination controls, keep accordion status and chevrons on one horizontal line, and place media approval in a separated action row.
- **Reason:** The admin UI is an operational tool, so hierarchy and scanability matter more than oversized presentation. Repeated account controls, audit navigation, disclosure states, and high-impact media approval actions need predictable placement and spacing across screens.
- **Consequence:** This is a presentation and navigation refinement only. It adds no new permissions, data fields, storage behavior, or public-route changes.

## ADR-050 - Align admin audit surfaces to the shell width

- **Status:** Accepted for staging
- **Decision:** Let audit rows and pagination span the full admin shell width, and reserve a deliberate spacing band before the admin footer.
- **Reason:** A narrower audit column beside a full-width footer creates an arbitrary visual stop. Consistent left and right edges, followed by clear footer separation, improve scanability and make the page feel intentionally composed.
- **Consequence:** This is a layout-only refinement. Audit data, pagination behavior, permissions, and production routes remain unchanged.

## ADR-051 - Keep admin presentation copy deployment-neutral

- **Status:** Accepted for Production and staging
- **Decision:** Use neutral CMS language in the shared admin interface instead of hard-coding “staging” into visible headings, feedback, and navigation copy. Environment-specific deployment, authentication, and data-boundary rules remain documented and configured outside the presentation copy.
- **Reason:** The same application build can be reviewed through Preview and deployed to Production. Staging-only wording on the Production login and dashboard is misleading and makes a correct deployment look like the wrong environment.
- **Consequence:** Admin copy describes the CMS and role-controlled access consistently in every environment; environment separation remains enforced by deployment configuration, Supabase projects, RLS, and release process rather than by labels alone.

## ADR-052 - Promote approved CMS content through a guarded server-side release runner

- **Status:** Accepted for the Production publication boundary
- **Decision:** Keep editorial mutation in the staging CMS and promote only the owner-approved published content package to Production through the guarded `scripts/cms-promote.mjs` runner. Run it through the protected GitHub `production-cms` environment; use dry-run as the default and require an explicit apply confirmation.
- **Reason:** A Git merge cannot move Supabase rows, Storage objects, or environment-specific IDs. Putting a Production service key in the staging browser would violate the security boundary. A server-side release runner keeps credentials separate, makes the package reviewable, and avoids manual record copying.
- **Consequence:** Production receives public CMS data and approved media without receiving staging users, inquiries, audit history, or credentials. Production CMS administration remains a separate future milestone; the current operator workflow is staging edit → owner approval → guarded promotion.

## ADR-053 - Keep Production CMS editing explicitly staging-only

- **Status:** Accepted for the first Production publication boundary
- **Decision:** Redirect `/admin` requests on the Vercel Production environment to the public site. The CMS editor remains available only on Preview/Staging deployments connected to the staging Supabase project.
- **Reason:** Production Auth users and editor policies are not provisioned, so a Production login would create a confusing failure and invite unsafe credential duplication. Publishing approved content does not require Production editing.
- **Consequence:** The public Production site can consume promoted CMS records while editorial work stays in staging. A future Production editor requires a separately approved Auth, role, audit, and rollback design.

## ADR-054 - Replace row-copy promotion with revision-based CMS publishing

- **Status:** Accepted for staging implementation; Production rollout pending migration and QA
- **Decision:** Keep `feature/* → staging → main` for application code, but move CMS publication to an explicit revision workflow. Draft and review revisions remain private; an owner-only atomic publish operation makes a reviewed revision public. The canonical authenticated CMS entry point is `/crimson-admin-control`; Preview uses the same canonical path, while direct `/admin` requests return `404`. The current staging-to-Production row-copy runner is temporary migration infrastructure, not the permanent editorial workflow.
- **Rationale:** Git merges do not move Supabase rows or Storage objects. The previous design made the owner perform two unrelated release operations and edited live-shaped records in place. A revision boundary gives the CMS a coherent source of truth, preserves the public version while work is being prepared, and makes the user-visible action match its actual effect.
- **Consequence:** A revision schema, publish/restore functions, Production Auth/RLS coverage, and updated admin reads/writes are required. The existing `production-cms` workflow and service-role secrets must remain until the new path is verified, then be removed as obsolete infrastructure.

## ADR-055 - Use a non-obvious canonical CMS path

- **Status:** Accepted for Production and staging
- **Decision:** Use `/crimson-admin-control` as the only public CMS entry point. Direct `/admin` and `/admin/*` requests return `404`. Route protection, Supabase Auth, CMS membership, and RLS remain the actual security controls.
- **Reason:** A less obvious path reduces casual discovery and avoids presenting the CMS as a generic `/admin` endpoint. The path is not treated as a security boundary.
- **Consequence:** Vercel/Supabase Auth reset URLs must use `/crimson-admin-control/auth/callback?next=/crimson-admin-control/reset-password`. The callback exchanges the one-time recovery code server-side before the reset form loads. Internal route rewrites continue to use the existing App Router implementation, and no data, role, or credential changes are introduced.

## ADR-056 - Add Insights after structured page-content editing

- **Date:** 2026-08-22
- **Status:** Owner-approved for roadmap planning; implementation not started
- **Decision:** Add a first-party Insights system as Phase 6, after Phase 5 completes full structured body-content editing for Home, About, Services, and Contact. Use `Insights` as the navigation label, `/insights` and `/insights/[slug]` as the public routes, and `Insights / Articles` as the CMS area.
- **Reason:** Insights publishing depends on the CMS's content, revision, media, SEO, preview, and public published-only boundaries. Building it before the page-content editor and Phase 4 release stabilization would repeat the current pattern of adding editorial features on top of an unresolved release contract.
- **Scope:** Articles, categories, tags, article-to-tag relationships, authors, publication status/dates, featured/social media, SEO metadata, article editor, preview, public index, search/filtering, pagination/load-more, empty states, article detail, and related articles.
- **Constraints:** Reuse the existing Supabase/Auth/RLS/revision/audit/media architecture. Do not add a third-party CMS, freeform page builder, or copied Cairnstack design. Draft and Review content must remain private.
- **Consequence:** Insights migrations, routes, CMS controls, and nav placement remain intentionally absent until Phase 6. The Master Plan and Content Model now record the scope and dependencies. CRM remains a separate Phase 7 capability.

## ADR-057 - Treat the staging-to-main merge as complete and stabilize the Production baseline

- **Date:** 2026-08-22
- **Status:** Accepted for roadmap reconciliation; Production release gate deferred by ADR-059
- **Decision:** Treat the prior staging-to-main merge as a repository-history fact and record the latest live remote comparison. `origin/main` is `f098902f04cd25483c24bbc7f467d1023f1b7a79`, `origin/staging` is `b78976c16a1f88c73b32211ada42ae8d58aafb41`, and `git rev-list --left-right --count origin/main...origin/staging` returns `3 1`; the branches are divergent. The remediation branch is based on the latest `origin/main` and must be merged into `staging` through a normal pull request before staging verification. Phase 4C staging baseline and QA are complete; the Production release/promotion verification remains a deferred gate tracked by ADR-059.
- **Reason:** The previous pre-merge wording no longer describes the repository. Git promotion has happened, but a Git merge does not prove that Production Supabase migrations, runtime variables, Auth callbacks, RLS, Storage, or revision publication are configured correctly.
- **Consequence:** Production is verified independently, temporary promotion infrastructure is retired only after the revision path is proven, and `staging` is synchronized to the approved `main` baseline before Production CMS/schema promotion. Phase 5 development and QA may proceed in the isolated staging environment.

## ADR-058 - Use a dedicated implicit callback for administrator invitations

- **Date:** 2026-08-22
- **Status:** Accepted for Phase 4C remediation; staging verification pending
- **Decision:** Keep the normal CMS browser client PKCE-based for login and password recovery, but use a dedicated implicit-flow client for administrator invitation acceptance at `/crimson-admin-control/invite`. The invite page explicitly consumes the invitation fragment, establishes the session, removes the fragment from browser history, and only then allows account setup and membership activation.
- **Reason:** Supabase administrator invitations are created in one browser context and accepted in another. The callback therefore returns an implicit session fragment; the previous PKCE client rejected it as an invalid/expired PKCE flow on first click.
- **Consequence:** Public signup remains disabled and owner invitations remain server-side. If membership assignment fails after Auth invite creation, the server performs compensating Auth-user cleanup and returns a recoverable error. No Production invitation test is permitted until a fresh staging first-click test passes.

## ADR-059 - Close staging Phase 4C QA separately from the Production release gate

- **Date:** 2026-08-23
- **Status:** Owner-approved
- **Decision:** Mark the `crimson-staging` Phase 4C baseline and QA complete after the owner-verified clean rebuild, migration parity, architecture checks, CMS workflow matrix, media lifecycle, inquiry persistence, route protection, metadata isolation, and runtime health pass. Track Production schema/configuration/Auth/promotion verification as a deferred release gate rather than blocking Phase 5 development and QA in staging.
- **Reason:** The staging and Production environments are intentionally separate, and Phase 5 depends on the accepted CMS foundation and staging QA rather than on an already-promoted Production CMS. Production verification remains mandatory before Production CMS/schema promotion, but it is an operational release dependency rather than a prerequisite for continued isolated staging development.
- **Consequence:** Phase 5 is ready to plan against the accepted staging baseline. The Production release gate preserves the requirements for Production migration dry-run/apply approval, schema/configuration/Auth verification, Production smoke testing, rollback/sign-off, staging synchronization, and the temporary promotion-bridge decision.

## ADR-060 - Make revision RPCs PageDocument-compatible before cutover

- **Date:** 2026-08-23
- **Status:** Implemented in Phase 5B Slice 2; staging application pending owner review
- **Decision:** Extend the existing revision RPCs narrowly so complete PageDocuments for Home, Services, About, and Contact are validated at the database/RPC boundary, use `cms_revisions.status` as the only workflow authority, replace PageDocument content atomically, derive legacy SEO projections during future publication, validate published Service references, and restore PageDocument history as Review. Keep legacy array-valued pages, `page_sections`, Services, case studies, Work, public reads, and the current CMS editor behavior unchanged until later cutover slices.
- **Reason:** Application validation alone cannot protect direct RPC calls. The future PageDocument contract needs an authoritative mutation boundary without forcing legacy historical revisions or current page rows through an unfinished Phase 5 model.
- **Consequence:** The new migration is forward-only and data-free. It creates no PageDocument rows, does not backfill or convert page content, does not publish `page_sections`, and does not change Production. Owner review and a separate staging migration application remain required before Slice 2 is considered deployed.

## ADR-062 - Establish the Phase 6A Insights foundation as a separate security boundary

- **Date:** 2026-08-26
- **Status:** Implemented on the Batch 6A feature branch; staging application and merge pending Owner review
- **Decision:** Extend the existing `cms_members` architecture with `cms_member_access`, keeping Owner, Editor, and Trusted Publisher terminology. Trusted Publisher is an Editor with the narrow `can_publish_insights` capability and an ownership-checked article publish RPC. Add separate Insights article/revision, Category, Tag, audit, and Published-only projection foundations; keep existing `cms_has_role` callers full-CMS-only so Insights-only members cannot inherit legacy administration.
- **Reason:** The current CMS role is intentionally broad for Phase 5. A separate access scope is required to expose an Insights publishing surface without granting Pages, Global Content, Services, Work, Team, CRM, or other unrelated authority. Article-specific revisions preserve independent workflow and historical recovery boundaries.
- **Consequence:** Batch 6A adds one forward migration after migration #26, route-level denial for Insights-only members, direct security-contract tests, and a later staging verification script. It does not add media buckets, Tiptap, autosave, public Insights routes, Production changes, or Batch 6B work.

## ADR-061 - Align PageDocument validation with the approved About and Contact contract

- **Date:** 2026-08-23
- **Status:** Accepted for Phase 5B Slice 3 preparation
- **Decision:** Persist `about_people` with exactly `eyebrow`, `heading`, and `cta`; it has no `body` field. Persist Contact process items with exactly `title` and `body`. Numbering and prefixes such as `01 /` remain code-controlled presentation and are rejected as unknown PageDocument fields.
- **Reason:** The approved Phase 5A contract intentionally preserves the existing About placeholder without inventing body copy and keeps Contact numbering in the renderer. The Slice 1 application validator and Slice 2 database helper incorrectly required `about_people.body`; the correction restores one shared strict contract before any PageDocument backfill.
- **Consequence:** A forward, data-free validator correction is required before Slice 3. Save, publish, restore, authorization, legacy arrays, `page_sections`, Work, and all current page data remain unchanged. No PageDocument backfill is included in this decision.

## ADR-063 - Keep Batch 6B2 authoring reliable without opening media or public Insights

- **Date:** 2026-08-26
- **Status:** Implemented on the Batch 6B2 feature branch; staging review pending
- **Decision:** Extend the existing Insights Draft save action with a client-side coordinator that debounces Draft autosave, serializes explicit saves, preserves local state on stale conflicts, and protects navigation while changes are unconfirmed. Add a private, no-store, noindex Preview that loads only the authorized active Draft/Review revision through the shared Insights renderer. Add an Owner Needs Review queue and Review-state workflow controls using the existing Batch 6A RPCs. Do not create a migration, media path, public Insights route, or alternate article renderer.
- **Reason:** The text-only authoring foundation needs a reliable review loop before media and public publication artifacts are introduced. Keeping all writes on the existing Server Action/RPC boundaries preserves authorization, optimistic concurrency, and the future B6B3 Cover-media publication gate.
- **Consequence:** B6B2 remains a staging-only editorial reliability slice. Text-only Submit/Publish behavior is explicitly foundation QA behavior; media validation and the final public artifact contract remain deferred to B6B3. No Production or `main` changes are permitted.

## ADR-064 - Keep Insights canonical media private and publish exact revision artifacts

- **Date:** 2026-08-28
- **Status:** Proposed for staging review in Batch 6B3; not applied to staging or Production
- **Decision:** Add an Insights-specific media boundary with private canonical WebP objects and a separate private published-artifact bucket. Store opaque media IDs in the v2 body contract; resolve private signed URLs only for authenticated CMS authoring and Preview. On Publish, copy only the active revision's Cover and referenced inline media to deterministic public artifacts, sanitize the public body to artifact paths, and delete those artifacts on Unpublish while retaining canonical objects and revision history. All Storage writes remain server-trusted and all editorial mutations remain authorization-checked RPCs.
- **Reason:** Editorial media must survive Draft editing, Review, Unpublish, and Restore without exposing source paths or signed URLs. A separate artifact boundary prevents a future public projection from accidentally serving Draft or historical canonical files.
- **Consequence:** Migration #30 is additive after migrations 1-29. The editor supports JPEG, PNG, WebP, and AVIF source validation, server-side normalization, Cover/inline replacement and removal, meaningful alt text, and exact publication cleanup semantics. Public `/insights` routes remain deferred to Phase 7; staging application and Owner QA are required before this decision is considered deployed.

## ADR-065 - Restore Insights media by cloning revision metadata

- **Date:** 2026-08-27
- **Status:** Proposed for staging review in Batch 6B3 restore hotfix; not applied to staging or Production
- **Decision:** Restore a historical Insights revision into a new Draft with fresh media metadata IDs and new revision ownership. Reuse the immutable private canonical object path only after cloning its metadata, copy the source Cover and inline role associations, rewrite body `mediaId` references, and strip any resolved `src` values. Do not mutate historical media/revision rows or copy public artifact fields; validate the complete restored Draft with `insights_revision_is_publishable` before changing the article pointer.
- **Reason:** The original Restore RPC copied revision links to historical media rows without changing their revision ownership, so required media validation rejected the restored Draft. A metadata clone preserves historical evidence while giving the new Draft an independently editable media boundary. Private canonical objects are lifecycle-safe to share because media removal changes metadata state and public artifact cleanup is separate.
- **Consequence:** Migration #31 is a forward-only staging change. Restore is transactional and fail-closed for missing, removed, cross-revision, or otherwise invalid media. The source revision remains unchanged, restored media starts without public artifacts, and no Production or `main` change is permitted until the dedicated staging PR and Owner QA gates pass.

## ADR-066 - Automatically apply canonical migrations on protected staging pushes

- **Date:** 2026-08-27
- **Status:** Proposed for staging review; Production behavior unchanged
- **Decision:** Make `.github/workflows/supabase-release.yml` apply all pending canonical migrations on a protected push to `staging` after validation and a dry run. Before linking, verify the configured project identity is `crimson-staging`; after applying, compare the ordered repository migration timestamps with the staging `supabase_migrations.schema_migrations` ledger and require exact parity with zero duplicates and zero pending versions. Keep Production dry-run-only on `main` pushes and separately gated behind manual dispatch plus the protected Production environment.
- **Reason:** The former staging push path stopped after dry-run, while the manual dispatch path was not available from the repository's default `main` branch. That left a protected merge able to introduce a canonical migration without a normal staging application path.
- **Consequence:** Future migration-bearing merges to `staging` use one repeatable, idempotent, staging-only release path that supports multiple pending migrations in canonical order and fails closed on target mismatch or ledger drift. The workflow correction is included in its own staging trigger so it can recover the current pending migration without a manual SQL workaround. No account-specific project ref, credential, Production connection, or `main` change is added to the repository.

## ADR-067 - Resolve the staging parity connection over IPv4 at runtime

- **Date:** 2026-08-27
- **Status:** Proposed for staging review; migration application and Production behavior unchanged
- **Decision:** Keep the existing approved direct `db.<project-ref>.supabase.co` staging connection for the read-only parity query, but resolve an IPv4 address at runtime with `getent ahostsv4` and provide it as `PGHOSTADDR`. Fail closed when no IPv4 address is available. Do not add a pooler URL or new credential until the current project configuration explicitly provides and authorizes one.
- **Reason:** The merged staging pipeline applied migration #31 successfully through the Supabase CLI, but the GitHub-hosted runner could not route to the direct database hostname’s IPv6 address during the post-apply `psql` parity check. The current authorized GitHub Environment exposes the access token, database password, and project ref, but no current pooler endpoint.
- **Consequence:** The parity query uses the same staging project and password without changing migration semantics, weakening parity, modifying the ledger, or exposing credentials. Future no-pending staging pushes exercise the same idempotent apply and exact parity gate. Production remains in its separate dry-run/manual-approval path, and `main` is untouched.
