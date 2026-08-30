# OCSCO Crimson — Design Settings v1 — Batch 4A2 Runtime CSS Variable Boundary

**Status:** Implemented on the staging-targeted feature branch; staging integration and verification pending
**Scope:** Public runtime token wiring only
**Environment boundary:** No Production action or data change; no Design Settings CMS controls

## Shared theme-boundary implementation

The existing root Next.js layout is the smallest reliable server-rendered boundary for the public application. It now loads the normalized published Design Settings v1 document and emits one inline style object on the root `<html>` element.

`getPublishedSiteSettings` is request-deduplicated so the root boundary and existing public loaders share one published settings read during a request. No per-component runtime style objects were added.

## Token-to-CSS-variable mapping

The mapping is exact and allowlisted:

| Published token | CSS custom property |
| --- | --- |
| `ink` | `--ink` |
| `graphite` | `--graphite` |
| `green` | `--green` |
| `white` | `--white` |
| `snow` | `--snow` |
| `muted` | `--muted` |
| `border` | `--border` |
| `copy` | `--copy` |

The mapper normalizes its input before emitting variables and can emit no unknown property. Typography, spacing, effects, or arbitrary CSS are not represented.

## Fallback/default behavior

The existing immutable Batch 4A1 defaults remain the source of truth when settings are absent, malformed, partial, or unavailable. `src/app/globals.css` retains all current `:root` values unchanged, so the static defaults remain available underneath the server-rendered overrides.

## Preview and public-route behavior

Authenticated previews that intentionally render the public presentation naturally inherit the same root boundary. No separate Preview theme storage or Draft Design Settings path was added. Public route loaders, selectors, classes, Work presentation, Insights workflow, and admin controls remain unchanged.

## Focused verification

Passed locally:

- `npm run test:batch4a2:design-settings-runtime` — 6/6.
- `npm run test:batch4a1:design-settings` — 7/7.
- `npm run test:batch3c1:case-study-preview` — 10/10.
- `npm run validate:migrations` — passed.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `npm run lint` — passed with three pre-existing warnings and no errors.

The local test suite checks one-to-one token mapping, default and malformed fallback, unknown-variable rejection, root-boundary placement, request deduplication, unchanged selectors, unchanged static defaults, and absence of Design Settings admin controls.

## Visual parity expectation

The runtime values equal the existing `globals.css` values by default. The intended visual result is zero change on the homepage, RouteShell pages, Work, Insights, and authenticated public-presentation Preview. No responsive or unrelated UI polish was performed.

## Staging verification

Pending protected PR integration. Verify on the exact merged staging Preview that the root contains the eight variables with current default values, public routes remain visually unchanged, authenticated public-presentation Preview remains functional, and no Design Settings CMS control exists.

## Production/main boundary

No merge to `main`, Production deployment, Production data access, or Production configuration is permitted for this batch.
