# OCSCO Project Crimson — Work Package A / Batch 3A

## Application/editorial workflow implementation report

Status: PASS for implementation and validation; STOPPED before merge as authorized.

## Release boundary

- Base: `staging` at `5163e31dbed22df9f195558c284585b0cea77e77`.
- Feature branch: `codex/phase5-wpa-batch3a-application`.
- Final implementation commit before this report: `b6b9778bc0edc5bb2adec84f501fe2a5fdf386c2`.
- Pull request: [#70](https://github.com/ocscolabs-platform/crimson/pull/70), base `staging`.
- No merge was performed.

Migration #26 remains unchanged. The repository still contains 26 canonical migration files; the qualified migration blob remains `b5feb8bfd9663c8212432c554834378808e6ad38`.

## Implemented scope

The PageDocument application surface now supports only `home`, `services`, `about`, and `contact` through the canonical PageDocument adapters.

- Save Draft calls `cms_page_document_save_draft(text, jsonb)`.
- Submit for Review calls `cms_page_document_submit_for_review(text, uuid)`.
- Return to Draft calls `cms_page_document_return_to_draft(text, uuid)`.
- Review revisions render through immutable read-only panels.
- Owner and Editor can save Drafts, submit Drafts for Review, and return Reviews to Draft.
- Reviewer access is read-only and exposes no transition control.
- Revision history is newest-first and marks the `pages.published_revision_id` Published pointer.
- Workflow audit events are shown newest-first with status transitions and revision identity.
- Server actions use safe user-facing errors and do not expose raw database error text.
- Publish, Restore, authenticated Preview, and their server actions are absent from this application slice.
- Work and all non-approved page keys remain excluded.

## Authority and isolation

- The authenticated PageDocument read model resolves Published identity from `pages.published_revision_id`; it does not select an arbitrary current revision as Published.
- The public loader remains Published-only and does not read Draft or Review content.
- Public smoke checks passed for `/`, `/services`, `/about`, and `/contact` on the feature Preview.
- The Homepage public headline remained `Digital infrastructure for brands ready to move with precision.`
- The protected Homepage Draft `4d552d8b-b231-4ebd-98cc-882c10d20bfb` was not transitioned or mutated. Read-only staging verification returned status `draft` and headline `Digital infrastructure, built with precision.`
- No Production setting, Vercel setting, Supabase schema, migration, environment variable, or GitHub repository setting was changed.

## Changed files

- `package.json` — focused application workflow test script.
- `src/app/admin/content/pages/actions.ts` — dedicated Save/Submit/Return server actions.
- `src/app/admin/content/pages/_components/PageDocumentWorkflowControls.tsx` — role-aware transition controls.
- `src/app/admin/content/pages/[pageKey]/page.tsx` — immutable Review UI, Published read-only panel, history, and audit presentation.
- `src/lib/admin-page-documents.ts` — pointer-authoritative Published read model, revision history, and workflow audit reads.
- `src/app/globals.css` — workflow and history presentation styles.
- `scripts/test-phase5a-application-workflow.mjs` — focused static contract and isolation tests.

No migration file changed.

## Validation

Passed:

- `npm run typecheck`
- `npm run lint` — zero errors; one pre-existing warning in `scripts/audit-supabase-drift.mjs`.
- `npm run build`
- `npm run validate:migrations`
- `npm run test:phase5a:application` — 6/6 passed.
- `node --test scripts/test-phase5a-backend-contract.mjs` — 5/5 passed.
- GitHub required validation check — passed.
- Vercel check and Vercel Preview Comments — passed.

The broader legacy runtime test batch was attempted. Eight existing tests could not initialize in this Windows workspace because their pre-existing Jiti alias uses an encoded `%20` path for this space-containing repository directory. The failures occurred during module resolution before test execution; no application assertion failure was reported. The static authority checks and new application workflow suite pass.

## Preview QA

Feature Preview: [ocsco-project-crimson-j2qmjhkwv-ocscolabs-platforms-projects.vercel.app](https://ocsco-project-crimson-j2qmjhkwv-ocscolabs-platforms-projects.vercel.app)

- `/` — passed; published Homepage headline unchanged.
- `/services` — passed.
- `/about` — passed.
- `/contact` — passed.
- `/crimson-admin-control/content/pages/home` — protected login boundary present without mutation.

Vercel classified the feature deployment as Preview. Production remains bound to `main`; no Production deployment or domain change was triggered.

## Recommended next step

After PR #70 receives owner review and is merged into protected `staging`, perform the controlled staging acceptance test with synthetic content or a non-protected test record. Verify Save Draft → Submit for Review → immutable Review → Return to Draft, the role matrix, audit markers, public isolation, and the unchanged protected Homepage Draft. Do not begin Publish/Restore, 3B/3C, or application/UI expansion in this acceptance step.

