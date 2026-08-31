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
const homeHeroTitle = { ...DEFAULT_DESIGN_SETTINGS_V1.typography.home_hero_title };
const pageRouteTitle = { scale: 1 };

function documentWith(typography) {
  return { version: 1, colors, ...(typography ? { typography } : {}) };
}

test("existing color-only, Eyebrow-only, Home Hero-only, and combined documents remain valid", () => {
  const documents = [
    documentWith(),
    documentWith({ eyebrow }),
    documentWith({ home_hero_title: homeHeroTitle }),
    documentWith({ page_route_title: pageRouteTitle }),
    documentWith({ eyebrow, home_hero_title: homeHeroTitle, page_route_title: pageRouteTitle }),
  ];
  for (const document of documents) assert.equal(validateDesignSettingsV1(document).success, true);
});

test("absent Page / Route Title scale normalizes to the immutable 1.00 default", () => {
  assert.equal(normalizeDesignSettingsV1(documentWith()).typography.page_route_title.scale, 1);
  assert.equal(normalizeDesignSettingsV1(documentWith({ home_hero_title: { scale: 0.9 } })).typography.page_route_title.scale, 1);
});

test("Page / Route Title scale accepts 0.80, 1.00, and 1.10", () => {
  for (const scale of [0.8, 1, 1.1]) {
    assert.equal(validateDesignSettingsV1(documentWith({ page_route_title: { scale } })).success, true, scale);
  }
});

test("Page / Route Title scale rejects values outside the approved bounds", () => {
  for (const scale of [0, -1, 0.79, 1.11, 2]) {
    assert.equal(validateDesignSettingsV1(documentWith({ page_route_title: { scale } })).success, false, scale);
  }
});

test("malformed and non-numeric Page / Route Title values fail closed to 1.00", () => {
  for (const scale of ["0.9", "0.9rem", "clamp(3rem, 7vw, 6.4rem)", null, true, NaN, Infinity]) {
    const document = documentWith({ page_route_title: { scale } });
    assert.equal(validateDesignSettingsV1(document).success, false, String(scale));
    assert.equal(normalizeDesignSettingsV1(document).typography.page_route_title.scale, 1, String(scale));
  }
});

test("Page / Route Title keeps strict key validation", () => {
  assert.equal(validateDesignSettingsV1(documentWith({ page_route_title: { scale: 1, unit: "rem" } })).success, false);
  assert.equal(validateDesignSettingsV1(documentWith({ display: { scale: 1 } })).success, false);
  assert.equal(validateDesignSettingsV1(documentWith({ page_route_title: { size: 1 } })).success, false);
});

test("combined Design Settings normalization preserves Colors, Eyebrow, Home Hero 0.90, and Page / Route values", () => {
  const document = {
    version: 1,
    colors: { ...colors, green: "#123456" },
    typography: {
      eyebrow: { ...eyebrow, letter_spacing: 0.2 },
      home_hero_title: { scale: 0.9 },
      page_route_title: { scale: 0.85 },
    },
  };
  const normalized = normalizeDesignSettingsV1(document);
  assert.equal(normalized.colors.green, "#123456");
  assert.equal(normalized.typography.eyebrow.letter_spacing, 0.2);
  assert.equal(normalized.typography.home_hero_title.scale, 0.9);
  assert.equal(normalized.typography.page_route_title.scale, 0.85);
});

test("the forward database validator accepts the optional Page / Route Title object", async () => {
  const migration = await source("supabase/migrations/20260831140000_add_design_settings_page_route_title_contract.sql");
  assert.match(migration, /create or replace function public\.cms_design_settings_v1_is_valid/);
  assert.match(migration, /page_route_title/);
  assert.match(migration, /not in \(1, 2, 3\)/);
  assert.match(migration, /0\.8/);
  assert.match(migration, /1\.1/);
  assert.match(migration, /jsonb_typeof\(page_route_title->'scale'\) is distinct from 'number'/);
});

test("the existing revision merge and Owner publication paths carry the new valid value", async () => {
  const revisions = await source("supabase/migrations/20260831000000_reconcile_production_legacy_baseline.sql");
  const publisher = await source("supabase/migrations/20260831110000_add_design_settings_storage_contract.sql");
  const migration = await source("supabase/migrations/20260831140000_add_design_settings_page_route_title_contract.sql");
  assert.match(revisions, /merged_payload := merged_payload \|\| existing_payload/);
  assert.match(revisions, /merged_payload := merged_payload \|\| p_payload/);
  assert.match(publisher, /cms_design_settings_v1_is_valid/);
  assert.match(migration, /grant execute on function public\.cms_design_settings_v1_is_valid\(jsonb\) to authenticated/);
});

test("the existing Design Settings save path preserves every existing typography family", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(page, /const currentDesignSettings = await getCurrentDesignSettingsForChange\(\)/);
  assert.match(page, /typography: \{\s*\.\.\.currentDesignSettings\.typography/);
  assert.match(page, /saveRevision\(supabase, "site_settings", "default", \{ design_settings: validation\.value \}\)/);
  assert.match(page, /home_hero_title:/);
  assert.match(page, /page_route_title:\s*\{\s*scale: Number\(formData\.get\("design_page_route_title_scale"\)\)/s);
});

test("Colors Reset preserves Page / Route Title, Home Hero, and Eyebrow values", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(page, /design_settings:\s*\{\s*\.\.\.DEFAULT_DESIGN_SETTINGS_V1/);
  assert.match(page, /typography: currentDesignSettings\.typography/);
});

test("the Page / Route Title contract remains distinct from the fixed detail runtime", async () => {
  const designSettings = await source("src/lib/design-settings.ts");
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  const css = await source("src/app/globals.css");
  const variables = designSettingsToCssVariables(documentWith({ page_route_title: { scale: 0.9 } }));
  assert.equal("--type-h1-route-size" in variables, false);
  assert.equal("--type-h1-route-mobile-size" in variables, false);
  assert.match(css, /--type-h1-route-size:\s*clamp\(3rem, 7vw, 6\.4rem\);/);
  assert.doesNotMatch(designSettings, /page_route_title.*--type-h1-route/s);
  assert.match(fields, /name="design_page_route_title_scale"/);
  assert.match(page, /page_route_title/);
});

test("no generic H1 control or unrelated typography family is introduced", async () => {
  const designSettings = await source("src/lib/design-settings.ts");
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  assert.doesNotMatch(designSettings, /generic_h1|global_h1|display_typography/i);
  assert.doesNotMatch(fields, /H1 typography|Service Detail|Work Detail|Insights Article|font-family|breakpoint|mobile/i);
});
