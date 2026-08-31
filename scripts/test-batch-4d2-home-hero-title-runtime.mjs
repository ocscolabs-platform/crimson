import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_DESIGN_SETTINGS_V1,
  designSettingsToCssVariables,
} from "../src/lib/design-settings.ts";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

const colors = { ...DEFAULT_DESIGN_SETTINGS_V1.colors };
const eyebrow = { ...DEFAULT_DESIGN_SETTINGS_V1.typography.eyebrow };

function variablesForScale(scale) {
  return designSettingsToCssVariables({
    version: 1,
    colors,
    typography: { eyebrow, home_hero_title: { scale } },
  });
}

test("scale 1.00 preserves the exact current desktop and mobile formulas", () => {
  const variables = variablesForScale(1);
  assert.equal(variables["--type-h1-hero-size"], "clamp(3.2rem, 7vw, 6.9rem)");
  assert.equal(variables["--type-h1-hero-mobile-size"], "clamp(2.9rem, 15vw, 4.5rem)");
});

test("scale 0.80 proportionally scales all desktop and mobile clamp components", () => {
  const variables = variablesForScale(0.8);
  assert.equal(variables["--type-h1-hero-size"], "clamp(2.56rem, 5.6vw, 5.52rem)");
  assert.equal(variables["--type-h1-hero-mobile-size"], "clamp(2.32rem, 12vw, 3.6rem)");
});

test("scale 1.10 proportionally scales all desktop and mobile clamp components", () => {
  const variables = variablesForScale(1.1);
  assert.equal(variables["--type-h1-hero-size"], "clamp(3.52rem, 7.7vw, 7.59rem)");
  assert.equal(variables["--type-h1-hero-mobile-size"], "clamp(3.19rem, 16.5vw, 4.95rem)");
});

test("scale 0.90 emits concise deterministic proportional formulas", () => {
  const variables = variablesForScale(0.9);
  assert.equal(variables["--type-h1-hero-size"], "clamp(2.88rem, 6.3vw, 6.21rem)");
  assert.equal(variables["--type-h1-hero-mobile-size"], "clamp(2.61rem, 13.5vw, 4.05rem)");
  assert.doesNotMatch(variables["--type-h1-hero-size"], /0{3,}|999|e[+-]/i);
  assert.doesNotMatch(variables["--type-h1-hero-mobile-size"], /0{3,}|999|e[+-]/i);
});

test("absent and malformed scales fall back to both current formulas", () => {
  for (const input of [
    { version: 1, colors },
    { version: 1, colors, typography: { home_hero_title: {} } },
    { version: 1, colors, typography: { home_hero_title: { scale: "0.9rem" } } },
    { version: 1, colors, typography: { home_hero_title: { scale: "clamp(1rem, 2vw, 3rem)" } } },
  ]) {
    const variables = designSettingsToCssVariables(input);
    assert.equal(variables["--type-h1-hero-size"], "clamp(3.2rem, 7vw, 6.9rem)");
    assert.equal(variables["--type-h1-hero-mobile-size"], "clamp(2.9rem, 15vw, 4.5rem)");
  }
});

test("runtime output accepts no free-form CSS and keeps Colors and Eyebrow variables unchanged", () => {
  const variables = variablesForScale("calc(100% + 1rem)");
  assert.equal(variables["--green"], colors.green);
  assert.equal(variables["--type-eyebrow-size"], `${eyebrow.size}rem`);
  assert.equal(variables["--type-eyebrow-weight"], String(eyebrow.weight));
  assert.equal(variables["--type-eyebrow-line-height"], String(eyebrow.line_height));
  assert.equal(variables["--type-eyebrow-letter-spacing"], `${eyebrow.letter_spacing}em`);
  assert.doesNotMatch(variables["--type-h1-hero-size"], /calc|var|url|;|\{/i);
  assert.doesNotMatch(variables["--type-h1-hero-mobile-size"], /calc|var|url|;|\{/i);
});

test("the existing semantic variables remain the public Home selector contract", async () => {
  const css = await source("src/app/globals.css");
  const layout = await source("src/app/layout.tsx");
  const home = await source("src/app/page.tsx");
  const preview = await source("src/app/admin/content/pages/[pageKey]/preview/page.tsx");
  const mapper = await source("src/lib/design-settings.ts");
  assert.match(layout, /getPublishedDesignSettings/);
  assert.match(layout, /designSettingsToCssVariables\(designSettings\)/);
  assert.match(css, /--type-h1-hero-size:\s*clamp\(3\.2rem, 7vw, 6\.9rem\)/);
  assert.match(css, /--type-h1-hero-mobile-size:\s*clamp\(2\.9rem, 15vw, 4\.5rem\)/);
  assert.match(css, /\.hero h1[^}]*font-size: var\(--type-h1-hero-size\)/s);
  assert.match(css, /\.hero h1[^}]*font-size: var\(--type-h1-hero-mobile-size\)/s);
  assert.match(home, /<h1 id="hero-title">\{hero\.title\}<\/h1>/);
  assert.match(preview, /<h1 id="hero-title">\{hero\.title\}<\/h1>/);
  assert.match(mapper, /--type-h1-hero-size/);
  assert.match(mapper, /--type-h1-hero-mobile-size/);
});

test("the Home Hero control remains a single size selector with no second typography system", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  assert.equal((fields.match(/name="design_home_hero_title_scale"/g) ?? []).length, 1);
  assert.equal((page.match(/design_home_hero_title_scale/g) ?? []).length, 1);
  assert.doesNotMatch(fields, /design_home_hero_(?:weight|line_height|letter_spacing|font|breakpoint|mobile)/i);
  assert.doesNotMatch(page, /design_home_hero_(?:weight|line_height|letter_spacing|font|breakpoint|mobile)/i);
  assert.doesNotMatch(fields, /slider|Typography Reset/i);
  assert.doesNotMatch(page, /slider|Typography Reset/i);
});

test("ordinary admin pages do not consume Home Hero semantic variables", async () => {
  const css = await source("src/app/globals.css");
  const adminPages = await Promise.all([
    source("src/app/admin/page.tsx"),
    source("src/app/admin/content/page.tsx"),
    source("src/app/admin/team/page.tsx"),
  ]);
  const adminBoundary = css.match(/\.admin-page:not\(:has\(\.insights-preview-banner\)\)\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  assert.doesNotMatch(adminBoundary, /--type-h1-hero-size|--type-h1-hero-mobile-size/);
  for (const page of adminPages) assert.doesNotMatch(page, /type-h1-hero-size|type-h1-hero-mobile-size/);
});
