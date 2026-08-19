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
