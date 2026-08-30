# OCSCO Crimson — Design Settings v1 — Batch 4B2
# Reset Colors to Default

## Scope

Batch 4B2 adds one confirmed `Reset to Default` action to the existing
`Design Settings → Colors` surface. It resets only the complete eight-token v1
color document and reuses the existing site-settings revision and publication
workflow.

## Implementation

- The reset action uses `DEFAULT_DESIGN_SETTINGS_V1` directly; default values
  are not duplicated in the UI.
- Confirmation uses the existing CMS publish-confirmation presentation and
  explains that all eight colors return to OCSCO defaults while remaining
  private until Owner publication.
- Confirmation submits the immutable default snapshot through
  `cms_save_revision` for `site_settings:default` as a private Review revision.
- No null writes, key-by-key resets, special publication path, new schema,
  capability, role, token family, or dependency was added.

## Verification

Local focused checks and protected staging checks are recorded below after the
staging deployment is available. The controlled test must finish with all eight
public colors at the approved defaults and the admin palette isolated.

## Release boundary

- Target: `staging` only.
- `main` untouched.
- Production untouched.
- Work Library, Scheduled Publishing, Insights, Team & Access, Pages /
  Services, staging alias, and Cairnstack untouched.
