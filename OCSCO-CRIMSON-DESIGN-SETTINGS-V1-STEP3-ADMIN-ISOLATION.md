# OCSCO Crimson — Design Settings v1 — Batch 4A4
# Crimson Admin Color Token Isolation

## Scope

Batch 4A4 isolates the Crimson CMS interface from future public Design Settings
color changes. This is a CSS-only boundary; it adds no storage, migration,
admin theme configuration, or public runtime behavior.

## Implementation

Normal CMS and login surfaces use the existing `.admin-page` root. The CSS
boundary `.admin-page:not(:has(.insights-preview-banner))` resets the eight
approved public variables to the immutable Batch 4A1 defaults:

- `--ink: #0a0a0a`
- `--graphite: #1a1a1a`
- `--green: #00c853`
- `--white: #ffffff`
- `--snow: #f7f7f7`
- `--muted: #9e9e9e`
- `--border: #e8e8e8`
- `--copy: #505050`

The login surface already uses `.admin-page admin-login-page`, so it needs no
separate root or component changes.

Authenticated public-content Preview remains public-themed. Page Preview and
Case Study Preview use `RouteShell` without `.admin-page`. Insights Preview
retains its existing `.admin-page` wrapper but is excluded by its existing
`.insights-preview-banner` marker. No Preview loader, route, or presentation
component was changed.

## Verification

Local focused checks:

- `npm run test:batch4a4:admin-isolation` — 6/6 passed.
- `npm run test:batch4a2:design-settings-runtime` — 6/6 passed.
- `npm run test:batch4a1:design-settings` — 7/7 passed.
- `npm run test:batch3c1:case-study-preview` — 10/10 passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run lint` — passed with three pre-existing warnings and zero errors.
- `git diff --check` — passed.

Staging integration and focused browser verification are recorded below after
the protected staging PR is merged.

## Release boundary

- Target branch: `staging` only.
- `main` untouched.
- Production untouched.
- No Design Settings values or staging data modified.
