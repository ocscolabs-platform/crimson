# Phase 1 — Initial Content Model

**Status:** Proposed for owner review  
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

## Editorial rules

- Draft content must never appear on public routes.
- A record needs a stable slug before publication.
- Client names, logos, testimonials, metrics, and images require explicit publication approval.
- Claims about outcomes should be evidence-based or clearly framed as qualitative.
- Content should identify an owner and a last-reviewed date before launch.
- The CMS schema should support preview and scheduled publication later, but those workflows are not implemented in Phase 1.

## Deliberately deferred entities

- CRM contacts, companies, opportunities, activities, and pipeline stages
- Authenticated users, roles, permissions, and audit logs
- Blog/insight articles
- Media library and asset transformations
- Form submissions and notification workflows

These belong to future CMS, CRM, or platform phases and should not be invented in the initial public content model.
