import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_DESIGN_SETTINGS_V1,
  designSettingsToCssVariables,
  normalizeDesignSettingsV1,
  validateDesignSettingsV1,
} from "../src/lib/design-settings.ts";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

const colors = { ...DEFAULT_DESIGN_SETTINGS_V1.colors };
const eyebrow = { ...DEFAULT_DESIGN_SETTINGS_V1.typography.eyebrow };
const homeHeroTitle = { scale: 1 };

function documentWith(typography) {
  return { version: 1, colors, ...(typography ? { typography } : {}) };
}

test("existing color-only, Eyebrow-only, Home-only, and combined documents remain valid", () => {
  const documents = [
    documentWith(),
    documentWith({ eyebrow }),
    documentWith({ home_hero_title: homeHeroTitle }),
    documentWith({ eyebrow, home_hero_title: homeHeroTitle }),
  ];
  for (const document of documents) assert.equal(validateDesignSettingsV1(document).success, true);
});

test("absent Home Hero Title scale normalizes to the immutable 1.0 default", () => {
  assert.equal(normalizeDesignSettingsV1(documentWith()).typography.home_hero_title.scale, 1);
  assert.equal(normalizeDesignSettingsV1(documentWith({ eyebrow })).typography.home_hero_title.scale, 1);
});

test("Home Hero Title scale accepts the default and both approved boundaries", () => {
  for (const scale of [0.8, 1, 1.1]) {
    assert.equal(validateDesignSettingsV1(documentWith({ home_hero_title: { scale } })).success, true, scale);
  }
});

test("Home Hero Title scale rejects values below 0.80 and above 1.10", () => {
  for (const scale of [0, -1, 0.79, 1.11, 2]) {
    assert.equal(validateDesignSettingsV1(documentWith({ home_hero_title: { scale } })).success, false, scale);
  }
});

test("malformed and non-numeric Home Hero Title scales fail closed to 1.0", () => {
  for (const scale of ["0.9", "0.9rem", null, true, NaN, Infinity]) {
    const document = documentWith({ home_hero_title: { scale } });
    assert.equal(validateDesignSettingsV1(document).success, false, String(scale));
    assert.equal(normalizeDesignSettingsV1(document).typography.home_hero_title.scale, 1, String(scale));
  }
});

test("Home Hero Title keeps strict unknown-key behavior", () => {
  assert.equal(validateDesignSettingsV1(documentWith({ home_hero_title: { scale: 1, unit: "rem" } })).success, false);
  assert.equal(validateDesignSettingsV1(documentWith({ display: { scale: 1 } })).success, false);
});

test("the forward database validator accepts optional Home Hero Title data and preserves Eyebrow rules", async () => {
  const migration = await source("supabase/migrations/20260831130000_add_design_settings_home_hero_title_contract.sql");
  assert.match(migration, /create or replace function public\.cms_design_settings_v1_is_valid/);
  assert.match(migration, /home_hero_title/);
  assert.match(migration, /0\.8/);
  assert.match(migration, /1\.1/);
  assert.match(migration, /typography.*not in \(1, 2\)/s);
  assert.match(migration, /weight.*not in \(400, 500, 600, 700, 800\)/s);
});

test("the existing revision merge and Owner publication paths carry valid Home Hero Title data", async () => {
  const revisions = await source("supabase/migrations/20260831000000_reconcile_production_legacy_baseline.sql");
  const publisher = await source("supabase/migrations/20260831110000_add_design_settings_storage_contract.sql");
  const migration = await source("supabase/migrations/20260831130000_add_design_settings_home_hero_title_contract.sql");
  assert.match(revisions, /merged_payload := merged_payload \|\| existing_payload/);
  assert.match(revisions, /merged_payload := merged_payload \|\| p_payload/);
  assert.match(publisher, /cms_design_settings_v1_is_valid/);
  assert.match(migration, /grant execute on function public\.cms_design_settings_v1_is_valid\(jsonb\) to authenticated/);
});

test("Colors and Eyebrow saves preserve Home Hero Title data through the existing combined form", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(page, /const currentDesignSettings = await getCurrentDesignSettingsForChange\(\)/);
  assert.match(page, /typography: \{\s*\.\.\.currentDesignSettings\.typography/);
  assert.match(page, /saveRevision\(supabase, "site_settings", "default", \{ design_settings: validation\.value \}\)/);
});

test("Colors Reset preserves Home Hero Title and Eyebrow data", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(page, /design_settings:\s*\{\s*\.\.\.DEFAULT_DESIGN_SETTINGS_V1/);
  assert.match(page, /typography: currentDesignSettings\.typography/);
});

test("Home Hero Title data preserves Colors and Eyebrow values during normalization", () => {
  const document = {
    version: 1,
    colors: { ...colors, green: "#123456" },
    typography: {
      eyebrow: { ...eyebrow, letter_spacing: 0.2 },
      home_hero_title: { scale: 0.9 },
    },
  };
  const normalized = normalizeDesignSettingsV1(document);
  assert.equal(normalized.colors.green, "#123456");
  assert.equal(normalized.typography.eyebrow.letter_spacing, 0.2);
  assert.equal(normalized.typography.home_hero_title.scale, 0.9);
});

test("Home Hero Title runtime mapping remains on the approved semantic variables", async () => {
  const variables = designSettingsToCssVariables(documentWith({ home_hero_title: { scale: 0.9 } }));
  assert.equal(variables["--type-h1-hero-size"], "clamp(2.88rem, 6.3vw, 6.21rem)");
  assert.equal(variables["--type-h1-hero-mobile-size"], "clamp(2.61rem, 13.5vw, 4.05rem)");
  assert.equal("--type-h1-home-hero-scale" in variables, false);
  const designSettings = await source("src/lib/design-settings.ts");
  const css = await source("src/app/globals.css");
  assert.match(designSettings, /--type-h1-hero-size/);
  assert.match(designSettings, /--type-h1-hero-mobile-size/);
  assert.match(css, /\.hero h1[^}]*var\(--type-h1-hero-size\)/s);
  assert.doesNotMatch(css, /home_hero_title|home-hero-scale/);
});

test("Home Hero Title remains on the existing Design Settings workflow", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(fields, /name="design_home_hero_title_scale"/);
  assert.match(page, /saveDesignSettings/);
  assert.doesNotMatch(fields, /design_home_hero_(?:weight|line_height|letter_spacing|font|breakpoint|mobile)/i);
  assert.doesNotMatch(page, /design_home_hero_(?:weight|line_height|letter_spacing|font|breakpoint|mobile)/i);
});
