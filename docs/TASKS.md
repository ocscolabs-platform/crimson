# Staging Task Queue

This queue records approved next-step work before implementation. Tasks in this file are not production changes until they are implemented, reviewed in staging, and explicitly promoted to `main`.

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

- The editor is available only behind the protected `/admin` boundary.
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

- **Status:** Editor and save-feedback UX complete locally; staging migration and core workflow QA complete; latest feedback UI pending staging deployment
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

- **Status:** Implemented locally; staging QA pending
- **Goal:** Make the staging CMS understandable to first-time users before adding broader write capabilities.

### Acceptance criteria

- Admin editor spacing uses a consistent token scale across panels, forms, alerts, and actions.
- Editor pages expose clear Dashboard → section → record breadcrumbs and the dashboard exposes section navigation.
- Native selects have visible, consistent caret indicators and keyboard focus states.
- Service and case-study audit histories use server-side pagination with an explicit visible range.
- Sign-in includes a password recovery path and clear loading/error feedback.
- No Remember me control is added until a deliberate session-duration policy is approved.
- The staging Supabase Auth redirect URL is documented and configured before password reset is tested.

## PH4-011 - Add owner-only Team & Access

- **Status:** Implemented and authenticated staging QA completed
- **Goal:** Let the staging owner invite approved CMS users and assign the smallest required role without opening Supabase administration to the team.
- **Reference:** `docs/PHASE-4-CMS-ROLES.md`

### Acceptance criteria

- Only a signed-in `owner` can access `/admin/team` or invoke its server actions.
- Owners can invite a user through the server-side Supabase Auth admin API and assign `owner`, `editor`, or `reviewer`.
- Owners can change an existing CMS member's role.
- The last owner cannot be downgraded.
- The Supabase secret key remains server-only and is never exposed to browser code.
- Membership changes are limited to staging; account deletion, production access, and CRM permissions remain out of scope.

## PH4-012 - Add the controlled global content editor

- **Status:** Implementation in progress on `staging`
- **Goal:** Give approved staging members a clear, update-only surface for global settings, navigation, and page metadata.
- **Reference:** `docs/PHASE-4-CMS-GLOBAL-CONTENT.md`

### Acceptance criteria

- `/admin/content` is protected by CMS membership and linked from the admin dashboard.
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

- **Status:** Implementation complete locally; staging migration and upload QA pending
- **Goal:** Let the staging owner upload and approve approved project visuals without opening case-study creation, relationship editing, or Production controls.
- **Reference:** `docs/PHASE-4-CMS-MEDIA-WORKFLOW.md`

### Acceptance criteria

- The staging media bucket is private by default and stores WebP output with a 2 MB final file size limit; supported PNG/JPEG/AVIF/WebP source files are converted server-side.
- Only owners can upload, replace, remove, or approve case-study media; editors and reviewers remain read-only.
- Featured and supporting media stay under a case-study-scoped path and require meaningful alternative text.
- Public featured/card frames use 16:9 and supporting gallery frames use 4:3; CMS guidance recommends 2400 × 1350 and 1600 × 1200 respectively without cropping source composition.
- Each case study exposes one featured slot and two replaceable supporting visual slots; the public page renders supporting visuals as a balanced grid on desktop and a stack on mobile.
- A published public route can read media only after the case study is published and its media package is approved.
- Uploading or approving media does not silently publish a case study or approve client visibility.
- No case-study creation, deletion, relationship editor, Production upload policy, or CRM control is introduced.
