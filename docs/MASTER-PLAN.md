# OCSCO Project Crimson — Master Plan

**Plan version:** 2026-08-22
**Status:** Roadmap reconciliation complete; Phase 4C post-merge release verification is the current gate.
**Canonical roadmap:** This document is the source of truth for phase order, scope, dependencies, and release gates. Detailed phase documents remain implementation records and may contain historical statuses.

## Product objective

Project Crimson is OCSCO's integrated platform for:

1. A high-quality public OCSCO website.
2. A first-party CMS for structured public content and controlled publishing.
3. A Blog / Insights publishing system managed by the CMS.
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

## Verified release state — 2026-08-22

The live remote refs were fetched and compared before this plan was revised:

- `origin/main` is `0b58c03` and contains the staging merge commit `e196ff6`.
- `origin/staging` is `72ebcaf` and is an ancestor of `origin/main`.
- `origin/main` is three commits ahead of `origin/staging`; `staging` has no commits that are absent from `main`.
- Therefore, the staging-to-main code merge has already occurred. The branches are not synchronized: staging must be brought forward to the approved `main` baseline after the post-merge verification gate.
- This Git result proves code promotion only. It does not prove that Production Supabase migrations, rows, Auth configuration, Storage objects/policies, environment variables, or public runtime behavior are correct.

## Phase status at a glance

| Phase | Scope | Status | Current boundary |
| --- | --- | --- | --- |
| 0 | Platform foundation | Complete | Repository, deployment shell, operating contract, and environment separation baseline. |
| 1 | Information architecture and content model | Complete as baseline | Public sitemap and structured content model; Blog was deferred at the time and is now approved for Phase 6. |
| 2 | Brand, visual, and interaction direction | Complete | OCSCO Design System v1.0 / 2026 and the implemented public visual system. |
| 3 | Public website and contact workflow | Complete | Public routes, service details, Work library/detail, About, Contact, inquiry storage/notification, SEO foundations, domain deployment. |
| 4A | CMS foundation, auth, roles, and read boundary | Complete in staging; Production verification pending | Supabase schema, RLS, Auth, membership roles, published-only public reads, canonical CMS route. |
| 4B | Staging editorial surfaces | Complete in staging for approved slices | Services, global metadata/navigation, fixed page-section controls, case studies, media, relationships, audit history, revisions, publish/restore controls, admin UX. |
| 4C | Post-merge release verification and baseline stabilization | **Current** | Production deployment/configuration verification, Auth and database boundary checks, public/admin route checks, temporary bridge retirement decision, automated validation, and staging synchronization. |
| 5 | Full page-content CMS | Planned | Actual editable content for Home, About, Services, and Contact, using approved structured sections; not a freeform page builder. |
| 6 | Blog / Insights CMS and public experience | Planned | Article model, CMS editor, public listing, article detail, search/filtering, SEO, media, preview, and publishing. |
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
- Recorded Blog/Insights and CRM as intentionally deferred at that time. Blog is now approved for Phase 6; CRM remains Phase 7.

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

#### 4C — Post-merge release verification and baseline stabilization

**Status: Current. The staging-to-main code merge is complete; no Phase 5 feature work begins until this post-merge baseline gate is closed.**

1. Verify the Production Vercel deployment is running the approved `origin/main` commit and that the public site is healthy.
2. Verify Production environment variables point to the Production Supabase/Auth/Resend boundaries; no staging URL, key, user, or secret is present in Production.
3. Inventory and verify Production migrations, RLS policies, grants, functions, triggers, revision RPCs, and Storage policies.
4. Verify Production Auth Site URL, redirect allow-list, invitation flow, password recovery, callback exchange, logout, and session behavior for `/crimson-admin-control`.
5. Verify the revision-based publishing workflow in Production: save Draft, move to Review, owner-only Publish/Restore, published-only public reads, and audit history.
6. Verify the canonical CMS path is protected, `/admin` and `/admin/*` return normal `404` responses, and the uncommon path is not treated as the security boundary.
7. Verify media lifecycle, public/private delivery, relationships, inquiry routing, and the absence of staging-only editorial data in Production.
8. Resolve or retire the temporary row-copy promotion mechanism only after the Production revision workflow is proven; record the decision and rollback path.
9. Confirm automated lint/build/type/deployment validation and document any remaining non-blocking warnings.
10. Synchronize remote `staging` to the latest approved `main` baseline after this verification gate; do not merge stale staging back into `main`.
11. Record owner sign-off, the verified commit/configuration baseline, and the rollback procedure. Only then open Phase 5.

### Phase 5 — Full page-content CMS

**Status: Planned; starts after Phase 4C is stable.**

The current CMS can edit global metadata and a fixed section registry, but it does not yet provide complete body-content editing for Home, About, Services, or Contact. This phase closes that gap without introducing an arbitrary page builder.

- Define approved structured fields/sections for each existing public page.
- Add editor controls for page body copy, headings, supporting text, CTAs, and approved section variants.
- Reuse the existing Draft → Review → Published revision model and preview boundary.
- Include page SEO title/description, canonical metadata, Open Graph image, visibility/order, and validation.
- Keep the section registry constrained to approved components; no arbitrary component or layout creation.
- Validate every edited page at desktop/mobile, public published-only output, keyboard/focus, and screen-reader levels.

### Phase 6 — Blog / Insights

**Status: Planned; not implemented.**

The public route names should be `/insights` and `/insights/[slug]` unless a later naming decision approves `/blog`. The Cairnstack references are structural references only; they must not be copied visually, stylistically, or technically.

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
- Blog/Insights listing and article detail.
- Blog CMS article creation/editing, draft/review/publish, categories, tags, media, SEO, preview, and related articles.
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
| Blog / Insights | Phase 5 page-content patterns, article schema, tags/categories, media, revisions, public routes | Article privacy, slug/SEO rules, media validation, editor permissions, preview, index/search/filter, and detail QA pass. |
| CRM | Inquiry intake decision, contacts/companies model, role/audit requirements | CRM scope and ownership are approved; CMS and CRM permissions remain separate. |
| Production release | Equivalent Production migration/config, branch protection, owner approval | No unresolved critical checks, no stale bridge dependency, and rollback path documented. |

## Known documentation and architecture gaps

1. There was no single master roadmap; phase status was distributed across historical documents.
2. Several early Phase 4 task entries still say “pending” even though later entries document the implemented staging slices. The task queue needs a current overlay and must not be read as a single chronological status source.
3. The original Page model describes flexible structured sections, but the current CMS implementation only edits metadata and a fixed section registry. Full page body editing is therefore a real Phase 5 requirement, not an assumed completion.
4. Blog/Insights was explicitly deferred in the original content model and IA; it is now approved for Phase 6 but has no migrations, routes, CMS editor, or nav entry yet.
5. CRM remains a product intention plus a public inquiry intake; it is not a functioning CRM and must not be represented as complete.
6. The Production CMS release path is still transitional until the revision-based workflow is verified in Production and the row-copy bridge is retired.
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
