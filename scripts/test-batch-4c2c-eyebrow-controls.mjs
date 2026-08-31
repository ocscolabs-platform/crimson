import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_DESIGN_SETTINGS_V1,
  validateDesignSettingsV1,
} from "../src/lib/design-settings.ts";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Design Settings exposes exactly the four approved Eyebrow controls", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(fields, /<legend>Typography<\/legend>/);
  assert.match(fields, /<h3>Eyebrow \/ Overline<\/h3>/);
  assert.match(fields, /<h3>Home Hero Title<\/h3>/);
  assert.match(fields, /<h3>Page \/ Route Title<\/h3>/);
  assert.deepEqual(
    [...fields.matchAll(/name="(design_eyebrow_[^"]+)"/g)].map((match) => match[1]),
    ["design_eyebrow_size", "design_eyebrow_weight", "design_eyebrow_line_height", "design_eyebrow_letter_spacing"],
  );
  assert.match(fields, /name="design_eyebrow_size"/);
  assert.match(fields, /name="design_eyebrow_weight"/);
  assert.match(fields, /name="design_eyebrow_line_height"/);
  assert.match(fields, /name="design_eyebrow_letter_spacing"/);
  assert.match(fields, /<small className="admin-field-unit">rem<\/small>/);
  assert.match(fields, /<small className="admin-field-unit">em<\/small>/);
  assert.match(fields, /unitless/);
  assert.match(page, /eyebrow: \{[\s\S]*design_eyebrow_size/);
});

test("the weight control uses only the existing approved allowlist", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  assert.match(fields, /const EYEBROW_WEIGHTS = \[400, 500, 600, 700, 800\] as const/);
  assert.doesNotMatch(fields, /option[^\n]+300|option[^\n]+900/);
});

test("the existing validator remains authoritative for all four fields", () => {
  const valid = {
    version: 1,
    colors: { ...DEFAULT_DESIGN_SETTINGS_V1.colors },
    typography: { eyebrow: { ...DEFAULT_DESIGN_SETTINGS_V1.typography.eyebrow, letter_spacing: 0.2 } },
  };
  assert.equal(validateDesignSettingsV1(valid).success, true);
  for (const [field, value] of [["size", 1.3], ["weight", 900], ["line_height", 2.1], ["letter_spacing", 0.31]]) {
    const invalid = { ...valid, typography: { eyebrow: { ...valid.typography.eyebrow, [field]: value } } };
    assert.equal(validateDesignSettingsV1(invalid).success, false, field);
  }
});

test("Eyebrow saves use the existing private revision path and preserve colors", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(page, /getCurrentDesignSettingsForChange/);
  assert.match(page, /saveRevision\(supabase, "site_settings", "default", \{ design_settings: validation\.value \}\)/);
  assert.match(page, /typography: \{[\s\S]*eyebrow:[\s\S]*design_eyebrow_letter_spacing/);
  assert.match(page, /Save Design Settings as review/);
  assert.match(page, /Enter valid Design Settings values using the displayed ranges/);
  assert.match(page, /publishRevision\.bind\(null, "site_settings", content\.settings\.id\)/);
  assert.match(page, /typography: currentDesignSettings\.typography/);
});

test("the CMS does not expose another typography family or a typography reset", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  assert.doesNotMatch(fields, /font-family|slider|Typography Reset|live preview|type scale|responsive breakpoint/i);
  assert.doesNotMatch(page, /font-family|slider|Typography Reset|live preview|type scale|responsive breakpoint/i);
});
