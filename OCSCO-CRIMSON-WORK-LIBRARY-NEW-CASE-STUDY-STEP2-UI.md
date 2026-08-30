# OCSCO Crimson — Work Library Batch 3B Minimal Creation UI

**Scope:** STAGING-only implementation; no Preview or Publish changes

## Entry-point implementation

The existing Work Library panel now shows `+ New Case Study` only when the current CMS role is `owner` or `editor`. It links to the dedicated minimal creation route and uses the existing CMS button styling. Reviewers and read-only members receive no creation control.

## Create-form implementation

Added `/crimson-admin-control/case-studies/new` with one required input: `Project name`. The form does not request project type, category, URL, narrative, media, services, visibility, or featured status. `AdminSubmitButton` supplies the existing pending state and prevents repeat submission while the action is in flight.

## RPC/server-action result

The server action authenticates the caller, preserves the Owner/Editor UI gate, validates the name length, invokes the existing `cms_create_case_study` RPC, and converts RPC failures to a generic retryable message. It performs no direct browser INSERT and does not expose raw database errors to the author.

## Redirect/editor result

On a successful RPC response, the action uses the returned final slug and redirects to `/crimson-admin-control/case-studies/{slug}`. No second editor was created. The existing dynamic Case Study editor remains unchanged and is the destination for the new private Draft.

## Focused tests and validation

- `npm run test:batch3a:case-study-create` — passed.
- `npm run test:batch3b:case-study-create` — 4 focused UI/server-action assertions passed.
- `npm run lint` — passed with three pre-existing warnings and no errors.
- `npm run typecheck` — passed.
- `npm run build` — passed with the new `/admin/case-studies/new` route.
- `npm run validate:migrations` — passed.
- `git diff --check` — passed.

The focused assertions cover Owner/Editor-only entry-point gating, Reviewer exclusion, one-field form scope, pending protection, RPC reuse, generic error handling, existing-editor redirect, and absence of direct INSERT/UI workflow expansion.

## Release status

Feature branch: `codex/batch-3b-case-study-create-ui`

Protected staging PR, merge, and authenticated staging CMS QA: pending.

QA data plan: create a clearly identifiable disposable staging Draft after deployment; do not touch Cairnstack. No safe delete path is assumed, so any retained Draft will be reported rather than deleted through an invented mechanism.

## Explicit exclusions

No Case Study Preview route, Publish change, workflow state, media or relationship change, Work redesign, template, clone, bulk action, Scheduled Publishing, Cron/Vault, Insights, Team & Access, Pages/Services, Design Settings, staging alias, `main`, or Production change was made.

