# OCSCO Crimson — Design Settings v1 — Batch 4A1 Storage & Validation Contract

**Status:** Implemented on the staging-targeted feature branch; staging integration and verification pending
**Scope:** Storage, defaults, validation, revision compatibility, and read/normalize helper only
**Environment boundary:** No Production action or data change; no CSS injection or CMS controls

## Migration/storage result

Added forward-only migration `20260831110000_add_design_settings_storage_contract.sql`.

- Extends the existing singleton `public.site_settings` row with one additive `design_settings jsonb not null` field.
- Uses a default v1 object containing the current eight CSS color values.
- Adds an object-shape database constraint.
- Adds a small database validation helper used only by the authoritative site-settings publish path.
- Creates no Design Settings table, role, capability, or UI.
- Existing site-settings columns and behavior remain intact.

## Approved token allowlist

Only these existing public color tokens are supported:

`ink`, `graphite`, `green`, `white`, `snow`, `muted`, `border`, `copy`

No typography, spacing, radii, button geometry or states, gradients, glass/noise, shadows, breakpoints, animations, font uploads, or arbitrary CSS were added.

## Default/validator implementation

`src/lib/design-settings.ts` adds:

- immutable `DEFAULT_DESIGN_SETTINGS_V1` matching the current `src/app/globals.css` values exactly;
- typed v1 document and allowlist definitions;
- strict validation requiring an object, version `1`, exactly the supported structure, and six-digit hex colors;
- normalization that returns safe complete defaults for absent/invalid documents and fills missing individual colors from defaults;
- rejection of unknown fields during strict validation, with unknown values omitted from the normalized active document.

`src/lib/cms-content.ts` now reads the published `design_settings` field and normalizes it. If the column is not yet available during a compatibility window, it falls back to the legacy site-settings query and current design defaults. The helper does not apply CSS variables.

## Revision/publish compatibility result

- `cms_save_revision` already serializes the full `site_settings` row and merges partial payloads, so the new field is preserved without a second revision system.
- The new migration updates the current authoritative `cms_publish_revision` implementation to retain the existing design document when omitted and persist it only when it passes the v1 database validation helper.
- Existing Owner-only publication authorization is unchanged.
- Existing non-design site-settings fields remain in the same publish branch and are not renamed or removed.

## Focused tests

Added `scripts/test-batch-4a1-design-settings.mjs` and the package script `test:batch4a1:design-settings`.

Passed:

1. Default document validates.
2. All eight approved color tokens are represented.
3. Missing values normalize to current defaults.
4. Malformed colors fail strict validation and safely fall back.
5. Unknown/unapproved keys cannot become active tokens.
6. Existing revision merge behavior preserves `design_settings`.
7. The authoritative publish migration validates and persists a valid v1 object.
8. Existing site-settings fields remain in the publish path.
9. No new table, role, or capability is introduced.
10. Application defaults match `globals.css` exactly.
11. The loader normalizes the field without CSS-variable application.

Additional checks passed:

- `npm run validate:migrations`
- `npm run typecheck`
- `npm run build`
- `npm run test:batch3c1:case-study-preview`
- `git diff --check`

Lint completed with three pre-existing warnings and no errors. The unrelated `npm run test:staging:migration-pipeline` local static assertion remains failing on its existing `getent ahostsv4.*PGHOST` expectation; it was not modified because it is outside Batch 4A1.

## Visual-change result

No `src/app/globals.css` token was changed. No CSS variables are populated from CMS data. No public or CMS UI was redesigned. The intended visual change is zero.

## Staging verification

Pending protected PR integration. The migration must be applied only by the normal protected staging workflow, followed by a read-only schema/data-contract check confirming the singleton row, default parity, normalization fallback, and unchanged global content behavior.

## Production/main boundary

No merge to `main`, Production deployment, Production data access, or Production configuration was performed.
