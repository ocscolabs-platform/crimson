# Phase 1 — Initial Content Model

**Status:** Phase 1 baseline; extended roadmap approved in [`MASTER-PLAN.md`](./MASTER-PLAN.md)
**Principle:** Content should be structured independently from page layout so it can later support the public website and the custom CMS without forcing the CMS to mirror visual components.

## Content types

### Site Settings

One record containing platform-wide editorial and contact settings.

Suggested fields:

- Site name
- Short positioning statement
- Default social sharing title and description
- Default social sharing image
- Primary contact destination
- Footer navigation groups

### Navigation

Ordered links for primary and footer navigation.

Suggested fields:

- Label
- URL or route
- Navigation group
- Sort order
- Visibility status

### Page

Flexible content for approved top-level pages such as Home, About, Services, and Contact.

Suggested fields:

- Title
- Slug
- Page purpose
- Audience
- Search title and description
- Social sharing image
- Structured content sections
- Primary call to action
- Publication status
- Published date and last updated date

### Service

An OCSCO capability that can be referenced by pages and case studies.

Suggested fields:

- Name
- Slug
- Short description
- Detailed description
- Audience/problem addressed
- Deliverables or capabilities
- Process summary
- Related case studies
- Primary call to action
- Publication status

Initial proposed service records:

- Branding
- Website Design & Development
- Custom CMS
- CRM & Business Tools
- Custom Web Applications

### Case Study

A publishable project story that demonstrates capability and outcomes.

Suggested fields:

- Project name
- Slug
- Client visibility setting
- Summary
- Challenge
- Approach
- Deliverables
- Outcomes or evidence
- Related services
- Featured image and supporting media
- Testimonial, if approved
- Publication status
- Publication date

### Testimonial (optional)

A reusable quote that may be attached to a case study or page.

Suggested fields:

- Quote
- Person name
- Role and organization
- Permission/status
- Related project

## Relationships

```text
Site Settings ── controls ── Navigation
Page ── references ── Service
Page ── references ── Case Study
Service ── relates to ── Case Study
Case Study ── may include ── Testimonial
```

## Current CMS implementation boundary

The original Page model intentionally describes structured content sections, but the current Phase 4 CMS does not yet expose full page-body editing. It currently supports global settings, navigation, page metadata, and a fixed registry of approved section visibility/order. Home, About, Services, and Contact body copy and section fields are a Phase 5 requirement. The implementation must remain structured and constrained; it must not become a freeform page builder by accident.

## Approved Insights extension — Phase 6

Insights is now approved for the roadmap but is not implemented in the current schema, routes, or CMS. It should reuse the current Supabase, Auth, RLS, revision, audit, media, and published-only read boundaries.

### Article

- Title
- Stable unique slug
- Excerpt
- Main article content in an approved safe content format
- Featured media reference and alternative text
- Author reference
- Category reference
- Publication status: Draft, Review, Published, and any approved archive state
- Publish date and updated date
- SEO title and SEO description
- Canonical URL metadata
- Open Graph/social image reference
- Last reviewed date and editorial owner

### Category

- Name
- Stable unique slug
- Description, if needed for the public index
- Visibility/publication status if categories are editorially managed

### Tag

- Name
- Stable unique slug
- Optional description

### Article relationships

- `article.category_id` references one category.
- `article_tags` joins an article to zero or more tags with a uniqueness constraint.
- `article.author_id` references an approved author/member profile without exposing private membership data.
- Related articles are derived through approved category/tag relationships or an explicit editorial relation; the selection rule must be deterministic and published-only.
- Article revisions reuse the current revision/publish boundary rather than writing unpublished content directly to the public base record.
- Media references reuse the private media contract, file limits, WebP normalization, alt-text validation, and signed/public delivery rules appropriate to articles.

### Insights editorial rules

- Draft and Review articles never appear on public routes, search, filters, related articles, metadata, or feeds.
- Slugs are unique and must be validated before publication.
- The CMS must support create, edit, draft, review, publish, unpublish, preview, category/tag assignment, author assignment, media, and SEO metadata.
- The public index and article route use `/insights` and `/insights/[slug]`, with `Insights` as the navigation label and `Insights / Articles` as the CMS area.
- The Cairnstack reference is structural only; its design, visual system, branding, and implementation must not be copied.

## Editorial rules

- Draft content must never appear on public routes.
- A record needs a stable slug before publication.
- Client names, logos, testimonials, metrics, and images require explicit publication approval.
- Claims about outcomes should be evidence-based or clearly framed as qualitative.
- Content should identify an owner and a last-reviewed date before launch.
- The CMS schema should support preview and scheduled publication later, but those workflows are not implemented in Phase 1.

## Deferred entities and roadmap status

- CRM contacts, companies, opportunities, activities, and pipeline stages
- Authenticated users, roles, permissions, and audit logs
- Insights articles — approved for Phase 6; not implemented yet
- Media library and asset transformations
- Form submissions and notification workflows

These belong to future CMS, CRM, or platform phases and should not be treated as complete in the current Phase 4 CMS.
