import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_DESIGN_SETTINGS_V1,
  DESIGN_SETTINGS_V1_COLOR_KEYS,
  designSettingsToCssVariables,
} from "../src/lib/design-settings.ts";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

const colors = { ...DEFAULT_DESIGN_SETTINGS_V1.colors };
const eyebrow = { ...DEFAULT_DESIGN_SETTINGS_V1.typography.eyebrow, size: 0.84, weight: 600, line_height: 1.6, letter_spacing: 0.2 };

test("published eyebrow values map to the existing semantic variables with CSS units", () => {
  const variables = designSettingsToCssVariables({ version: 1, colors, typography: { eyebrow } });
  assert.equal(variables["--type-eyebrow-size"], "0.84rem");
  assert.equal(variables["--type-eyebrow-weight"], "600");
  assert.equal(variables["--type-eyebrow-line-height"], "1.6");
  assert.equal(variables["--type-eyebrow-letter-spacing"], "0.2em");
  assert.deepEqual(
    Object.keys(variables),
    [...DESIGN_SETTINGS_V1_COLOR_KEYS.map((key) => `--${key}`), "--type-eyebrow-size", "--type-eyebrow-weight", "--type-eyebrow-line-height", "--type-eyebrow-letter-spacing", "--type-h1-hero-size", "--type-h1-hero-mobile-size"],
  );
});

test("absent, partial, and malformed eyebrow data always emit the required defaults", () => {
  const cases = [
    { version: 1, colors },
    { version: 1, colors, typography: { eyebrow: { size: 0.8 } } },
    { version: 1, colors, typography: { eyebrow: { size: "0.8rem", weight: 900, line_height: 3, letter_spacing: "0.2em" } } },
  ];
  for (const input of cases) {
    const variables = designSettingsToCssVariables(input);
    assert.equal(typeof variables["--type-eyebrow-size"], "string");
    assert.equal(typeof variables["--type-eyebrow-weight"], "string");
    assert.equal(typeof variables["--type-eyebrow-line-height"], "string");
    assert.equal(typeof variables["--type-eyebrow-letter-spacing"], "string");
  }
  const partial = designSettingsToCssVariables(cases[1]);
  assert.equal(partial["--type-eyebrow-size"], "0.8rem");
  assert.equal(partial["--type-eyebrow-weight"], "800");
  const malformed = designSettingsToCssVariables(cases[2]);
  assert.equal(malformed["--type-eyebrow-size"], "0.72rem");
  assert.equal(malformed["--type-eyebrow-letter-spacing"], "0.16em");
});

test("unknown typography roles cannot emit runtime variables and approved colors remain mapped", () => {
  const variables = designSettingsToCssVariables({ version: 1, colors, typography: { heading: { size: 2 } } });
  assert.equal("--type-heading-size" in variables, false);
  assert.equal(variables["--green"], colors.green);
  assert.equal(variables["--ink"], colors.ink);
});

test("the public root and preview boundaries reuse the existing runtime architecture", async () => {
  const layout = await source("src/app/layout.tsx");
  const css = await source("src/app/globals.css");
  const casePreview = await source("src/app/admin/case-studies/[slug]/preview/page.tsx");
  const pagePreview = await source("src/app/admin/content/pages/[pageKey]/preview/page.tsx");
  const insightsPreview = await source("src/app/admin/insights/articles/[id]/preview/page.tsx");
  assert.match(layout, /getPublishedDesignSettings/);
  assert.match(layout, /designSettingsToCssVariables\(designSettings\)/);
  assert.match(css, /\.overline \{[^}]*var\(--type-eyebrow-size\)[^}]*var\(--type-eyebrow-weight\)[^}]*var\(--type-eyebrow-letter-spacing\)[^}]*var\(--type-eyebrow-line-height\)/s);
  assert.doesNotMatch(casePreview, /admin-page/);
  assert.doesNotMatch(pagePreview, /admin-page/);
  assert.match(insightsPreview, /insights-preview-banner/);
});

test("ordinary admin resets eyebrow variables to immutable defaults while the CMS exposes only Eyebrow controls", async () => {
  const css = await source("src/app/globals.css");
  const fields = await source("src/app/admin/content/DesignSettingsFields.tsx");
  const page = await source("src/app/admin/content/page.tsx");
  const adminBoundary = css.match(/\.admin-page:not\(:has\(\.insights-preview-banner\)\)\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  assert.match(adminBoundary, /--type-eyebrow-size:\s*\.72rem/);
  assert.match(adminBoundary, /--type-eyebrow-weight:\s*800/);
  assert.match(adminBoundary, /--type-eyebrow-line-height:\s*1\.4/);
  assert.match(adminBoundary, /--type-eyebrow-letter-spacing:\s*\.16em/);
  assert.match(fields, /Typography <small>Eyebrow \/ Overline/);
  assert.match(page, /design_eyebrow_letter_spacing/);
  assert.doesNotMatch(fields, /font-family|H1 typography|H2 typography|H3 typography|Lead typography|Typography Reset/i);
  assert.doesNotMatch(page, /font-family|H1 typography|H2 typography|H3 typography|Lead typography|Typography Reset/);
});

test("existing color mapping and Reset behavior remain present", async () => {
  const page = await source("src/app/admin/content/page.tsx");
  const reset = await source("src/app/admin/content/DesignSettingsResetControl.tsx");
  assert.match(page, /typography: currentDesignSettings\.typography/);
  assert.match(page, /Save Design Settings as review/);
  assert.match(reset, /Reset to Default/);
  const variables = designSettingsToCssVariables({ version: 1, colors: { ...colors, green: "#123456" } });
  assert.equal(variables["--green"], "#123456");
  assert.equal(variables["--type-eyebrow-size"], "0.72rem");
});
