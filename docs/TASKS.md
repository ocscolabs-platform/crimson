# Staging Task Queue

This queue records approved next-step work before implementation. Tasks in this file are not production changes until they are implemented, reviewed in staging, and explicitly promoted to `main`.

## Current roadmap overlay — 2026-08-24

`docs/MASTER-PLAN.md` is now the canonical source of truth for phase order and release readiness. The detailed `PH4-001` through `PH4-016` entries below preserve the implementation history and acceptance criteria of the original CMS slices; some early entries retain their historical “pending” wording even though later entries document the verified staging implementation. Use the master plan and `STATUS.md` for the current state.

Owner approval closes the staging portion of **PH4-017 — Post-merge release verification and baseline stabilization**. The clean `crimson-staging` rebuild and Phase 4C QA evidence are complete. The Production boundary, promotion, and baseline checks remain a deferred release gate. Full Page Content CMS is Phase 5, Insights is Phase 6, CRM is Phase 7, and hardening/reusable-platform work is Phase 8.

## PH4-018 — Remediate the administrator invitation callback

- **Status:** In progress / staging verification required
- **Goal:** Make the owner-controlled Supabase administrator invitation flow establish a valid session and activate the assigned CMS membership without relying on public signup or the normal PKCE client.
- **Scope:** `/crimson-admin-control/invite`, invitation callback/session exchange, membership activation, recoverable Auth-user cleanup, and invitation error handling only.
- **Root cause:** `inviteUserByEmail` accepts the invitation in a different browser context and returns an implicit callback session in the URL fragment. The previous invite page used the normal PKCE browser client and rejected that fragment before a session could be established.
- **Acceptance criteria:** A fresh staging invitation succeeds on its first click; the invite page establishes the callback session before account setup and never logs tokens; the assigned CMS membership is created with the requested role; membership failure is recoverable without an unintended usable CMS account; existing login, recovery, logout, role authorization, public-signup-disabled behavior, and `/admin` 404 behavior remain unchanged; no Production invitation is sent until staging passes and the owner approves the next controlled Production test.

## PH4-017 — Verify the post-merge CMS release boundary

- **Status:** Staging baseline and QA complete; Production release gate deferred
- **Goal:** Record the completed staging baseline while preserving the owner-controlled Production verification and promotion requirements.
- **Reference:** `docs/MASTER-PLAN.md` and `docs/RELEASE-READINESS.md`

### Acceptance criteria

- Staging and Production migrations, grants, RLS policies, triggers, RPCs, and Storage policies are inventoried and verified.
- Auth Site URLs, redirect allow-lists, invitation links, password recovery callbacks, and canonical CMS routing pass in each intended environment.
- The full CMS role and publication matrix passes: login/logout, save, review, publish, restore, media lifecycle, relationships, audit pagination, public published-only reads, and `/admin` 404 behavior.
- Vercel environment variables are mapped correctly without committing secrets or local environment files.
- `npm run lint`, `npm run build`, and explicit type validation pass with the intended Node runtime.
- Branch protection and Production approval rules are active.
- The temporary row-copy promotion bridge is either retained with an owner-approved runbook or retired only after revision publishing is verified in Production.
- Production deployment, configuration, Auth, database, revision publishing, public reads, CMS protection, media, relationships, and inquiry behavior are verified.
- `/crimson-admin-control` remains protected and `/admin` plus `/admin/*` return normal `404` responses.
- The temporary promotion bridge is retired or retained with an explicit owner-approved runbook and rollback path.
- Remote `staging` is synchronized to the approved `main` baseline.
- The staging baseline acceptance is recorded; Production owner sign-off, verified commit/configuration baseline, and rollback steps remain required before Production CMS/schema promotion.

## PH5-001 — Complete the Full Page Content CMS

- **Status:** Owner-approved remaining roadmap; implementation not started
- **Goal:** Make Home, About, Services, and Contact body content editable through approved structured PageDocument CMS sections.
- **Constraint:** Do not introduce a freeform page builder, arbitrary component creation, Work migration, Insights, CRM, or Production controls.

The public PageDocument architecture is complete for Home, Services, About, and Contact, and Work remains legacy. Phase 5 remains open because authorized non-technical editors cannot yet manage the authoritative PageDocument content through Crimson CMS. The remaining scope is exactly the two descriptive work packages below; neither is a historical Slice 4G.

### Work Package A — PageDocument Editor and Editorial Workflow

**Objective:** Build the reusable Crimson CMS editorial experience for the four approved Phase 5 pages.

**Scope:**

- Shared PageDocument page-management shell.
- Home editor, Services overview PageDocument editor, About editor, and Contact marketing-content editor.
- Page-specific structured field forms for approved Hero and section content.
- Constrained CTA controls, section order, and allowed visibility controls.
- Authoritative PageDocument SEO title, SEO description, and approved Open Graph reference control.
- Home Service-reference controls and Services wrapper controls without duplicating canonical `public.services` records.
- Draft save/update, Review workflow, owner-only Publish, owner-only Restore, role-aware controls, revision/audit status, validation UX, and authenticated Draft/Review Preview.
- Protection of all code-controlled functionality.

**Explicit exclusions:** Work migration; freeform page builder; arbitrary sections, components, or routes; Contact form-builder behavior; Service-record duplication; scheduled publishing; version comparison; bulk editing; Insights; CRM; and Production.

### Work Package B — Full Page Content CMS Staging QA, Owner Front-End Polish, and Phase 5 Closure

**Objective:** After Work Package A is implemented and staging-verified, perform end-to-end editor acceptance, public staging QA, owner/client-style visual refinement, and formal Phase 5 closure.

**Editorial acceptance:** Test owner, editor, and reviewer boundaries where applicable. A non-technical authorized user must be able to open each page, edit structured content and CTAs, manage approved order/visibility, edit SEO, save Draft, move through Review, use authenticated Preview, Publish, verify public output, inspect revision/audit state, Restore, and receive understandable validation/error feedback without SQL Editor, Supabase dashboard, GitHub, repository edits, Codex intervention, or manual database changes.

**Final QA:** Verify Home, Services, About, and Contact for CMS usability, Draft/Review/Publish/Restore, Preview, PageDocument SEO, CTA and section constraints, validation UX, role boundaries, public Published-only behavior, responsive and accessibility sanity, browser/runtime health, public visual regression, Service-reference integrity, Contact functional-boundary integrity, Work isolation, migration alignment, staging architecture verification, and audit/revision preservation. Use the Codex browser device toolbar at 1440×900, 768×1024, and 390×844.

**Owner Front-End Polish checkpoint:** During staging acceptance, classify every observation as:

- **FIX NOW** — implementation bug, regression, broken responsive behavior, accessibility defect, or mismatch against the approved design.
- **POLISH WINDOW** — small visual or UX adjustment with no architecture, schema, product-behavior, or workflow change.
- **NEW SCOPE** — new feature, component type, CMS capability, workflow, database behavior, integration, or functional requirement; requires separate owner approval and must not silently expand Phase 5.
- **DEFER** — useful enhancement not required for Phase 5 acceptance.

Only FIX NOW and approved POLISH WINDOW items belong in Work Package B.

**Phase 5 closure gate:** Phase 5 may close only when an authorized non-technical editor can manage Home, Services overview, About, and Contact through Crimson CMS with authoritative PageDocument editing, SEO editing, usable Draft/Review/Publish/Preview/validation flows, and enforced role boundaries. Work remains legacy. ContactForm behavior remains code-controlled, and canonical Service records remain separately managed through the existing Services CMS.

## PH6-001 — Add the Insights data model

- **Status:** Planned / not started
- **Goal:** Add articles, categories, tags, article-to-tag relationships, authors, publication state/dates, SEO metadata, and revision/media references using the existing CMS architecture.
- **Acceptance criteria:** Stable slugs, unique category/tag relationships, author ownership rules, draft/review/published boundary, published-only public reads, and RLS/audit coverage.

## PH6-002 — Add the Insights CMS editor

- **Status:** Planned / not started
- **Goal:** Let authorized users create/edit articles, save drafts, assign category/tags/author, manage featured/social media, edit content, manage SEO fields, preview, publish, and unpublish through the existing revision workflow.
- **Constraint:** No separate third-party CMS without a new approved architecture decision.

## PH6-003 — Add the public Insights index

- **Status:** Planned / not started
- **Goal:** Provide the `/insights` listing with published articles, optional featured article, categories, tags, search, filtering, pagination or load-more, responsive states, and empty/error states.
- **Constraint:** Cairnstack is a structural reference only; do not copy its visual design or implementation.

## PH6-004 — Add article detail and SEO output

- **Status:** Planned / not started
- **Goal:** Provide `/insights/[slug]` with title, excerpt, featured image, author, dates, category, tags, formatted content, SEO metadata, Open Graph image, related articles, accessible media, and draft privacy.

## PH6-005 — Insights QA and release gate

- **Status:** Planned / not started
- **Goal:** Verify editor permissions, revisions, preview, slug conflicts, media constraints, public published-only behavior, search/filter/pagination, responsive/accessibility behavior, SEO output, and deployment configuration before publication.

## PH7-001 — Define and build CRM foundation

- **Status:** Planned / not started
- **Goal:** Finalize and implement the approved CRM model for inquiries, contacts, companies, opportunities, activities, pipeline stages, ownership, audit, and notifications.
- **Constraint:** The current inquiry intake is not a complete CRM. CMS and CRM roles/permissions must remain separate.

## STG-001 — Add a contact form workflow after capability exploration

- **Status:** Complete; promoted to `main` and verified in Production
- **Related experience:** Homepage `Explore the capabilities` CTA and `/services`
- **Goal:** Give visitors a clear path from reviewing OCSCO capabilities to starting a qualified conversation through the approved contact workflow.
- **UX rule:** Keep `Explore the capabilities` as a discovery link to `/services`. Do not turn it into a form-submission action. Add the form on `/contact` and/or introduce a contextual `Discuss this capability` action after a visitor has explored a capability.

### Acceptance criteria

- The form submits validated inquiries to `public.inquiries` and sends an owner notification through the environment-specific server-side provider; staging and Production delivery are verified.
- The final field list, required fields, privacy copy, validation, error state, success state, and confirmation behavior are approved.
- The form works with keyboard navigation, visible focus, readable labels, mobile layouts, and accessible error messaging.
- Capability context can be carried into the inquiry when a visitor arrives from a service or capability CTA.
- The form is tested in staging without adding credentials, tokens, or production integrations to the repository. **Complete for the current UI and server slice.**
- Production promotion, controlled delivery test, and DNS cutover are complete.

### Dependencies

- Confirm whether submissions should use an approved email workflow first or a future Supabase-backed inquiry record.
- Confirm the response time expectation and who owns follow-up.
- Approve the contact form content and privacy/consent requirements.

## STG-002 — Close Phase 3 launch readiness

- **Status:** Technical release complete; owner content and accessibility follow-up pending
- **Goal:** Establish a repeatable release gate for promoting the reviewed public website and contact workflow to Production.
- **Reference:** `docs/LAUNCH-READINESS.md`

### Acceptance criteria

- All public routes, style-guide paths, supplied brand assets, and favicon paths pass smoke checks.
- Lint and production build pass from the staging branch.
- Owner approves final copy, proof placeholders, portfolio/team assets, form language, privacy/consent copy, and response ownership.
- Production Supabase and Resend resources are separate from staging and configured through Vercel only.
- A controlled Production smoke test verifies route navigation, inquiry storage, owner notification, and the Vercel custom domain.

## PH4-001 — Establish the custom CMS foundation

- **Status:** In progress on `feature/phase-4-cms-foundation`
- **Goal:** Create the reviewed data and publishing boundary for the future custom CMS without exposing an admin application or draft content.
- **Reference:** `docs/PHASE-4-CMS-FOUNDATION.md`

### Acceptance criteria

- The CMS foundation migration applies cleanly to the dedicated staging Supabase project.
- RLS is enabled on every CMS table.
- Public roles can read only visible navigation, default site settings, and published records.
- Public roles cannot insert, update, or delete CMS records.
- The owner approved the Services slice; the five approved staging records are seeded only through the explicit staging seed script.
- A server-side Next.js read boundary is implemented and validated for one public route before broader migration.

## PH4-002 — Add the controlled staging Services editor

- **Status:** Implementation complete locally; staging migration and live QA pending
- **Goal:** Validate the first role-aware CMS write workflow without enabling broad CMS mutations or production administration.
- **Reference:** `docs/PHASE-4-CMS-EDITOR.md`

### Acceptance criteria

- The editor is available only behind the protected `/crimson-admin-control` boundary; direct `/admin` requests return `404`.
- Owners can update service content and manage `draft`, `review`, `published`, and `archived` status values.
- Editors can update service content only while keeping records in `draft` or `review`.
- Reviewers can inspect the dashboard but cannot save service changes.
- No delete action or service-editor public link is exposed.
- The staging policy migration applies cleanly and one non-sensitive owner update is verified on the staging public service route.
- Production receives no staging migration, credentials, content, or editor deployment until a separate promotion decision.

## PH4-003 — Add CMS audit history and publishing safeguards

- **Status:** Implementation complete locally; staging migration and workflow QA pending
- **Goal:** Establish trustworthy change history and prevent silent edits or uncontrolled publication of service content.
- **Reference:** `docs/PHASE-4-CMS-AUDIT.md`

### Acceptance criteria

- Every staging service insert/update creates an immutable database audit entry.
- Owners alone can publish or archive service records.
- Published service content must move through Review before edits or republishing.
- The protected editor displays recent audit history without exposing audit mutation controls.
- Audit rows include the actor, action, status transition, timestamp, and before/after snapshots.
- The audit migration is applied and verified only in `crimson-staging`.
- Version restoration and broader CMS editing remain deferred until the workflow is reviewed.

## PH4-004 — Add controlled service version restoration

- **Status:** Implementation complete locally; staging workflow QA pending
- **Goal:** Provide a safe recovery path from immutable service audit snapshots without creating an automatic republish shortcut.
- **Reference:** `docs/PHASE-4-CMS-VERSIONS.md`

### Acceptance criteria

- Only the staging owner can see and trigger restore actions.
- Restore requires explicit confirmation in the editor UI.
- A restored snapshot is always saved as `review` with publication timestamps cleared.
- The restore action creates a new audit entry.
- Editors and reviewers remain read-only for restoration.
- Production receives no restore route or CMS migration until the staging workflow and future versioning requirements are approved.

## PH4-005 — Design the case-study CMS workflow

- **Status:** Privacy-safe renderer implemented; remaining design gates open; case-study mutations intentionally disabled
- **Goal:** Prepare a safe portfolio editorial workflow for approved project proof without exposing private client details, unsupported claims, or unapproved media.
- **Reference:** `docs/PHASE-4-CMS-CASE-STUDIES.md`

### Acceptance criteria

- The initial layout is defined as one featured project plus a supporting grid; the current five-record staging set remains supported.
- `client_visibility` is honored by public rendering and cannot silently expose hidden project identity.
- Case-study and relationship changes have audit coverage before any write policy is introduced.
- Media storage, permission, file-type, and alternative-text rules are documented before uploads are enabled.
- Featured placement is deterministic and owner-controlled.
- The review checklist covers identity, claims, outcomes, testimonials, links, imagery, related services, and publication status.
- No case-study editor, upload action, or Production mutation is introduced during this design gate.

## PH4-006 — Add case-study and relationship audit coverage

- **Status:** Migration implemented locally; staging application and verification pending
- **Goal:** Extend immutable database-generated audit history to case-study and case-study/service relationship changes without enabling a write surface.
- **Reference:** `docs/PHASE-4-CMS-CASE-STUDY-AUDIT.md`

### Acceptance criteria

- Case-study inserts, updates, status changes, and deletes are recorded with actor, timestamps, and before/after snapshots.
- Relationship additions, changes, and removals are recorded against the case-study ID.
- Audit history remains readable only to authenticated CMS members under the existing audit policy.
- Source-record deletion does not cascade-delete audit history.
- No case-study or relationship insert/update/delete policy, editor, upload, or Production migration is introduced.

## PH4-007 — Build protected read-only case-study review panel

- **Status:** Implementation complete locally; authenticated staging preview QA completed
- **Goal:** Give authenticated staging members a structured case-study readiness and audit review surface without enabling mutations.
- **Reference:** `docs/PHASE-4-CMS-CASE-STUDIES.md`

### Acceptance criteria

- Anonymous visitors remain redirected from the review route.
- Authenticated staging members can review identity, privacy, publication, media, narrative, evidence, relationships, and audit state.
- The review panel contains no edit, publish, archive, upload, delete, or relationship mutation controls.
- Case-study and relationship audit history remains read-only.
- The panel is responsive and does not alter the public website or Production routes.

## PH4-008 - Define the case-study media contract and featured rule

- **Status:** Implementation complete locally; staging migration and verification pending
- **Goal:** Establish the safe media boundary and deterministic featured-project behavior before any case-study upload or editor surface is enabled.
- **Reference:** `docs/PHASE-4-CMS-MEDIA-CONTRACT.md`

### Acceptance criteria

- Featured media paths are relative, case-study-scoped, and limited to approved image extensions.
- Featured and supporting media require meaningful alternative text.
- Media review state is explicit and approved media cannot exist without a valid featured asset.
- At most one published case study can be featured at a time.
- Public Work ordering is deterministic when records share a featured or sort state.
- No storage bucket, upload control, case-study mutation policy, or Production migration is introduced.

## PH4-009 - Add the controlled case-study editor

- **Status:** Complete for the verified staging update-only workflow
- **Goal:** Let approved staging owners and editors prepare existing case-study records without opening media, relationship, deletion, or Production controls.
- **Reference:** docs/PHASE-4-CMS-CASE-STUDY-EDITOR.md

### Acceptance criteria

- Owner updates can move a record through Review and Published with database safeguards.
- Editors can update only draft/review records and cannot publish or archive.
- Only owners can approve client visibility.
- Successful updates appear in immutable case-study audit history.
- The form does not mutate media, featured placement, supporting relationships, or delete records.
- All admin write feedback uses a shared disabled loading state plus accessible success/error toasts that remain visible near the viewport edge.
- The first workflow test uses a non-featured staging record and no private client facts.

## PH4-010 - Harden the Admin UX

- **Status:** Desktop accessibility/privacy QA complete on staging; live mobile viewport review remains
- **Goal:** Make the staging CMS understandable to first-time users before adding broader write capabilities.

### Acceptance criteria

- Admin editor spacing uses a consistent token scale across panels, forms, alerts, and actions.
- Editor pages expose clear Dashboard → section → record breadcrumbs and the dashboard exposes section navigation.
- Native selects have visible, consistent caret indicators and keyboard focus states.
- Navigation rows use a responsive field layout that prevents label, destination, sort order, and visibility controls from colliding.
- Repeated row-level saves use a secondary action treatment while publish/commit actions retain the primary treatment.
- Global content sections and page metadata records can be collapsed with keyboard-accessible disclosure controls.
- Long global-content pages expose a sticky section jump navigation.
- Jump navigation uses deliberate spacing and clear grouping between the label and destinations.
- Admin grid controls must not overflow their tracks; number inputs and select wrappers use the shared constrained-control rule.
- Select controls use a consistent CSS-drawn caret that remains aligned at desktop, tablet, and mobile widths.
- Global-content rows switch to a stacked field layout before tablet widths can cause control collisions.
- Media replacement actions use the secondary treatment while upload and approval actions retain the primary treatment.
- CMS account controls, pagination, accordion status rows, and media approval actions use the shared admin interaction hierarchy.
- Service and case-study audit histories use server-side pagination with an explicit visible range.
- Sign-in includes a password recovery path and clear loading/error feedback.
- No Remember me control is added until a deliberate session-duration policy is approved.
- The staging Supabase Auth redirect URL is documented and configured before password reset is tested.

## PH4-011 - Add owner-only Team & Access

- **Status:** Implemented and authenticated staging QA completed
- **Goal:** Let the staging owner invite approved CMS users and assign the smallest required role without opening Supabase administration to the team.
- **Reference:** `docs/PHASE-4-CMS-ROLES.md`

### Acceptance criteria

- Only a signed-in `owner` can access `/crimson-admin-control/team` or invoke its server actions.
- Owners can invite a user through the server-side Supabase Auth admin API and assign `owner`, `editor`, or `reviewer`.
- Owners can change an existing CMS member's role.
- The last owner cannot be downgraded.
- The Supabase secret key remains server-only and is never exposed to browser code.
- Membership changes are limited to staging; account deletion, production access, and CRM permissions remain out of scope.

## PH4-012 - Add the controlled global content editor

- **Status:** Implemented and verified on `staging`
- **Goal:** Give approved staging members a clear, update-only surface for global settings, navigation, and page metadata.
- **Reference:** `docs/PHASE-4-CMS-GLOBAL-CONTENT.md`

### Acceptance criteria

- `/crimson-admin-control/content` is protected by CMS membership and linked from the admin dashboard.
- Owners and editors can update the default site settings record; reviewers remain read-only.
- Existing navigation items can be updated; only owners can change visibility or navigation group.
- Owners can publish/archive pages; editors can update only draft/review page metadata; reviewers remain read-only.
- Published page metadata must move through Review before content changes.
- Global content updates are recorded in an immutable, staging-only audit table.
- No create, delete, upload, freeform section-builder, CRM, or Production control is introduced.

## PH4-013 - Add approved page-section controls

- **Status:** Implemented and authenticated responsive/public QA completed on `staging`
- **Goal:** Let the staging owner enable, disable, and reorder approved top-level page sections without introducing a freeform page builder.
- **Reference:** `docs/PHASE-4-CMS-PAGE-SECTIONS.md`

### Acceptance criteria

- Existing top-level page sections are seeded into a fixed registry.
- Only owners can change section visibility or order; editors and reviewers remain read-only for structure.
- Public routes honor the published section visibility and order settings with safe local fallbacks.
- The database prevents hiding the last visible section on a page.
- Section changes are recorded in the global audit history.
- No arbitrary section creation, deletion, media upload, service-detail builder, case-study layout builder, CRM, or Production control is introduced.

## PH4-014 - Add controlled case-study media workflow

- **Status:** Implemented and verified on `staging` with the Cairnstack media package
- **Goal:** Let the staging owner upload and approve approved project visuals without opening case-study creation, relationship editing, or Production controls.
- **Reference:** `docs/PHASE-4-CMS-MEDIA-WORKFLOW.md`

### Acceptance criteria

- The staging media bucket is private by default and stores WebP output with a 2 MB final file size limit; supported PNG/JPEG/AVIF/WebP source files are converted server-side.
- Only owners can upload, replace, remove, or approve case-study media; editors and reviewers remain read-only.
- Featured and supporting media stay under a case-study-scoped path and require meaningful alternative text.
- Public featured/card frames use 16:9 and supporting gallery frames use 4:3; CMS guidance recommends 2400 × 1350 and 1600 × 1200 respectively without cropping source composition.
- Each case study exposes one featured slot and two replaceable supporting visual slots; the public page renders supporting visuals as a balanced grid on desktop and a stack on mobile.
- Owners can remove configured featured or supporting media from Review records through confirmed trash actions; case-study records themselves remain non-deletable.
- A published public route can read media only after the case study is published and its media package is approved.
- Uploading or approving media does not silently publish a case study or approve client visibility.
- No case-study creation, deletion, relationship editor, Production upload policy, or CRM control is introduced.

## PH4-015 - Add controlled case-study relationships

- **Status:** Implemented and verified on `staging` with the Cairnstack relationship path
- **Goal:** Let staging owners and editors connect existing case studies to published capabilities through a clear, atomic, audited workflow.
- **Reference:** `docs/PHASE-4-CMS-CASE-STUDY-RELATIONSHIPS.md`

### Acceptance criteria

- The relationship editor is available on the protected case-study page for owners and editors.
- Only currently published services appear as selectable options.
- A published case study must move to Review before its relationships can change.
- Saving the checkbox set replaces the relationship set atomically and records additions/removals in the existing audit history.
- Reviewers remain read-only and public output remains published-only.
- Published case-study detail pages render linked capabilities as accessible links to the corresponding public service pages; unlinked records render no empty section.
- An empty selection is supported and clearly communicates that no capabilities are linked.
- No case-study creation/deletion, service creation/deletion, bulk editor, Production relationship policy, or CRM control is introduced.

## PH4-016 - Complete owner content, consent, and release review

- **Status:** Complete; staging package approved and promotion authorized
- **Goal:** Close the remaining content, permission, privacy, and accessibility decisions for the release package. The staging-to-main code merge is now historical and is verified in the current roadmap overlay.
- **Reference:** `docs/OWNER-CONTENT-REVIEW.md` and `docs/LAUNCH-READINESS.md`

### Acceptance criteria

- Owner approves the public route copy, service detail copy, footer language, metadata, and placeholder treatment.
- Each published case study has an explicit identity, media, claims, testimonial, external-link, and related-capability decision.
- Contact form field language, privacy/consent copy, response-time expectation, inquiry owner, and retention expectation are approved.
- Desktop, tablet/mobile, keyboard, focus, and screen-reader review is completed or exceptions are documented and accepted.
- The owner explicitly authorized promotion to `main` on 2026-08-21 and the repository history records that code merge. The latest remote comparison is `origin/main...origin/staging = 3 1`, so the branches are divergent; the current remediation branch is based on `origin/main` and must enter `staging` through a normal pull request. Supabase data/configuration promotion remains a separate verification boundary handled by the approval-gated migration pipeline.

### Approval record

- Current staging content package approved by the owner on 2026-08-21.
- Desktop, tablet/mobile, keyboard, focus, and assistive-technology review marked complete by the owner.
- Promotion to `main` explicitly authorized by the owner on 2026-08-21; the staging-to-main code merge was subsequently completed and is recorded in the current roadmap overlay.
