# Phase 4 — Controlled case-study relationships

**Status:** Relationship editor and public read path implemented locally; staging migration and workflow QA pending

## Scope

This slice gives owners and editors a dedicated relationship editor for existing staging case studies. It connects a case study to currently published OCSCO capabilities without opening case-study creation, deletion, arbitrary service creation, or Production administration.

## Role and status boundary

| Role | View available capabilities | Save relationships |
| --- | --- | --- |
| owner | Yes | Yes, on Draft or Review records |
| editor | Yes | Yes, on Draft or Review records |
| reviewer | Yes | No |

Published case studies must be moved to Review before relationship changes. The save uses one server-side replacement function so the selected set is committed atomically and each addition/removal is captured by the existing database audit trigger.

## Relationship rules

- Only services that are currently published and past their publication time appear as choices.
- An empty selection is valid and removes all relationships from the case study.
- The public renderer continues to expose a relationship only when both the case study and service are published.
- Published case-study detail pages show linked capabilities as accessible links to their public service pages; empty relationship sets do not create an empty public section.
- The CMS relationship panel is separate from narrative, media, and publication-status saves so each action has a clear success boundary.
- Case-study creation/deletion, service creation/deletion, bulk relationship editing, and CRM relationships remain deferred.

## Staging rollout

1. Apply `supabase/migrations/20260820130000_add_staging_case_study_relationship_editor.sql` in `crimson-staging` only, after the existing case-study editor and audit migrations.
2. Open an existing case study as the owner and move it to Review if it is published.
3. Select one or more published capabilities and save the dedicated relationship panel.
4. Confirm the success toast, linked capability list, and audit entries for relationship additions/removals.
5. Open the public case-study route and confirm the public relationship display remains governed by the case study's published status.
6. Verify editor save access and reviewer read-only behavior before considering the slice ready for promotion.

Do not run this migration or promote relationship changes in Production during this milestone.
