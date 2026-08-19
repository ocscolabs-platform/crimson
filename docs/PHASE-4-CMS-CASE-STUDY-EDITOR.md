# Phase 4 - Controlled case-study editor

**Status:** Implemented locally; staging migration and workflow QA pending

## Scope

The first case-study write slice is intentionally update-only. It allows existing staging records to be prepared for review without adding creation, deletion, media upload, relationship editing, or Production access.

| Role | Read case studies | Update draft/review | Change client visibility | Publish/archive |
| --- | --- | --- | --- | --- |
| owner | All staging records | Yes | Yes | Yes |
| editor | Draft, review, and published | Draft and review only | No | No |
| reviewer | Draft, review, and published | No | No | No |

## Editable fields

The form covers project name, project type, category, HTTPS external URL, summary, challenge, approach, deliverables, outcomes, and editorial status. Deliverables and outcomes are entered one item per line and stored as JSON arrays.

The editor displays but does not mutate featured placement, media paths, media approval state, supporting media, or service relationships. Those remain separate owner-controlled workflows.

## Safeguards

- Supabase RLS is the final authorization boundary.
- No insert or delete grant is added.
- Owners alone can publish or archive.
- Editors can only keep records in draft or review.
- Published content must move to review before content changes or republishing.
- Only owners can change client visibility from hidden/anonymized to approved.
- External URLs must use HTTPS.
- Existing audit triggers record every successful update.
- The media trigger and featured-project unique index remain active.

## Staging rollout

1. Apply supabase/migrations/20260820090000_add_staging_case_study_editor_policies.sql in crimson-staging only, after the audit and media-contract migrations.
2. Push the staging branch and wait for Vercel.
3. Sign in as the staging owner and open /admin/case-studies/membership-portal for the first non-featured workflow test.
4. Move the record to review, change one non-sensitive field, and save. Confirm the success message, the public record is no longer published, and a case-study audit entry appears.
5. Publish the reviewed record again as the owner. Confirm published_at is restored and the public record returns.
6. Do not test with client facts, private media, or the Production environment.

The case-study editor remains in staging until the owner reviews the workflow and approves the next media/relationship slice.
