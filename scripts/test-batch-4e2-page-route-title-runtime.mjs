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
const homeHero = { ...DEFAULT_DESIGN_SETTINGS_V1.typography.home_hero_title };

function variablesForScale(scale) {
  return designSettingsToCssVariables({
    version: 1,
    colors,
    typography: {
      eyebrow,
      home_hero_title: homeHero,
      page_route_title: { scale },
    },
  });
}

test("standard Page / Route scale proportionally maps the reviewed clamp formula", () => {
  const expected = new Map([
    [1, "clamp(3rem, 7vw, 6.4rem)"],
    [0.8, "clamp(2.4rem, 5.6vw, 5.12rem)"],
    [0.9, "clamp(2.7rem, 6.3vw, 5.76rem)"],
    [1.1, "clamp(3.3rem, 7.7vw, 7.04rem)"],
  ]);

  for (const [scale, formula] of expected) {
    assert.equal(variablesForScale(scale)["--type-h1-page-route-size"], formula);
  }
});

test("default and malformed Page / Route scales fall back safely", () => {
  for (const settings of [
    { version: 1, colors },
    { version: 1, colors, typography: { page_route_title: {} } },
    { version: 1, colors, typography: { page_route_title: { scale: "0.9rem" } } },
    { version: 1, colors, typography: { page_route_title: { scale: 4 } } },
  ]) {
    assert.equal(
      designSettingsToCssVariables(settings)["--type-h1-page-route-size"],
      "clamp(3rem, 7vw, 6.4rem)",
    );
  }
});

test("fixed detail route variable and existing public families remain unchanged", async () => {
  const css = await source("src/app/globals.css");
  const variables = variablesForScale(0.9);
  assert.equal(variables["--type-h1-route-size"], undefined);
  assert.match(css, /--type-h1-route-size:\s*clamp\(3rem, 7vw, 6\.4rem\)/);
  assert.match(css, /\.route-hero-content h1\s*\{[^}]*font-size:\s*var\(--type-h1-route-size\)/s);
  assert.match(css, /\.route-hero-content h1\.route-hero-title-standard\s*\{[^}]*font-size:\s*var\(--type-h1-page-route-size\)/s);
  assert.equal(variables["--green"], colors.green);
  assert.equal(variables["--type-eyebrow-size"], `${eyebrow.size}rem`);
  assert.equal(variables["--type-eyebrow-weight"], String(eyebrow.weight));
  assert.equal(variables["--type-eyebrow-line-height"], String(eyebrow.line_height));
  assert.equal(variables["--type-eyebrow-letter-spacing"], `${eyebrow.letter_spacing}em`);
});

test("RouteShell and all scoped contexts use explicit semantic boundaries", async () => {
  const routeShell = await source("src/components/route-shell.tsx");
  assert.match(routeShell, /export type RouteTitleContext = "standard" \| "service-detail" \| "work-detail"/);
  assert.match(routeShell, /route-hero-title-\$\{titleContext\}/);

  for (const route of ["about", "services", "contact", "work", "insights"]) {
    assert.match(await source(`src/app/${route}/page.tsx`), /titleContext="standard"/);
  }
  assert.match(await source("src/app/services/[slug]/page.tsx"), /titleContext="service-detail"/);
  assert.match(await source("src/app/work/[slug]/page.tsx"), /titleContext="work-detail"/);
  assert.match(await source("src/app/admin/case-studies/[slug]/preview/page.tsx"), /titleContext="work-detail"/);

  const pagePreview = await source("src/app/admin/content/pages/[pageKey]/preview/page.tsx");
  assert.equal((pagePreview.match(/titleContext="standard"/g) ?? []).length, 3);
  assert.doesNotMatch(pagePreview, /titleContext="(?:service-detail|work-detail)"/);
});

test("Home Hero remains independently scaled at the accepted 0.90 value", () => {
  const variables = designSettingsToCssVariables({
    version: 1,
    colors,
    typography: {
      eyebrow,
      home_hero_title: { scale: 0.9 },
      page_route_title: { scale: 1.1 },
    },
  });
  assert.equal(variables["--type-h1-hero-size"], "clamp(2.88rem, 6.3vw, 6.21rem)");
  assert.equal(variables["--type-h1-hero-mobile-size"], "clamp(2.61rem, 13.5vw, 4.05rem)");
});

test("no Page / Route CMS control or arbitrary per-component scaling is introduced", async () => {
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  const css = await source("src/app/globals.css");
  assert.doesNotMatch(fields, /page_route_title|Page \/ Route/i);
  assert.doesNotMatch(page, /page_route_title|Page \/ Route/i);
  const routeRules = css.match(/\.route-hero-content h1[^}]*\}/g) ?? [];
  assert.equal(routeRules.length, 2);
  assert.ok(routeRules.every((rule) => !rule.includes("clamp(")));
  assert.match(css, /--type-h1-page-route-size:\s*clamp\(3rem, 7vw, 6\.4rem\)/);
});
