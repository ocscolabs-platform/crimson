# Phase 4 - Case-study media contract

**Status:** Contract implemented locally; staging migration and verification pending

## Purpose

Case-study media is public proof, so it must have a predictable storage path, accessible alternative text, and an explicit review state before an upload or editor surface is enabled. This contract prepares the boundary without creating a bucket, exposing upload controls, or allowing case-study mutations.

## Approved record shape

The `case_studies` record uses these fields:

| Field | Rule |
| --- | --- |
| `featured_image_path` | Optional relative path under `case-studies/<slug>/`; allowed extensions are `avif`, `webp`, `jpg`, `jpeg`, and `png`. Absolute URLs are not allowed. |
| `featured_image_alt` | Required meaningful text of at least eight characters when a featured image exists. It must be null when no featured image exists. |
| `supporting_media` | JSON array of image objects only. Each object requires `path`, `alt`, and may use `media_type: image` and `approval: pending|approved`. |
| `media_status` | `pending`, `approved`, or `rejected`; defaults to `pending`. `approved` requires a featured image and valid alt text. |
| `media_reviewed_at` | Optional timestamp recorded when an owner reviews the media package. |

Example supporting item:

```json
{
  "path": "case-studies/cimet-law/supporting-01.webp",
  "alt": "Approved interface detail from the CIMET Law project",
  "media_type": "image",
  "approval": "pending"
}
```

## Editorial and storage rules

- Store project media under a case-study-specific relative path; do not use arbitrary remote image URLs.
- Keep client names, logos, recognizable interfaces, testimonials, and metrics hidden until the owner confirms permission and factual accuracy.
- `media_status = approved` means the complete featured-media package passed owner review; it does not itself grant client visibility.
- Media removal must be an explicit owner-controlled workflow and must create an audit record before a future storage delete is considered.
- Retain approved media while the related published or archived record requires it. No automatic deletion is introduced in this milestone.
- Storage bucket choice, upload limits, transformations, image optimization, and deletion UI remain deferred until the write workflow is approved.

## Featured-project rule

There may be at most one record where `is_featured = true` and `status = 'published'`. The database enforces this with a partial unique index. Public and admin queries use `is_featured desc`, `sort_order asc`, and `created_at asc` for deterministic ordering. Featured placement remains an owner-controlled decision; no new case-study write policy is introduced here.

## Staging verification

Apply `supabase/migrations/20260820080000_add_staging_case_study_media_contract.sql` in `crimson-staging` only. Then run:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'case_studies'
  and column_name in ('featured_image_alt', 'media_status', 'media_reviewed_at')
order by column_name;

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'case_studies'
  and indexname = 'case_studies_one_published_featured_idx';

select count(*) as published_featured_count
from public.case_studies
where status = 'published'
  and is_featured = true;
```

The current staging seed should return three new columns, the partial unique index, and a featured count of `1`.

Do not run this migration in Production. Do not add media or enable case-study editing until the owner approves the contract and the first real project asset.
