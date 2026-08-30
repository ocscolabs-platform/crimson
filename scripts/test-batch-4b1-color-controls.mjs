import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_DESIGN_SETTINGS_V1,
  DESIGN_SETTINGS_V1_COLOR_KEYS,
  validateDesignSettingsV1,
} from "../src/lib/design-settings.ts";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("the CMS exposes exactly the approved eight color controls", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");

  assert.deepEqual([...fields.matchAll(/\n\s+(\w+): "[^\n]+",/g)].map((match) => match[1]), [...DESIGN_SETTINGS_V1_COLOR_KEYS]);
  assert.match(page, /id="design-settings"/);
  assert.match(page, /<p className="admin-kicker">Design Settings<\/p>/);
  assert.match(page, /<h2>Colors<\/h2>/);
  assert.doesNotMatch(fields, /Typography|Spacing|Gradient|alpha|rgba|hsl/i);
});

test("color and hex inputs remain synchronized without a picker dependency", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  assert.match(fields, /type="color"/);
  assert.match(fields, /type="text"|className="admin-input admin-color-hex"/);
  assert.match(fields, /onChange=\{\(event\) => updateColor\(key, event\.target\.value\.toLowerCase\(\)\)\}/);
  assert.match(fields, /pattern="\^#\[0-9A-Fa-f\]\{6\}\$"/);
});

test("malformed values are rejected and valid values use the existing v1 contract", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(page, /validateDesignSettingsV1\(designSettings\)/);
  assert.match(page, /Fix the color values:/);
  assert.match(page, /toLowerCase\(\)/);

  const invalid = { version: 1, colors: { ...DEFAULT_DESIGN_SETTINGS_V1.colors, green: "#fff" } };
  const valid = { version: 1, colors: { ...DEFAULT_DESIGN_SETTINGS_V1.colors, green: "#123456" } };
  assert.equal(validateDesignSettingsV1(invalid).success, false);
  assert.equal(validateDesignSettingsV1(valid).success, true);
});

test("saving colors creates a private site-settings revision and publication remains separate", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(page, /async function saveDesignSettings/);
  assert.match(page, /saveRevision\(supabase, "site_settings", "default", \{ design_settings: validation\.value \}\)/);
  assert.match(page, /redirect\("\/crimson-admin-control\/content\?saved=design-settings"\)/);
  assert.match(page, /membership\.role !== "owner"/);
  assert.match(page, /publishRevision\.bind\(null, "site_settings", content\.settings\.id\)/);
});

test("active editable values reopen from the existing revision merge", async () => {
  const loader = await source("src/lib/admin-global-content.ts");
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(loader, /select\("id, site_name, positioning_statement, default_seo_title, default_seo_description, default_og_image_path, primary_contact_path, design_settings"\)/);
  assert.match(loader, /settingsPayload\?\.design_settings \?\? settingsRecord\.design_settings/);
  assert.match(page, /<DesignSettingsFields values=\{designSettings\.colors\}/);
});

test("the entry point reuses global-content permissions and excludes unsupported controls", async () => {
  const dashboard = await source("src/app/admin/page.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(dashboard, /href="\/crimson-admin-control\/content#design-settings"/);
  assert.match(page, /canEditGlobalContent\(membership\.role\)/);
  assert.doesNotMatch(page, /Typography|Spacing|Button controls|Preview pane/);
});

test("Reset to Default uses the immutable snapshot through the existing revision workflow", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  const reset = await source("src/app/admin/content/DesignSettingsResetControl.tsx");
  assert.match(page, /DEFAULT_DESIGN_SETTINGS_V1/);
  assert.match(page, /async function resetDesignSettings/);
  assert.match(page, /design_settings:\s*\{\s*\.\.\.DEFAULT_DESIGN_SETTINGS_V1/);
  assert.match(page, /typography: currentDesignSettings\.typography/);
  assert.match(page, /saved=design-reset/);
  assert.match(reset, /Reset to Default/);
  assert.match(reset, /all eight color settings/i);
  assert.match(reset, /remain private until the owner publishes/i);
  assert.match(reset, /role="dialog"/);
});
