# Phase 4 — Case Study CMS Workflow

**Status:** Privacy-safe renderer, audit coverage, media contract, and controlled editor implemented locally; case-study editor migration and workflow QA pending in staging

## Recommendation

Treat case studies as a higher-risk editorial surface than Services. They are public proof, not just capability copy: client identity, outcomes, testimonials, external links, and imagery can create privacy, legal, and credibility exposure. Keep the current read-only Work library while the approval model is finalized.

The current portfolio model supports one featured project plus a supporting grid. Five launch records is a strong starting set—one flagship and four supporting projects—with room to grow before filters or pagination become necessary.

## Current data model

| Group | Existing fields | Approval concern |
| --- | --- | --- |
| Identity | `project_name`, `slug`, `project_type`, `project_category` | Names and client identity need explicit approval. |
| Narrative | `summary`, `challenge`, `approach`, `deliverables`, `outcomes` | Claims must be factual, evidence-based, and owner-reviewed. |
| Public visibility | `client_visibility`, `status`, `published_at`, `last_reviewed_at` | These must work together; `published` alone must not imply client permission. |
| Presentation | `is_featured`, `sort_order`, `external_url` | Featured ordering and outbound links need owner control. |
| Media | `featured_image_path`, `featured_image_alt`, `supporting_media`, `media_status`, `media_reviewed_at` | Contract is defined; storage and upload workflow remain deferred. |
| Relationships | `case_study_services` | Related services must be valid and publicly published. |

## Proposed editorial flow

```text
Draft → Review → Published → Archived
             ↑         │
             └ revisions
```

- **Editor:** prepares narrative, relationships, and draft/review content. Cannot publish, archive, or approve client visibility.
- **Reviewer:** reads and comments through the review process; cannot mutate content.
- **Owner:** approves public identity/media, controls featured placement, publishes, archives, and restores approved snapshots.
- **Public renderer:** reads only published records and must redact or anonymize records whose client visibility is not approved.

## Publication checklist

Before an owner publishes a case study, staging must confirm:

- The slug is stable and the project type/category are correct.
- `client_visibility` is explicitly approved, or the public presentation is fully anonymized.
- The summary, challenge, approach, deliverables, and outcomes contain no fabricated proof.
- Metrics, testimonials, client names, logos, and recognizable project media have documented permission.
- External links are HTTPS, intentional, and tested.
- Featured imagery and supporting media have approved sources and accessible alternative text.
- Related services are valid and published.
- The owner has reviewed the final record and publication transition is recorded in audit history.

## Required gates before enabling editing

1. **Privacy-safe rendering:** implemented in the public Work mapper; hidden records use safe generic copy, omit external links, and do not receive internal detail links, while approved records retain their approved presentation.
2. **Case-study audit coverage:** implemented locally in `PHASE-4-CMS-CASE-STUDY-AUDIT.md`; apply and verify the staging migration before allowing mutations.
3. **Media contract:** implemented locally in [`PHASE-4-CMS-MEDIA-CONTRACT.md`](./PHASE-4-CMS-MEDIA-CONTRACT.md); apply and verify the staging migration before enabling uploads. Do not add arbitrary uploads to the first editor.
4. **Featured rule:** implemented with a partial unique index and deterministic public ordering; featured placement remains owner-controlled.
5. **Approval metadata:** `client_visibility`, `last_reviewed_at`, and media review metadata are in place for this slice; a separate permission reference remains deferred.

## Staging sequence

1. QA the privacy-safe Work rendering without adding editor access.
2. Apply and verify case-study and relationship audit coverage in staging.
3. Add a protected read-only case-study review panel. **Implemented and authenticated QA completed in staging preview.**
4. Apply and verify the media contract and featured-project migration in `crimson-staging`.
5. Apply and verify the update-only case-study editor migration in `crimson-staging`.
6. Keep case-study changes in staging until a real approved project record is reviewed; do not seed private facts or unapproved media.

## Out of scope for this gate

Media uploads, testimonials, client logos, CRM relationships, scheduled publishing, bulk edits, case-study creation/deletion, and Production case-study editing remain disabled.
