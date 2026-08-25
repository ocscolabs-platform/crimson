# OCSCO Project Crimson — Work Package A / Batch 3C

## Restore confirmation state-reset correction

Date: 2026-08-25  
PR: [#74](https://github.com/ocscolabs-platform/crimson/pull/74)  
Correction branch: `codex/phase5-wpa-batch3c-restore-ui-reset`  
Base: `staging`

## Result

**PASS — correction implemented and Feature Preview QA passed.**

The correction is limited to the local Restore control lifecycle. No Restore, Publish, migration, Supabase schema, Production, `main`, or broad UI change was performed.

## Exact root cause

`PageDocumentRestoreControl` used `useActionState(restorePageDocument, initialState)`. After a successful server action, the action state remained `status: "success"` across `router.refresh()` because the client component was not remounted. The confirmation markup was additionally gated by:

```tsx
confirmationOpen && state.status !== "success"
```

Therefore a subsequent click set `confirmationOpen` to `true`, but the dialog still rendered nothing. The local success/submission state also had no explicit success/error reset lifecycle. This was a client-state issue; the Restore RPC and database state were correct.

## Correction

- Confirmation visibility is controlled by the local confirmation state, not stale success state.
- Successful action results trigger the existing authoritative `router.refresh()` and a deferred, cancellable local reset that closes the dialog, releases the submission lock, and exposes the success message.
- `state.revisionId` is included in the effect dependencies so a later successful Restore is treated as a new result even though the status string remains `success`.
- Completed failures release the local submission lock and keep the safe error path retryable.
- Opening a new confirmation clears the prior success message.
- Pending disabled state, rapid-repeat protection, Owner-only authorization, confirmation copy, and backend authority remain unchanged.

## Changed files

1. `src/app/admin/content/pages/_components/PageDocumentRestoreControl.tsx`
2. `scripts/test-phase5b-wpa-batch3c-restore-ui-reset.mjs`
3. `package.json`
4. `OCSCO-CRIMSON-WPA-BATCH3C-RESTORE-UI-RESET-FIX.md`

No migration or backend SQL file changed.

## Regression coverage

The focused UI reset suite passed **3/3**:

- Successful lifecycle: `idle → confirmation → pending → success → refreshed idle`; an eligible Restore can be opened again without a browser reload.
- Failure lifecycle: `idle → confirmation → pending → failure → retryable idle`.
- Repeat safety: a rapid second submission remains blocked while the first request is pending.

Existing Batch 3C Restore tests passed **6/6**.

## Validation

- Batch 3A backend contract tests: **5/5 passed**.
- Batch 3A application tests: **6/6 passed**.
- Batch 3B Publish tests: **4/4 passed**.
- Batch 3C Restore tests: **6/6 passed**.
- New Restore UI reset tests: **3/3 passed**.
- Migration validation: **26 canonical migration files passed**.
- Typecheck: **passed**.
- Lint: **passed** with one pre-existing warning in `scripts/audit-supabase-drift.mjs` (`expectedColumn` unused).
- Production build: **passed**.
- `git diff --check`: **passed**.

## Feature Preview QA

Preview: `https://ocsco-project-crimson-git-c-13e6e9-ocscolabs-platforms-projects.vercel.app/crimson-admin-control/content/pages/home`

Read-only Owner QA passed:

- Current Published row: no Restore control.
- Eligible Archived rows: Restore control present.
- Restore confirmation opened with the historical-version, public-isolation, active-editorial-archival, new-Review, and later-Publish warnings.
- Cancel was reachable and closed the dialog.
- Zero Restore submissions; staging data remained unchanged.

Responsive re-test was not required because this correction changes no layout or CSS. Existing responsive acceptance remains 1440×900, 768×1024, and 390×844 PASS.

## Staging and Production safety baseline

Before merge, the authenticated staging state remained:

- Current Published revision: `4d552d8b-b231-4ebd-98cc-882c10d20bfb`.
- Private Draft: `ee403deb-cca6-4998-bcbe-44b5b0e198e0`.
- Staging public headline: `Digital infrastructure, built with precision.`
- No live Restore or Publish was performed for this correction.

Post-merge verification must confirm those values remain unchanged, migrations remain 26/26, and `main`, Production Supabase, Vercel Production, and `www.ocsco.io` remain untouched.

## Gate recommendation

PR #74 is ready to merge into protected `staging` only while all required checks remain green and the exact diff remains the four files listed above. After merge, perform read-only staging verification and stop. The final same-page live Restore reset acceptance remains the next Owner/ChatGPT authorization gate.
