import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_DESIGN_SETTINGS_V1,
  normalizeDesignSettingsV1,
  validateDesignSettingsV1,
} from "../src/lib/design-settings.ts";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

const colorOnlyDocument = {
  version: 1,
  colors: { ...DEFAULT_DESIGN_SETTINGS_V1.colors },
};

test("color-only v1 documents remain valid and resolve to the immutable eyebrow defaults", () => {
  const validation = validateDesignSettingsV1(colorOnlyDocument);
  assert.equal(validation.success, true);
  assert.deepEqual(normalizeDesignSettingsV1(colorOnlyDocument).typography, DEFAULT_DESIGN_SETTINGS_V1.typography);
});

test("the current normalized eyebrow contract validates without changing its values", () => {
  const eyebrow = DEFAULT_DESIGN_SETTINGS_V1.typography.eyebrow;
  const validation = validateDesignSettingsV1({ ...colorOnlyDocument, typography: { eyebrow } });
  assert.equal(validation.success, true);
  assert.deepEqual(validation.value.typography.eyebrow, eyebrow);
});

test("partial eyebrow values fill missing fields from immutable defaults", () => {
  const normalized = normalizeDesignSettingsV1({
    ...colorOnlyDocument,
    typography: { eyebrow: { size: 0.8 } },
  });
  assert.equal(normalized.typography.eyebrow.size, 0.8);
  assert.equal(normalized.typography.eyebrow.weight, 800);
  assert.equal(normalized.typography.eyebrow.line_height, 1.4);
  assert.equal(normalized.typography.eyebrow.letter_spacing, 0.16);
});

test("malformed eyebrow values cannot become active", () => {
  const input = {
    ...colorOnlyDocument,
    typography: { eyebrow: { size: "0.8rem", weight: 900, line_height: 3, letter_spacing: "0.16em" } },
  };
  assert.equal(validateDesignSettingsV1(input).success, false);
  assert.deepEqual(normalizeDesignSettingsV1(input).typography, DEFAULT_DESIGN_SETTINGS_V1.typography);
});

test("unknown typography roles are rejected and ignored by normalization", () => {
  const input = { ...colorOnlyDocument, typography: { heading: { size: 2 } } };
  assert.equal(validateDesignSettingsV1(input).success, false);
  assert.equal("heading" in normalizeDesignSettingsV1(input).typography, false);
});

test("eyebrow validation keeps the approved narrow bounds", () => {
  const fields = [
    ["size", 0.49],
    ["size", 1.26],
    ["weight", 300],
    ["line_height", 0.99],
    ["line_height", 2.01],
    ["letter_spacing", 0],
    ["letter_spacing", 0.31],
  ];
  for (const [field, value] of fields) {
    const eyebrow = { ...DEFAULT_DESIGN_SETTINGS_V1.typography.eyebrow, [field]: value };
    assert.equal(validateDesignSettingsV1({ ...colorOnlyDocument, typography: { eyebrow } }).success, false, field);
  }
});

test("valid eyebrow data survives the existing revision merge and Owner publish paths", async () => {
  const revisions = await source("supabase/migrations/20260831000000_reconcile_production_legacy_baseline.sql");
  const settingsContract = await source("supabase/migrations/20260831110000_add_design_settings_storage_contract.sql");
  assert.match(revisions, /merged_payload := merged_payload \|\| existing_payload/);
  assert.match(revisions, /merged_payload := merged_payload \|\| p_payload/);
  assert.match(settingsContract, /design_settings = coalesce\(revision\.payload->'design_settings', design_settings\)/);
  assert.match(settingsContract, /cms_design_settings_v1_is_valid/);
});

test("the forward migration accepts only a complete validated eyebrow object", async () => {
  const migration = await source("supabase/migrations/20260831120000_add_design_settings_eyebrow_contract.sql");
  assert.match(migration, /jsonb_object_keys\(eyebrow\)/);
  assert.match(migration, /0\.5/);
  assert.match(migration, /1\.25/);
  assert.match(migration, /400, 500, 600, 700, 800/);
  assert.match(migration, /line_height/);
  assert.match(migration, /numeric > 2/);
  assert.match(migration, /\(eyebrow->>'letter_spacing'\)::numeric <= 0/);
});

test("Colors Reset preserves a valid typography family through the existing revision workflow", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(page, /getCurrentDesignSettingsForChange/);
  assert.match(page, /design_settings:\s*\{\s*\.\.\.DEFAULT_DESIGN_SETTINGS_V1/);
  assert.match(page, /typography: currentDesignSettings\.typography/);
});

test("the storage family is not mapped to runtime CSS or exposed as CMS controls", async () => {
  const designSettings = await source("src/lib/design-settings.ts");
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(designSettings, /DESIGN_SETTINGS_V1_EYEBROW_KEYS/);
  assert.match(designSettings, /designSettingsToCssVariables/);
  assert.doesNotMatch(designSettings, /typography.*--type-|--type-.*typography/s);
  assert.doesNotMatch(fields, /Typography|Eyebrow|font-family|line-height|letter-spacing/i);
  assert.doesNotMatch(page, /Typography|Eyebrow|font-family|line-height|letter-spacing/);
});

test("existing color controls retain their current entry point and validation", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(fields, /DESIGN_SETTINGS_V1_COLOR_KEYS/);
  assert.match(page, /Save colors as review/);
  assert.match(page, /validateDesignSettingsV1\(designSettings\)/);
  assert.match(page, /saved=design-reset/);
});
