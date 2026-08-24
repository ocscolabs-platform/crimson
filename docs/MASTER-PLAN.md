# OCSCO Project Crimson — Master Plan

**Plan version:** 2026-08-24
**Status:** Owner-approved roadmap; Phase 4C staging baseline and QA are complete, Phase 5B Slices 4A through 4F are closed in staging, the remaining Phase 5 editor work is approved as two descriptive completion work packages, no historical Slice 4G is created, and the Production release/promotion gate is deferred.
**Canonical roadmap:** This document is the source of truth for phase order, scope, dependencies, and release gates. Detailed phase documents remain implementation records and may contain historical statuses.

## Product objective

Project Crimson is OCSCO's integrated platform for:

1. A high-quality public OCSCO website.
2. A first-party CMS for structured public content and controlled publishing.
3. An Insights publishing system managed by the CMS.
4. A first-party CRM for inquiries and business relationships.

The system uses one application repository and a shared platform boundary, while keeping development, staging, and Production data, authentication, storage, secrets, and deployments separate.

## Operating model

```text
feature/*  →  staging / Preview  →  main / Production
                         │
                         └─ owner-approved content release boundary
```

- `main` is Production code and must remain protected.
- `staging` is the integration and editorial review environment.
- Git merges move application code only. They do not move Supabase rows, Auth users, Storage objects, or environment variables.
- The canonical CMS path is `/crimson-admin-control`. `/admin` and `/admin/*` return `404` and are not CMS aliases.
- Authentication, CMS membership roles, server-side checks, RLS, private media storage, and owner-only publishing are the security controls. The uncommon CMS path is only a discovery-reduction measure.
- The temporary row-copy promotion runner is not the target long-term editorial workflow. It remains only until the revision-based publishing path is verified in Production and the bridge can be retired safely.

## Status legend

- **Complete:** implemented and verified for the stated environment.
- **In progress:** implementation exists or work is actively being verified, but its release gate is not closed.
- **Planned:** approved scope not yet implemented.
- **Future:** intentionally deferred enhancement, not required for the MVP gate.

## Release state — 2026-08-22

The latest successful GitHub refresh reports:

- `origin/main` is `f098902f04cd25483c24bbc7f467d1023f1b7a79`;
- `origin/staging` is `b78976c16a1f88c73b32211ada42ae8d58aafb41`;
- `git rev-list --left-right --count origin/main...origin/staging` is `3 1`;
- `origin/main` and `origin/staging` are therefore not synchronized: they have diverged, with three commits unique to `main` and one commit unique to `staging`.

The remediation branch is based on the latest `origin/main` and is pushed for review. The safe reconciliation path is a normal pull request into `staging`, followed by staging verification; no force reset or history rewrite is permitted. Git promotion proves code movement only; it does not prove Production Supabase migrations, rows, Auth configuration, Storage objects/policies, environment variables, or public runtime behavior.

## Phase status at a glance

| Phase | Scope | Status | Current boundary |
| --- | --- | --- | --- |
| 0 | Platform foundation | Complete | Repository, deployment shell, operating contract, and environment separation baseline. |
| 1 | Information architecture and content model | Complete as baseline | Public sitemap and structured content model; Insights was deferred at the time and is now approved for Phase 6. |
| 2 | Brand, visual, and interaction direction | Complete | OCSCO Design System v1.0 / 2026 and the implemented public visual system. |
| 3 | Public website and contact workflow | Complete | Public routes, service details, Work library/detail, About, Contact, inquiry storage/notification, SEO foundations, domain deployment. |
| 4A | CMS foundation, auth, roles, and read boundary | Complete in staging; Production release gate deferred | Supabase schema, RLS, Auth, membership roles, published-only public reads, canonical CMS route. |
| 4B | Staging editorial surfaces | Complete in staging for approved slices | Services, global metadata/navigation, fixed page-section controls, case studies, media, relationships, audit history, revisions, publish/restore controls, admin UX. |
| 4C | Staging baseline and QA | **Complete** | Clean rebuild, canonical migration parity, CMS workflow acceptance, media, inquiry, route, runtime, and staging/Production isolation checks. The Production release/promotion gate is tracked separately as deferred. |
| 5 | Full Page Content CMS | **In progress** | Public PageDocument authority is complete for Home, Services, About, and Contact; the editor-facing PageDocument CMS remains to be implemented through two approved completion work packages. |
| 6 | Insights CMS and public experience | Planned | `/insights`, `/insights/[slug]`, article model, CMS editor, public listing, search/filtering, SEO, media, preview, and publishing. |
| 7 | CRM foundation and workflows | Planned | Inquiry/contacts and the approved business relationship workflow; scope must be finalized before implementation. |
| 8 | Product hardening and reusable-platform work | Future | Automation, richer media, scheduled publishing, analytics/integrations, multi-tenant concerns, and other explicitly approved extensions. |

## Detailed phases

### Phase 0 — Platform foundation

**Status: Complete.**

- Created the repository and local project workspace.
- Established GitHub/Vercel foundations, branch conventions, environment separation, ignore rules, and documentation standards.
- Added the Next.js/TypeScript/Tailwind/ESLint application shell and validation commands.

### Phase 1 — Information architecture and content model

**Status: Complete as the original baseline; extended by this roadmap.**

- Defined the public sitemap, audiences, primary navigation, content relationships, and proof/content approval rules.
- Defined structured entities for site settings, navigation, pages, services, case studies, and optional testimonials.
- Recorded Insights and CRM as intentionally deferred at that time. Insights is now approved for Phase 6; CRM remains Phase 7.

### Phase 2 — Brand and visual system

**Status: Complete.**

- Established the OCSCO design system, typography, color tokens, logo/favicons, button states, navigation states, spacing rules, responsive behavior, iconography, hero direction, media placeholders, and admin visual language.
- Locked the public style guide as the visual source of truth for v1.0 / 2026.

### Phase 3 — Public website and contact workflow

**Status: Complete.**

- Delivered responsive Home, Services, service detail, Work, Work detail, About, and Contact routes.
- Delivered the contact inquiry form with validation, Supabase persistence, Resend notification, environment-specific configuration, and owner-tested success/failure states.
- Added published-only public CMS reads, sitewide CTA routing, SEO metadata, favicon/OG foundations, case-study media presentation, relationships, and Work-library hover previews.

### Phase 4 — Custom CMS foundation and release stabilization

#### 4A — Foundation, auth, roles, and read boundary

**Status: Complete in staging; Production verification remains part of 4C.**

- Relational CMS tables for settings, navigation, pages, services, case studies, and relationships.
- Authenticated CMS route at `/crimson-admin-control` with Supabase cookie sessions.
- Owner/editor/reviewer membership roles, server-side authorization, RLS, public published-only reads, and private media storage.
- Password recovery and invitation flows with canonical callback handling.

#### 4B — Approved staging editorial slices

**Status: Complete for the currently approved staging scope.**

- Update-only global content editor for site settings, navigation, page metadata, and fixed page-section visibility/order.
- Services editor with draft/review/published safeguards.
- Case-study review/editor surface, fixed media package, WebP normalization, 2 MB final limit, one featured 16:9 slot, two supporting 4:3 slots, relationships, audit history, revisions, and owner-only publish/restore actions.
- Admin UX and accessibility hardening, including responsive controls, action hierarchy, disclosure groups, pagination, status feedback, and direct generic-admin 404 behavior.

#### 4C — Staging baseline and QA

**Status: Complete.** Owner-approved `crimson-staging` acceptance verified the clean rebuild, 21 canonical migrations and ledger parity, RLS/functions/triggers/grants/Storage, owner authentication and membership, Services, Global Content, case-study revisions and publication, published-only reads, relationships, audit history, media lifecycle, inquiry persistence, route protection, metadata isolation, Production endpoint/domain isolation, and browser/runtime health.

#### Deferred Production release/promotion gate

**Status: Deferred release gate.** This gate must be completed before a future Production CMS/schema promotion, but it does not block Phase 5 development in staging.

1. Verify the Production Vercel deployment and environment variables use only the Production Supabase/Auth/Resend boundaries.
2. Inventory and verify Production migrations, RLS policies, grants, functions, triggers, revision RPCs, and Storage policies.
3. Verify Production Auth URLs, callbacks, invitation flow, password recovery, logout, and session behavior.
4. Verify the Production revision workflow, media, relationships, audit history, inquiry routing, and published-only reads.
5. Confirm branch protection, required checks, required reviewers, and Production approval environments.
6. Retire or explicitly retain the temporary row-copy promotion bridge with an owner-approved rollback path.
7. Synchronize `staging` to the approved `main` baseline and record Production owner sign-off before Production promotion.

### Phase 5 — Full Page Content CMS

**Status: In progress.** The public PageDocument architecture is complete in staging, but the editor-facing Full Page Content CMS is not complete. The two remaining completion work packages below are owner-approved for planning; implementation requires separate authorization. The deferred Production release gate remains required before Production promotion but does not block this staging work.

Phase 5B Slice 3 is closed. Phase 5B Slices 4A through 4F are closed after automated staging-health verification. Home, About, Services, and Contact use PageDocument authority for public body and page-level SEO metadata; Work remains legacy. Publication freshness remains request-time under the current `force-dynamic` architecture, and no explicit revalidation infrastructure is required. The staging verifier now runs on every push to `staging`. Phase 5 cannot close merely because public routes consume PageDocuments: authorized non-technical editors still cannot manage authoritative PageDocument content for Home, Services overview, About, and Contact through Crimson CMS. Phase 6 Insights remains not started.

The verified staging baseline remains: 25 canonical migrations, zero pending migrations, zero duplicates, zero drift, Published PageDocument baselines for the four target pages, revision and Draft/Review/Published backend capability, publish/restore RPCs, role authorization, transitional `page_sections`, scoped anti-drift guards, Work isolation, and a deferred Production promotion gate.

#### Approved remaining Phase 5 work packages

The following are descriptive completion work packages, not historical Phase 5B slices. No Slice 4G is created or implied.

##### Work Package A — PageDocument Editor and Editorial Workflow

**Objective:** Build the reusable Crimson CMS editorial experience for the four approved Phase 5 pages.

**Scope:**

- Shared PageDocument page-management shell.
- Home, Services overview, About, and Contact marketing-content editors.
- Page-specific structured forms for approved Hero and section fields.
- Constrained CTA controls, section order, and allowed visibility controls.
- Authoritative PageDocument SEO title, description, and approved Open Graph reference controls.
- Home Service-reference controls; canonical Service records remain separate.
- Draft save/update, Review workflow, owner-only Publish, and owner-only Restore.
- Role-aware controls, PageDocument revision/audit status, validation UX, and authenticated Draft/Review Preview.
- Protection of code-controlled functionality, especially the Contact form contract.

**Explicit exclusions:** Work migration; freeform builders; arbitrary sections, components, or routes; Contact form-builder behavior; duplicated Service records; scheduled publishing; version comparison; bulk editing; Insights; CRM; and Production.

##### Work Package B — Full Page Content CMS Staging QA, Owner Front-End Polish, and Phase 5 Closure

**Objective:** Perform end-to-end editor acceptance, public staging QA, owner/client-style visual refinement, and formal Phase 5 closure after Work Package A is implemented and staging-verified.

**Required acceptance:** Test owner, editor, and reviewer boundaries where applicable across Home, Services, About, and Contact. Verify structured editing, CTA and section constraints, SEO, Draft, Review, authenticated Preview, Publish, public Published-only output, revision/audit state, Restore, validation/error behavior, migration alignment, staging architecture verification, Service-reference integrity, Contact functional-boundary integrity, Work isolation, browser/runtime health, responsive behavior, accessibility sanity, and public visual regression.

Use the Codex browser device toolbar for responsive QA at 1440×900, 768×1024, and 390×844.

**Owner Front-End Polish checkpoint:** Classify every staging observation as:

- **FIX NOW** — implementation bug, regression, broken responsive behavior, accessibility defect, or mismatch against the approved design.
- **POLISH WINDOW** — small visual or UX adjustment without an architecture, schema, product-behavior, or workflow change.
- **NEW SCOPE** — new feature, component type, CMS capability, workflow, database behavior, integration, or functional requirement; requires separate owner approval and must not silently expand Phase 5.
- **DEFER** — useful enhancement not required for Phase 5 acceptance.

Only FIX NOW and approved POLISH WINDOW items belong in Work Package B.

##### Phase 5 closure gate

Phase 5 may close only when an authorized non-technical editor can manage all four approved pages through Crimson CMS without SQL Editor, Supabase dashboard, GitHub, repository edits, Codex intervention, or manual database changes. Home, Services overview, About, and Contact must each support authoritative PageDocument editing, SEO editing, usable Draft/Review/Publish/Preview/validation flows, and enforced role boundaries while Work remains legacy.

##### Functional boundaries retained

- Contact CMS controls approved marketing wrapper content only; fields, functional labels, validation, honeypot, inquiry API, Service options, success/error behavior, and environment guards remain code-controlled.
- `public.services` remains the authority for Service records. The Services overview editor controls only its PageDocument shell/wrapper and does not duplicate Service data.
- Home may manage validated Service references/order, while Service data remains canonical in `public.services`.
- Work remains legacy and outside Phase 5 PageDocument migration.

#### Phase 5B Slice 4F — Metadata / SEO and revalidation integration

**Status: Closed in staging.** Home, Services, About, and Contact now use the validated Published PageDocument boundary for page-level SEO title, description, and approved generated Open Graph reference resolution. Origin, `metadataBase`, route paths, canonical construction, absolute URLs, global branding, and environment behavior remain code-controlled. Work remains legacy for body and metadata. The routes remain `force-dynamic`, so publication freshness is request-time; React `cache()` is request-scoped memoization only and no ISR, cache tags, webhooks, or explicit revalidation bridge is required. PR #62 merged into `staging` at `d8af973b`; the read-only staging verifier, application validation, and migration-release workflow passed, with Production skipped. No database mutation was required.

The current CMS can edit global metadata and a fixed section registry, but it does not yet provide complete body-content editing for Home, About, Services, or Contact. This phase closes that gap without introducing an arbitrary page builder.

- Define approved structured fields/sections for each existing public page.
- Add editor controls for page body copy, headings, supporting text, CTAs, and approved section variants.
- Reuse the existing Draft → Review → Published revision model and preview boundary.
- Include page SEO title/description, canonical metadata, Open Graph image, visibility/order, and validation.
- Keep the section registry constrained to approved components; no arbitrary component or layout creation.
- Validate every edited page at desktop/mobile, public published-only output, keyboard/focus, and screen-reader levels.

### Phase 6 — Insights

**Status: Planned; not implemented.**

The owner-approved public route names are `/insights` and `/insights/[slug]`. The CMS area is `Insights / Articles`. The Cairnstack references are structural references only; they must not be copied visually, stylistically, or technically.

#### Public Insights index

- Published article listing.
- Optional featured article treatment when an approved featured record exists.
- Category and tag filtering.
- Search across approved article fields.
- Pagination or load-more behavior selected during design validation.
- Responsive layout, loading state, empty/no-results state, and error state.
- SEO-friendly index metadata and canonical URLs.

#### Public article detail

- Title, stable slug, excerpt, featured image, author, publish date, and updated date where applicable.
- Category and multiple tags.
- Main article content with a safe, approved content format.
- SEO title, SEO description, canonical metadata, and Open Graph/social image.
- Draft/Published boundary, related articles, accessible media, and responsive reading layout.

#### CMS article editor

- Create and edit articles.
- Save Draft, move to Review, Publish/Unpublish through the existing owner-controlled revision model.
- Manage title, slug, excerpt, featured image, author, category, tags, content, SEO metadata, social image, and publication dates.
- Preview the article using the same published-only boundary without exposing unpublished content publicly.
- Validate slug uniqueness, required fields, alt text, image limits, SEO lengths, and publication state transitions.

### Phase 7 — CRM foundation and workflows

**Status: Planned; not implemented.**

- Finalize CRM scope and ownership before schema work.
- Model inquiries, contacts, companies, opportunities, activities, pipeline stages, notes, role permissions, audit, and notification ownership as approved.
- Decide whether the existing inquiry table is the intake edge of the CRM or a separate public form boundary; do not silently treat the current inquiry workflow as a complete CRM.
- Reuse the platform auth/role/audit conventions while keeping CRM permissions separate from CMS permissions.
- Add internal CRM UI only after CMS release stabilization and the blog/page-content work that defines the shared editorial boundaries are stable.

### Phase 8 — Product hardening and reusable-platform work

**Status: Future.**

Potential future work includes scheduled publishing, richer media library management, automated image processing, analytics, newsletters, integrations, CRM automation, additional roles, multi-tenant configuration, and reusable client-template packaging. None is an MVP dependency until separately approved.

## MVP versus future enhancements

### MVP

- Public OCSCO website and contact workflow.
- Stable CMS authentication, role boundaries, revisions, media, relationships, audit, and published-only reads.
- Complete page-content editing for existing public pages.
- Insights listing and article detail.
- Insights article creation/editing, draft/review/publish, categories, tags, media, SEO, preview, and related articles.
- Minimum CRM intake and relationship scope once the owner approves the CRM requirements.
- Repeatable staging-to-Production release and rollback gates.

### Future enhancements

- Freeform page builder or arbitrary section creation.
- Full media library beyond the case-study package.
- Scheduled publishing, version comparison, bulk editing, comments, newsletters, advanced search ranking, analytics, and automation.
- CRM integrations, workflow automation, advanced reporting, and multi-tenant productization.

## Dependencies and release gates

| Capability | Requires | Must be true before release |
| --- | --- | --- |
| Public website | Next.js routes, published CMS reads, Production data/config | Published-only behavior, SEO, accessibility, build, and deployment checks pass. |
| CMS | Supabase schema/RLS/Auth, server actions, revisions, audit | Roles, save/review/publish/restore, recovery, media, relationships, and 404 boundary pass QA. |
| Full page editor | Approved page-section contract and revision model | Home/About/Services/Contact body fields are defined and previewable without a freeform builder. |
| Insights | Phase 5 page-content patterns, article schema, tags/categories, media, revisions, public routes | Article privacy, slug/SEO rules, media validation, editor permissions, preview, index/search/filter, and detail QA pass. |
| CRM | Inquiry intake decision, contacts/companies model, role/audit requirements | CRM scope and ownership are approved; CMS and CRM permissions remain separate. |
| Production release | Equivalent Production migration/config, branch protection, owner approval | No unresolved critical checks, no stale bridge dependency, and rollback path documented. |

## Known documentation and architecture gaps

1. There was no single master roadmap; phase status was distributed across historical documents.
2. Several early Phase 4 task entries still say “pending” even though later entries document the implemented staging slices. The task queue needs a current overlay and must not be read as a single chronological status source.
3. The original Page model describes flexible structured sections, but the current CMS implementation only edits metadata and a fixed section registry. Full page body editing is therefore a real Phase 5 requirement, not an assumed completion.
4. Insights was explicitly deferred in the original content model and IA; it is now approved for Phase 6 but has no migrations, routes, CMS editor, or nav entry yet.
5. CRM remains a product intention plus a public inquiry intake; it is not a functioning CRM and must not be represented as complete.
6. The Production CMS release path remains a deferred release gate until the revision-based workflow is verified in Production and the row-copy bridge is retired or explicitly retained.
7. The repository has lint/build validation but no dedicated automated type-check, unit, integration, or end-to-end test script. This is an important merge-readiness gap to address in Phase 4C without adding unrelated test infrastructure.

## Merge readiness criteria

These are the release gates. For the already-completed staging-to-main merge, they are now post-merge Production verification and baseline-stabilization criteria. For future releases, they must be satisfied before merging staging into main:

- `npm run lint` passes.
- `npm run build` passes with the intended Node/runtime version.
- Type validation is explicit and passes, either through the existing build or a documented dedicated check.
- Staging and Production migrations, functions, grants, RLS, triggers, and storage policies are inventoried and verified.
- Vercel variables are present in the correct environments; no local environment or secret is committed.
- Auth Site URLs, redirect URLs, invite links, and password recovery callbacks work in staging and Production.
- `/crimson-admin-control` is protected and `/admin` plus `/admin/*` are normal 404 responses.
- CMS role matrix, revision transitions, owner-only publish/restore, audit history, media lifecycle, relationships, and public published-only output pass.
- Public routes, contact workflow, SEO/favicons/OG metadata, responsive layouts, accessibility, and no-results/error states pass smoke QA.
- Production code and data boundaries are understood; no unreviewed staging rows, users, Storage objects, or credentials are promoted by a Git merge.
- Branch protection and release approval rules are active.
- The temporary promotion bridge is either explicitly retained with an owner-approved runbook or retired because the replacement is verified.
- Owner signs off the release package and rollback plan.

## Source documents

- [`PROJECT.md`](./PROJECT.md) — product vision.
- [`STATUS.md`](./STATUS.md) — current implementation status.
- [`TASKS.md`](./TASKS.md) — detailed task history and current overlay.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system boundaries.
- [`CONTENT-MODEL.md`](./CONTENT-MODEL.md) — entities and editorial rules.
- [`INFORMATION-ARCHITECTURE.md`](./INFORMATION-ARCHITECTURE.md) — public routes and navigation.
- [`RELEASE-READINESS.md`](./RELEASE-READINESS.md) — release gate details.
- [`RELEASE-ARCHITECTURE.md`](./RELEASE-ARCHITECTURE.md) — code/data promotion model.
- [`DECISIONS.md`](./DECISIONS.md) — accepted architecture decisions.
