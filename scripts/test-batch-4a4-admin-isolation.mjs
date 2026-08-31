import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_DESIGN_SETTINGS_V1,
  DESIGN_SETTINGS_V1_COLOR_KEYS,
} from "../src/lib/design-settings.ts";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

function adminIsolationBlock(css) {
  const match = css.match(/\/\* Stable CMS theme: public Design Settings do not cascade into normal admin UI\. \*\/\s*\.admin-page:not\(:has\(\.insights-preview-banner\)\)\s*\{([\s\S]*?)\}/);
  assert.ok(match, "the stable admin isolation block exists");
  return match[1];
}

test("the admin root overrides all approved variables with the immutable defaults", async () => {
  const css = await source("src/app/globals.css");
  const block = adminIsolationBlock(css);
  for (const key of DESIGN_SETTINGS_V1_COLOR_KEYS) {
    assert.match(block, new RegExp(`--${key}:\\s*${DEFAULT_DESIGN_SETTINGS_V1.colors[key].replace("#", "\\#")};`));
  }
});

test("the admin boundary resets public colors and eyebrow typography only", async () => {
  const css = await source("src/app/globals.css");
  const block = adminIsolationBlock(css);
  const variables = [...block.matchAll(/--([a-z-]+)\s*:/g)].map((match) => match[1]);
  assert.deepEqual(variables, [
    ...DESIGN_SETTINGS_V1_COLOR_KEYS,
    "type-eyebrow-size",
    "type-eyebrow-weight",
    "type-eyebrow-line-height",
    "type-eyebrow-letter-spacing",
  ]);
  assert.match(block, /--type-eyebrow-size:\s*\.72rem;/);
  assert.match(block, /--type-eyebrow-weight:\s*800;/);
  assert.match(block, /--type-eyebrow-line-height:\s*1\.4;/);
  assert.match(block, /--type-eyebrow-letter-spacing:\s*\.16em;/);
});

test("the existing login surface is already inside the same admin boundary", async () => {
  const css = await source("src/app/globals.css");
  const login = await source("src/app/admin/login/page.tsx");
  assert.match(css, /\.admin-login-page\s*\{[^}]*var\(--ink\)/s);
  assert.match(login, /className="admin-page admin-login-page"/);
});

test("authenticated public-content Preview remains outside admin isolation", async () => {
  const routeShellPreviewPaths = [
    "src/app/admin/content/pages/[pageKey]/preview/page.tsx",
    "src/app/admin/case-studies/[slug]/preview/page.tsx",
  ];
  for (const path of routeShellPreviewPaths) {
    const page = await source(path);
    assert.doesNotMatch(page, /admin-page/);
    assert.match(page, /RouteShell|public|Preview/);
  }
  const insightsPreview = await source("src/app/admin/insights/articles/[id]/preview/page.tsx");
  const css = await source("src/app/globals.css");
  assert.match(insightsPreview, /className="admin-page"/);
  assert.match(insightsPreview, /insights-preview-banner/);
  assert.match(css, /\.admin-page:not\(:has\(\.insights-preview-banner\)\)/);
});

test("the public root mapping remains the Batch 4A2 boundary", async () => {
  const layout = await source("src/app/layout.tsx");
  const mapper = await source("src/lib/design-settings.ts");
  assert.match(layout, /getPublishedDesignSettings/);
  assert.match(layout, /designSettingsToCssVariables\(designSettings\)/);
  assert.match(mapper, /DESIGN_SETTINGS_V1_COLOR_KEYS\.map\(\(key\) => \[`--\$\{key\}`, settings\.colors\[key\]\]\)/);
});

test("Design Settings controls do not become admin theme configuration", async () => {
  const adminDashboard = await source("src/app/admin/page.tsx");
  const adminContent = await source("src/app/admin/content/page.tsx");
  assert.match(adminDashboard, /Design Settings/);
  assert.match(adminContent, /Design Settings/);
  assert.doesNotMatch(adminDashboard, /color picker|adminTheme/i);
  assert.doesNotMatch(adminContent, /adminTheme/i);
  assert.doesNotMatch(adminDashboard, /designSettings|adminTheme/i);
  assert.match(adminContent, /designSettings/);
});
