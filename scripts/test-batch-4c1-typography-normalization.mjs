import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

function cssRule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `CSS rule exists for ${selector}`);
  return match[1];
}

test("semantic typography token values preserve the approved baseline", async () => {
  const css = await source("src/app/globals.css");
  const expected = [
    "--type-body-size: 1rem;",
    "--type-body-weight: 400;",
    "--type-body-line-height: normal;",
    "--type-eyebrow-size: .72rem;",
    "--type-eyebrow-weight: 800;",
    "--type-eyebrow-letter-spacing: .16em;",
    "--type-eyebrow-line-height: 1.4;",
    "--type-lead-size: clamp(1.05rem, 1.8vw, 1.3rem);",
    "--type-lead-line-height: 1.65;",
  ];
  for (const declaration of expected) assert.match(css, new RegExp(declaration.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(cssRule(css, ".overline"), /font-size: var\(--type-eyebrow-size\)/);
  assert.match(cssRule(css, ".lead-copy"), /font-size: var\(--type-lead-size\)/);
  assert.match(cssRule(css, ".route-copy"), /line-height: var\(--type-lead-line-height\)/);
});

test("named H1 and H2 variants preserve every current clamp contract", async () => {
  const css = await source("src/app/globals.css");
  const expected = [
    ["--type-h1-hero-size", "clamp(3.2rem, 7vw, 6.9rem)"],
    ["--type-h1-hero-mobile-size", "clamp(2.9rem, 15vw, 4.5rem)"],
    ["--type-h1-route-size", "clamp(3rem, 7vw, 6.4rem)"],
    ["--type-h1-article-size", "clamp(2.8rem, 7vw, 6.6rem)"],
    ["--type-h2-section-size", "clamp(2.4rem, 5vw, 4.8rem)"],
    ["--type-h2-detail-size", "clamp(2.2rem, 4.5vw, 4.5rem)"],
    ["--type-h2-list-size", "clamp(2.3rem, 4.5vw, 4.5rem)"],
    ["--type-h2-featured-size", "clamp(2.8rem, 6vw, 6rem)"],
  ];
  for (const [name, value] of expected) assert.match(css, new RegExp(`${name}:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")};`));
  assert.match(cssRule(css, ".hero h1"), /font-size: var\(--type-h1-hero-size\)/);
  assert.match(cssRule(css, ".route-hero-content h1"), /font-size: var\(--type-h1-route-size\)/);
  assert.match(cssRule(css, ".work-featured-copy h2"), /font-size: var\(--type-h2-featured-size\)/);
  assert.match(cssRule(css, ".work-library-heading h2"), /font-size: var\(--type-h2-list-size\)/);
  assert.match(cssRule(css, ".public-insights-article-header h1"), /font-size: var\(--type-h1-article-size\)/);
});

test("Work and Insights card titles share one contract without collapsing their existing size variants", async () => {
  const css = await source("src/app/globals.css");
  assert.match(css, /--type-card-title-letter-spacing:\s*-\.045em;/);
  assert.match(css, /--type-card-title-line-height:\s*1\.05;/);
  assert.match(css, /--type-card-title-work-size:\s*clamp\(1\.6rem, 2\.5vw, 2\.4rem\);/);
  assert.match(css, /--type-card-title-insights-size:\s*clamp\(1\.55rem, 2\.5vw, 2\.35rem\);/);
  assert.match(cssRule(css, ".work-card-content h3"), /var\(--type-card-title-work-size\)/);
  assert.match(cssRule(css, ".public-insights-card h3"), /var\(--type-card-title-insights-size\)/);
  assert.match(cssRule(css, ".work-card-content h3"), /var\(--type-card-title-letter-spacing\)/);
  assert.match(cssRule(css, ".public-insights-card h3"), /var\(--type-card-title-line-height\)/);
});

test("component-specific headings and supporting text remain outside the shared tokens", async () => {
  const css = await source("src/app/globals.css");
  assert.match(css, /\.approach-item h3[^}]*font-size: 1\.2rem[^}]*letter-spacing: -\.02em/s);
  assert.match(css, /\.public-insights-body h3[^}]*font-size: 1\.35rem[^}]*letter-spacing: -\.025em/s);
  assert.match(css, /\.route-grid h2 \{ font-size: 1\.55rem; \}/);
  assert.match(css, /\.work-card-category[^}]*font-size: \.78rem[^}]*letter-spacing: \.05em/s);
  assert.match(css, /\.footer-bottom[^}]*font-size: \.72rem[^}]*letter-spacing: \.08em/s);
  assert.doesNotMatch(css, /type-h4|type-h5|type-small/);
});

test("normalization does not add CMS typography controls or runtime CMS values", async () => {
  const designSettings = await source("src/lib/design-settings.ts");
  const adminContent = await source("src/app/admin/content/page.tsx");
  const migration = await source("supabase/migrations/20260831110000_add_design_settings_storage_contract.sql");
  assert.match(designSettings, /typography/);
  assert.doesNotMatch(adminContent, /Typography|Eyebrow|font-family|line-height|letter-spacing/);
  assert.doesNotMatch(migration, /--type-|designSettings\.typography/i);
});
