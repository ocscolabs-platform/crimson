# Phase 1 — Information Architecture

**Status:** Proposed for owner review  
**Scope:** Public website structure and content relationships only  
**Out of scope:** Visual design, page implementation, CMS implementation, CRM implementation, authentication, and production data connections

## Product boundary

Project Crimson will eventually present OCSCO as a capable technology and services partner while supporting an internal platform. The first public website should explain what OCSCO does, show credible work, and provide a clear path to start a conversation.

The public website should not expose the protected admin application, CMS, or CRM as implemented products until those systems exist and their public positioning has been approved.

## Proposed audiences

These audiences are working assumptions and require owner confirmation:

1. Organizations that need a stronger brand and public web presence.
2. Organizations that need a custom CMS, CRM, or internal business tool.
3. Professional-service and other growth-oriented teams evaluating a long-term digital partner.

## Proposed primary navigation

```text
Home
Services
Work
About
Contact
```

Primary conversion action: **Start a conversation** → `/contact`.

## Proposed sitemap

| Route | Purpose | Primary audience | Primary action | Phase 1 status |
| --- | --- | --- | --- | --- |
| `/` | Explain OCSCO's value and direct visitors to services, work, and contact. | All audiences | Start a conversation | Required |
| `/services` | Provide an overview of OCSCO's capabilities. | Prospective clients | Explore a service | Required |
| `/services/branding` | Explain branding strategy and identity work. | Brand and marketing decision-makers | Discuss a brand project | Required |
| `/services/website-design-development` | Explain website strategy, design, and development. | Website decision-makers | Discuss a website project | Required |
| `/services/custom-cms` | Explain custom content systems as a capability. | Teams with content workflow needs | Discuss a platform need | Required |
| `/services/crm-business-tools` | Explain custom CRM and business tooling. | Operations and leadership teams | Discuss an internal tool | Required |
| `/services/custom-web-applications` | Explain bespoke application development. | Teams with unique workflows | Discuss an application | Required |
| `/work` | Show selected projects and outcomes. | All prospective clients | View a case study | Required |
| `/work/[slug]` | Give one project enough context to establish credibility. | Qualified prospects | Start a related conversation | Required |
| `/about` | Explain OCSCO's approach, capabilities, and point of view. | Prospective clients and partners | Start a conversation | Required |
| `/contact` | Provide the approved path for starting a qualified inquiry. | Qualified prospects | Submit an inquiry or use approved contact method | Required |

### Deferred until separately approved

- `/insights` and article detail routes
- Client portal or protected admin routes
- Public CMS or CRM product dashboards
- Account creation, authentication, or self-service workflows

## Page relationships

```text
Home
├── Services
│   ├── Branding
│   ├── Website Design & Development
│   ├── Custom CMS
│   ├── CRM & Business Tools
│   └── Custom Web Applications
├── Work
│   └── Case Study Detail
├── About
└── Contact
```

## Navigation rules

- Keep the primary navigation stable and limited to the highest-value destinations.
- Every service detail page should link to at least one relevant work item or proof point when one is approved.
- Every major page should provide one clear next action rather than competing calls to action.
- Case studies should link back to the related service category and to `/contact`.
- Deferred routes must not appear in navigation until they have approved content and an implementation plan.

## Owner decisions needed

- Confirm the priority order of the proposed audiences.
- Confirm whether all five service categories should launch together or whether a smaller initial set is preferred.
- Confirm which projects are approved as public case studies and what results may be stated.
- Confirm the preferred contact destination, response owner, and expected inquiry workflow.
- Confirm whether OCSCO wants a distinct public page describing the future platform capabilities or prefers to present them only as services.
