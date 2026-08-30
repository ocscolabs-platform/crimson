# OCSCO Crimson — Work Library Case Study Preview Foundation

**Batch:** 3C1
**Scope:** STAGING-only implementation; shared Work detail presentation and authenticated Draft/Review Preview only.

## Implementation result

The existing public Work detail presentation was extracted into `src/components/work-detail-view.tsx`. The public `/work/[slug]` route still loads through `getPublishedWorkProject(slug)` and now delegates only its unchanged presentation to the shared component. No public loader bypass, public preview flag, or public Work route change was introduced.

The authenticated Preview route is:

```text
/crimson-admin-control/case-studies/[slug]/preview
```

It uses `getAuthenticatedCaseStudyPreview()` in `src/lib/case-study-preview.ts`, which authenticates through the server Supabase client, resolves the existing CMS membership, reuses `getAdminCaseStudyReview()` for the case-study/revision merge, and accepts only an active Draft or Review revision bound to the requested case study. It returns the existing `WorkProject` view-model shape.

## Authorization and isolation

- Existing owner, editor, and legacy reviewer CMS read access is preserved; no role, capability, Team & Access, or RLS change was made.
- The loader rejects unauthenticated users, invalid slugs, missing active revisions, and non-Draft/Review revision states.
- Revision loading remains bound by `entity_type = case_study` and the case-study ID inside the existing admin helper.
- Related services are filtered to published services and use the active revision `service_ids` when present.
- Draft/Review media is resolved through the existing authenticated admin helper's short-lived Supabase Storage signed URLs; no private bucket was made public.
- Existing hidden/anonymized client-visibility behavior is preserved. Hidden records do not expose the project name, external URL, or identifiable public description in the Work-shaped Preview model.
- The Preview route is request-time, no-store, no-index, no-archive, and read-only. It does not save, publish, update, delete, or mutate relationships/media.
- Anonymous `/work/[slug]` remains governed by the published-only Supabase case-study policy. Draft/Review rows are not available through the public loader.

The Case Study editor Preview button was deliberately not added; that belongs to Batch 3C2.

## Focused checks

- `npm run test:batch3c1:case-study-preview` — 10 focused assertions passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed with three pre-existing warnings and no errors.
- `npm run build` — passed; the new authenticated Preview route is dynamic and present in the route manifest.
- `npm run validate:migrations` — passed; no migration was added.
- `git diff --check` — passed.

## Release status

Feature branch: `codex/batch-3c1-case-study-preview-foundation`.

Protected staging PR, merge, and authenticated staging Preview/public-isolation QA: pending.

Staging QA target: the existing disposable Batch 3B Draft `batch-3b-qa-disposable-20260830`; TooFarts is the fallback. Cairnstack must not be mutated.

## Explicit exclusions

No Case Study editor Preview control, new editor action, publish/media/relationship workflow change, schema migration, preview token/share link, Work redesign, New Case Study change, Scheduled Publishing, Cron/Vault, Insights, Team & Access, Pages/Services, Design Settings, staging alias, `main`, Production, or Cairnstack data change was made.
