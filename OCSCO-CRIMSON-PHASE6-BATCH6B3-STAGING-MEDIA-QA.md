# OCSCO Crimson Phase 6 — Batch 6B3 Staging Media QA

Date: 2026-08-27 (Asia/Shanghai)

## Gate decision

**NO-GO for merging PR #86 at this time.** PR #86 remains OPEN and UNMERGED against `staging`. Production, `main`, and public `/insights` were not touched.

The migration, storage foundation, media authoring, Editor submission, Owner publication, Trusted Publisher self-publication, unpublish cleanup, security isolation, and automated regressions passed. Restore media preservation is not yet a live PASS: the current-head Preview contains the Restore implementation, but the available authenticated Owner session is on the older stable alias, which does not yet expose the Restore control. No auth bypass or direct impersonation was used.

## Pre-application and migration evidence

- PR #86: OPEN / UNMERGED; branch `codex/phase6-6b3-insights-media`; target `staging`.
- Current implementation head: `c9fbaaa` (`feat: expose owner media revision restore`).
- Current-head validation, Vercel Preview, and Vercel Preview Comments: PASS.
- Migration workflow run for `crimson-staging`: PASS; Production job skipped.
- Repository migration validator: 30 canonical migration files; latest is `20260828000000_add_phase6b3_insights_media_workflow.sql`.
- Direct staging verification: 30 applied migrations; migration #29 exactly once; migration #30 exactly once; no duplicate versions; latest migration #30.
- Migration #30 was additive and compatible with the merged B6B2 application. Its initial routine-parameter defect was corrected in the PR before the successful staging-only rerun.

## Storage, schema, and security foundation

PASS.

- Private canonical bucket and public published-artifact bucket exist; both enforce WebP media for this QA contract and a 2 MiB limit.
- `insights_media_assets`, `insights_revision_media`, and `insights_public_articles` exist and have RLS enabled.
- Authenticated reads are limited to authorized canonical media metadata and revision relations.
- Published projection and published artifact policies are public-read only where approved; canonical media remains private.
- Required media, publication, unpublish, restore, and alt-text routines are `SECURITY DEFINER` with the intended grants.
- Supabase Security Advisor after migration and after live QA: **0 errors**; 117 warnings and 1 informational suggestion remain unchanged from the project baseline.

## Live QA evidence

### Cover media

PASS for the completed authoring path. The staging-safe QA image was uploaded through the normal file picker, showed upload/status feedback, accepted meaningful alt text, rendered in private Preview, persisted through save/refresh, and rendered in Owner Review/Published state. Owner QA also verified Cover Remove and Cover replacement, with the replacement alt text persisted. Canonical metadata and storage objects were verified directly in staging.

### Inline media

PASS for the completed authoring path. Tiptap inserted the normalized inline image, retained opaque media identity rather than a signed/public URL, persisted alt text and caption, rendered after refresh in private Preview and Review, and exposed a working Remove control. Body version 2 handling and v1 text-only compatibility are covered by the automated contract tests.

### Private Preview and review

PASS. Authenticated Draft Preview rendered both Cover and inline media, showed the expected private/no-index boundary, and caused no workflow mutation. Review rendering remained read-only and showed Cover and inline media. No canonical signed URL was persisted as authoring identity.

### Editor journey

PASS. The temporary staging QA account was configured as a normal Editor with `insights_only` access and `can_publish_insights = false`. The complete valid Editor article reached Needs Review, became read-only, and exposed no Publish control. Owner review showed the expected media and metadata.

### Owner publication

PASS. Owner published the submitted Editor article. The published revision pointer, sanitized public projection, Cover artifact, inline artifact, category/tags, and workflow audit were verified directly in staging.

### Trusted Publisher

PASS. A separate article was created on the current-head Preview and self-published by a Trusted Publisher session. The article was owned by that session, included Cover media, and produced a published revision/projection as expected. The temporary account's elevated publish capability was reverted immediately afterward.

### Unpublish cleanup

PASS. Owner unpublish succeeded for the controlled Editor and Trusted Publisher QA articles. For the Trusted Publisher article, direct staging evidence showed: `unpublished` status, no public projection, zero published revisions, zero ready public artifacts, one removed public artifact, zero published storage objects, and preserved revision/audit history. The Editor article retained its historical Published revision and audit trail while its projection and public artifacts were removed.

### Restore

BLOCKED / not a live PASS. The current-head deployment contains the Owner Restore implementation and automated Restore contracts pass. The current-head preview is authenticated only as the temporary Trusted Publisher, while the authenticated Owner session is on the stable branch alias that predates the Restore UI commit. Restore was not executed through an Owner UI session, and no direct auth impersonation or SQL-side simulation was used.

### Anonymous/private isolation

PASS. Direct staging checks confirmed that private canonical media and private editorial data are not anonymously readable, while approved published projection/artifacts are public-read. No signed URL or credential is included in this report.

## Responsive and accessibility QA

The Owner manually approved the authenticated workflow at exactly 1440×900, 768×1024, and 390×844. The review covered media controls, alt fields, Tiptap controls, Preview, workflow controls, horizontal overflow, and mobile completion.

## Automated regressions

PASS. The following completed successfully on the final PR head:

- migration validation;
- Phase 5 authority/application/Restore/Preview contracts;
- Phase 6A foundation;
- public projection security;
- B6B1 slug and authoring contracts;
- B6B2 workflow contracts;
- B6B3 media contract;
- typecheck;
- build;
- `git diff --check`.

Lint completed with 0 errors and three existing warnings: one unused audit-script variable and two intentional private-runtime `<img>` warnings.

## QA account cleanup

The temporary staging QA account was not used in Production and no credential was written to source control or this report. Its `cms_member_access` record remains for history, with role `editor` and scope `insights_only`, while `insights_access = false` and `can_publish_insights = false` now revoke usable application access. QA articles, revisions, media metadata, and workflow audit history were preserved.

## Remaining Published fake staging articles

Three pre-existing Phase 6 staging QA articles remain Published and were not indiscriminately deleted:

- `Editor Draft Complete`
- `Publisher Draft`
- `Post-merge TP Smoke`

The two B6B3-controlled QA publications were Owner-unpublished.

## Required follow-up before GO

Obtain an authenticated Owner session on the current-head PR Preview, execute and verify Restore of a historical Published revision, confirm the restored Draft Cover/inline media remains private and no public artifact is reactivated, then rerun the final Security Advisor and affected validation checks. Keep PR #86 open and unmerged until that evidence is complete.
