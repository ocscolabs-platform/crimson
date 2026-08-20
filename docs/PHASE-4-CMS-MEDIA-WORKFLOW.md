# Phase 4 — Controlled case-study media workflow

**Status:** Implemented locally; staging migration and upload QA pending

## Scope

This slice adds a narrow media workflow to the existing update-only case-study editor. It supports owner-uploaded project images for existing staging records. It does not create case studies, delete records, edit relationships, or open Production administration.

The storage bucket is private by default. A public image URL is available only when the attached case study is published and its complete media package is approved.

## Role boundary

| Role | View media package | Upload media | Approve media package |
| --- | --- | --- | --- |
| owner | Yes | Yes | Yes |
| editor | Yes | No | No |
| reviewer | Yes | No | No |

## Upload rules

- Images only: AVIF, JPEG, PNG, or WebP as source files.
- Maximum source file size: 2 MB per upload.
- The server rotates, resizes to a maximum 2400px edge, and converts each source file to WebP quality 82 before storage.
- Maximum final WebP size: 2 MB. Objects are stored under `case-studies/{slug}/` with a generated `.webp` filename.
- Featured media requires meaningful alternative text.
- Supporting media requires meaningful alternative text and is initially marked `pending`.
- Replacing a file creates a new object; automatic deletion is not performed.
- Uploading or approving media for a published record requires moving that record to Review first.

## Approval boundary

The owner can approve the media package after the featured asset and alternative text are present. Approval marks supporting items as approved, records `media_reviewed_at`, and keeps the database trigger as the final validation boundary. Approval does not publish a case study or approve client identity.

## Staging rollout

1. Apply `supabase/migrations/20260820120000_add_staging_case_study_media_workflow.sql` in `crimson-staging` only.
2. Open a non-featured staging record such as `cairnstack` as the owner.
3. Move the record to Review before uploading a test image.
4. Upload one featured image with descriptive alt text and confirm the success toast and preview.
5. Optionally upload one supporting image, then approve the media package.
6. Confirm the review checklist changes to Approved while the case study remains governed by its existing publication and client-visibility rules.
7. Do not run this migration or upload staging assets in Production.

## Deferred

Case-study creation/deletion, relationship editing, batch media management, asset cleanup, transformations, comments, and CRM integrations remain separate milestones.
