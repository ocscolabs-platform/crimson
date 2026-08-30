import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_DESIGN_SETTINGS_V1,
  designSettingsToCssVariables,
  validateDesignSettingsV1,
} from "../src/lib/design-settings.ts";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Design Settings exposes one Home Hero Title size control with the approved percentage allowlist", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const homeHeroControl = fields.slice(fields.indexOf("<legend>Typography <small>Home Hero Title"), fields.indexOf("<legend>Typography <small>Page / Route Title"));
  const options = fields.slice(fields.indexOf("const HOME_HERO_TITLE_SCALES"), fields.indexOf("const PAGE_ROUTE_TITLE_SCALES"));
  assert.match(homeHeroControl, /<legend>Typography <small>Home Hero Title<\/small><\/legend>/);
  assert.match(homeHeroControl, /name="design_home_hero_title_scale"/);
  assert.match(homeHeroControl, /<span>Title Size<\/span>/);
  assert.match(homeHeroControl, /<AdminSelect/);
  for (const option of ["80%", "85%", "90%", "95%", "100% — Default", "105%", "110%"]) {
    assert.match(options, new RegExp(`label: "${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
  assert.doesNotMatch(homeHeroControl, /weight|line-height|letter-spacing|font|breakpoint|mobile/i);
});

test("the Home Hero control stores only T1 numeric mappings and the backend remains authoritative", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(page, /home_hero_title:\s*\{\s*scale: Number\(formData\.get\("design_home_hero_title_scale"\)\)/s);
  assert.match(page, /validateDesignSettingsV1\(designSettings\)/);
  assert.match(page, /saveRevision\(supabase, "site_settings", "default", \{ design_settings: validation\.value \}\)/);
  assert.equal(validateDesignSettingsV1({ version: 1, colors: { ...DEFAULT_DESIGN_SETTINGS_V1.colors }, typography: { home_hero_title: { scale: 0.9 } } }).success, true);
  for (const scale of [0.79, 1.11, "90%", "clamp(2.88rem, 6.3vw, 6.21rem)"]) {
    assert.equal(validateDesignSettingsV1({ version: 1, colors: { ...DEFAULT_DESIGN_SETTINGS_V1.colors }, typography: { home_hero_title: { scale } } }).success, false, scale);
  }
});

test("Home Hero saves use the existing private revision path and preserve Colors, Eyebrow, and unrelated settings", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(page, /const currentDesignSettings = await getCurrentDesignSettingsForChange\(\)/);
  assert.match(page, /colors:\s*\{/);
  assert.match(page, /typography:\s*\{\s*\.\.\.currentDesignSettings\.typography/);
  assert.match(page, /eyebrow:\s*\{/);
  assert.match(page, /home_hero_title:\s*\{/);
  assert.match(page, /publishRevision\.bind\(null, "site_settings", content\.settings\.id\)/);
  assert.match(page, /Enter valid Design Settings values using the displayed ranges/);
});

test("Colors and Eyebrow save/reset paths preserve Home Hero Title data", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  assert.match(page, /typography:\s*\{\s*\.\.\.currentDesignSettings\.typography/);
  assert.match(page, /typography:\s*currentDesignSettings\.typography/);
  assert.match(page, /designSettings\.typography!\.home_hero_title/);
});

test("the published 90% runtime formulas remain the T2 semantic output", () => {
  const variables = designSettingsToCssVariables({
    version: 1,
    colors: { ...DEFAULT_DESIGN_SETTINGS_V1.colors },
    typography: {
      home_hero_title: { scale: 0.9 },
    },
  });
  assert.equal(variables["--type-h1-hero-size"], "clamp(2.88rem, 6.3vw, 6.21rem)");
  assert.equal(variables["--type-h1-hero-mobile-size"], "clamp(2.61rem, 13.5vw, 4.05rem)");
  assert.equal(variables["--type-h1-hero-size"].includes("90%"), false);
});

test("no unrelated typography context or raw CSS control is introduced", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  const homeHeroControl = fields.slice(fields.indexOf("<legend>Typography <small>Home Hero Title"), fields.indexOf("<legend>Typography <small>Page / Route Title"));
  assert.doesNotMatch(homeHeroControl, /Route Title|Article Title|Section Heading|Lead|font-family|breakpoint|clamp|vw/i);
  assert.doesNotMatch(homeHeroControl, /weight|line-height|letter-spacing|font|breakpoint|mobile|clamp|vw|rem/i);
});
