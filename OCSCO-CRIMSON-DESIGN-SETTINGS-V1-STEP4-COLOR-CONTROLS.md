# OCSCO Crimson — Design Settings v1 — Batch 4B1
# CMS Color Controls

## Scope

Batch 4B1 exposes the eight approved public color tokens in the existing
Crimson Global Content surface. The implementation does not add a settings
platform, a new publication system, a migration, or a public preview pane.

## Implementation

- Added a `Design Settings` entry point to the existing CMS dashboard and a
  `Design Settings → Colors` section in Global Content.
- Added exactly eight controls: Ink, Graphite, Green / Accent, White,
  Snow / Background, Muted, Border / Divider, and Copy / Body Text.
- Each field combines a native color swatch with a synchronized seven-character
  input containing a six-digit hex value. Values are lower-cased before save.
- Unsupported fields, alpha/transparency, gradients, CSS functions, and custom
  picker dependencies were not added.
- The server action validates the complete v1 document with the existing
  `validateDesignSettingsV1` contract and rejects malformed values with a clear
  message.

## Revision and publication behavior

Color saves call the existing `cms_save_revision` path for
`site_settings:default` with only the validated `design_settings` payload.
The database revision merge therefore preserves the other active editable
values and any existing Draft/Review state rather than rebuilding from
published defaults. The existing Owner-only `cms_publish_revision` action
remains the publication path, so saving colors does not alter the public site.

The existing Design Settings storage validator remains authoritative at
publication time. No roles, capabilities, Team & Access behavior, or admin
theme behavior changed.

## Local verification

- `npm run test:batch4b1:color-controls` — 6/6 passed.
- `npm run test:batch4a1:design-settings` — 7/7 passed.
- `npm run test:batch4a2:design-settings-runtime` — 6/6 passed.
- `npm run test:batch4a4:admin-isolation` — 6/6 passed.
- `npm run test:batch3c1:case-study-preview` — 10/10 passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run lint` — passed with three pre-existing warnings and zero errors.
- `git diff --check` — passed.

## Staging verification

The protected staging PR and authenticated temporary-green publication test
are recorded here after the PR is merged. The staging test must restore the
original approved green value before completion.

## Release boundary

- Target: `staging` only.
- `main` untouched.
- Production untouched.
- No Cairnstack, Work Library, Insights, Scheduled Publishing, Cron, Vault,
  Team & Access, Pages / Services, or staging alias changes.
