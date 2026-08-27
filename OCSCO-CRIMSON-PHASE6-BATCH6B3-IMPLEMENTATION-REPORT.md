# OCSCO Crimson Phase 6 — Batch 6B3 Implementation Report

## Implementation summary

Batch 6B3 adds the Insights media and complete editorial workflow boundary on top of the approved staging baseline. The implementation is limited to the authenticated Crimson CMS and does not add public `/insights` routes, Phase 7 work, `main`, or Production changes.

- Adds additive migration #30: `20260828000000_add_phase6b3_insights_media_workflow.sql`.
- Adds dedicated private buckets: `insights-private-media` for canonical media and `insights-published-media` for exact Published-revision artifacts.
- Adds server-trusted JPEG, PNG, WebP, and AVIF validation, magic-byte checks, Sharp normalization to WebP, EXIF rotation/stripping, 2400px maximum edge, and 2 MB source/output limits.
- Adds Cover and inline media authoring, meaningful alternative text, optional captions, replacement/removal, private signed Preview URLs, and opaque media IDs in the v2 body contract.
- Preserves v1 body compatibility and strips resolved `src` values before Draft persistence.
- Extends Submit, Owner Publish, Trusted Publisher own-Draft Publish, Unpublish, and Restore so media validation, exact public artifacts, cleanup, and canonical history are authoritative.
- Adds sanitized public projection integration and a read-only staging verification query.

## Source control and release boundary

- Branch: `codex/phase6-6b3-insights-media`
- Commit: `57d6f693f5b305f2411ab2ae00bae2c419821f29`
- Pull request: [#86 — Phase 6 B6B3: Insights media and complete editorial workflow](https://github.com/ocscolabs-platform/crimson/pull/86)
- Target: `staging`
- PR state: Open and intentionally unmerged.
- Current-head GitHub `validate`: PASS.
- Vercel preview: deployed; preview feedback reports no unresolved comments.

Migration #30 has not been applied to `crimson-staging`. No B6B3 Storage buckets, media rows, article rows, public artifacts, or QA test rows were created in staging by this task. Production was not touched.

## Local and CI validation

PASS:

- `npm run validate:migrations` — 30 canonical migration files; migrations 1–29 preserved.
- `npm run test:phase6b3:media` — 6/6.
- Phase 5 application/authority/restore/Preview regressions — PASS.
- Phase 6A foundation, Phase 6 public projection security, Phase 6B1 slug/authoring, and Phase 6B2 workflow regressions — PASS.
- `npm run typecheck` — PASS.
- `npm run build` — PASS.
- `npm run lint` — PASS with two warnings only: the pre-existing drift-audit unused variable and the intentional editor `<img>` optimization warning.
- `git diff --check` — PASS before commit.
- PR #86 current-head `validate` — PASS.

## Codex browser QA

The deployed PR preview loaded the CMS sign-in gate. The available signed-in browser session is scoped to the existing staging/Supabase surfaces and is not authenticated on the PR preview host. No credentials were entered, no personal files were uploaded, and no attempt was made to bypass authentication.

| QA case | Result | Evidence / limitation |
| --- | --- | --- |
| Cover upload, validation, normalization, replace/remove | BLOCKED | Requires authenticated PR-preview session and migration #30 applied. |
| Inline upload, insert, alt text, remove | BLOCKED | Requires authenticated PR-preview session and migration #30 applied. |
| Authenticated private Preview | BLOCKED | Requires authenticated PR-preview session and media schema. |
| Editor Draft → Submit for Review | BLOCKED | Requires authenticated Editor session and live B6B3 RPCs. |
| Owner Review → Publish | BLOCKED | Requires live migration #30 and Owner review data. |
| Trusted Publisher own-Draft self-publish | BLOCKED | Requires the approved staging QA Editor/capability session and live migration #30. |
| Public artifact lifecycle and Unpublish cleanup | BLOCKED | No live B6B3 artifacts were created; no cleanup mutation was run. |
| Anonymous/private media isolation | STATIC PASS | Covered by migration contracts and CI; live B6B3 storage policies are pending migration application. |
| Responsive authenticated authoring at 1440×900, 768×1024, 390×844 | BLOCKED | The authenticated authoring surface could not be reached in the PR-preview session. |

## Security and regressions

The implementation keeps Storage writes server-trusted, grants no direct browser insert/update/delete path for the new media metadata tables, restricts private canonical reads to authorized authenticated members, and exposes published artifacts only through the projection-backed public storage policy. The public projection remains SELECT-only and `security_invoker` compatible.

The existing live `crimson-staging` baseline had 0 Security Advisor errors after the prior B6B2/security gate. A new live Security Advisor result for B6B3 cannot be claimed because migration #30 is intentionally not applied in this PR.

## Blocker and Owner decision

Blocker: Owner must review and merge PR #86 through the protected `staging` path, apply migration #30 through the normal staging workflow, and provide/enable the authenticated staging QA path before the B6B3 functional and responsive browser matrix can be completed.

GO/NO-GO for Owner review: **NO-GO for final B6B3 acceptance; GO for code/PR review only.** The code and CI gates are ready for review, but live media/workflow QA is not complete and the PR remains unmerged as required.

STOP: Do not merge this PR, apply migration #30 manually, touch `main` or Production, or expose any QA credentials in source control or reports.
