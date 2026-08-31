import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_DESIGN_SETTINGS_V1, validateDesignSettingsV1 } from "../src/lib/design-settings.ts";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

const OPTIONS = ["80%", "85%", "90%", "95%", "100% — Default", "105%", "110%"];

test("Design Settings exposes exactly one Page / Route Title size selector", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const matches = [...fields.matchAll(/<h3>Page \/ Route Title<\/h3>/g)];
  assert.equal(matches.length, 1);
  const control = fields.slice(matches[0].index);
  const options = fields.slice(fields.indexOf("const PAGE_ROUTE_TITLE_SCALES"), fields.indexOf("export default function"));
  assert.match(control, /name="design_page_route_title_scale"/);
  assert.equal((control.match(/name="design_page_route_title_scale"/g) ?? []).length, 1);
  assert.match(control, /<AdminSelect/);
  for (const option of OPTIONS) assert.match(options, new RegExp(`label: "${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.doesNotMatch(control, /weight|line-height|letter-spacing|font family|breakpoint|clamp|vw|rem|mobile/i);
});

test("Page / Route Title options map exactly to the bounded numeric contract", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(fields, /const PAGE_ROUTE_TITLE_SCALES = \[/);
  for (const value of ["0.8", "0.85", "0.9", "0.95", "1", "1.05", "1.1"]) assert.match(fields, new RegExp(`value: "${value}"`));
  assert.match(page, /page_route_title:\s*\{\s*scale: Number\(formData\.get\("design_page_route_title_scale"\)\)/s);
  const valid = { version: 1, colors: { ...DEFAULT_DESIGN_SETTINGS_V1.colors }, typography: { page_route_title: { scale: 0.9 } } };
  assert.equal(validateDesignSettingsV1(valid).success, true);
  for (const value of [0.79, 1.11, "90%", "clamp(2.7rem, 6.3vw, 5.76rem)"]) {
    assert.equal(validateDesignSettingsV1({ ...valid, typography: { page_route_title: { scale: value } } }).success, false, String(value));
  }
});

test("Page / Route Title saves reuse the private Design Settings revision workflow and preserve other families", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(fields, /pageRouteTitle: DesignSettingsPageRouteTitle/);
  assert.match(page, /const currentDesignSettings = await getCurrentDesignSettingsForChange\(\)/);
  assert.match(page, /typography:\s*\{\s*\.\.\.currentDesignSettings\.typography[\s\S]*eyebrow:[\s\S]*home_hero_title:[\s\S]*page_route_title:/);
  assert.match(page, /validateDesignSettingsV1\(designSettings\)/);
  assert.match(page, /saveRevision\(supabase, "site_settings", "default", \{ design_settings: validation\.value \}\)/);
  assert.match(page, /publishRevision\.bind\(null, "site_settings", content\.settings\.id\)/);
  assert.match(fields, /Adjusts standard page and section-route titles while preserving responsive behavior\./);
});

test("existing save and reset surfaces preserve Page / Route Title data without adding other controls", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  assert.match(page, /designSettings\.typography!\.page_route_title/);
  assert.match(page, /typography:\s*currentDesignSettings\.typography/);
  assert.doesNotMatch(fields, /Service Detail|Work Detail|Article Title|Section Heading|Lead|Button Settings/);
  assert.doesNotMatch(page, /Service Detail|Work Detail|Article Title|Section Heading|Lead|Button Settings/);
});
