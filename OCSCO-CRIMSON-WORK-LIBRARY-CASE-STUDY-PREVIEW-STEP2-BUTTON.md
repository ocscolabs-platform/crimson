# OCSCO Crimson — Case Study Preview Button

**Batch:** 3C2
**Scope:** STAGING-only UI hookup to the verified authenticated Case Study Preview route.

## Implementation

The existing Case Study editor now shows a `Preview` link beside the current record status. It navigates to:

```text
/crimson-admin-control/case-studies/{slug}/preview
```

The link reuses the existing Crimson button styling and the record's final slug. No Preview route, loader, shared Work presentation, workflow, media, relationship, authorization, or public loader behavior was changed.

## Visibility rule

The control is rendered only when:

- the record has an active revision ID;
- that revision is `draft` or `review`; and
- the existing CMS member role is `owner`, `editor`, or legacy `reviewer`.

The backend Preview authorization remains authoritative. Records without an active Draft/Review revision do not receive a link that would return 404.

## Validation

- `npm run typecheck` — passed.
- `npm run lint` — passed with three pre-existing warnings and no errors.
- `npm run build` — passed; the existing dynamic Preview route remains present.
- `npm run test:batch3c1:case-study-preview` — 10 focused assertions passed.
- `git diff --check` — passed.

## Release status

Feature branch: `codex/batch-3c2-case-study-preview-button`.

Staging PR and post-merge verification are pending. The required QA target is the existing disposable Draft `batch-3b-qa-disposable-20260830`; Cairnstack is excluded.

## Explicit exclusions

No Preview backend change, editor redesign, New Case Study change, Scheduled Publishing, Cron/Vault, Insights, Team & Access, Pages/Services, Design Settings, staging alias, `main`, Production, or Cairnstack data change was made.
