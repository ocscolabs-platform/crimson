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

test("the approved colors map one-to-one to the public CSS variables", () => {
  const variables = designSettingsToCssVariables({
    version: 1,
    colors: { ...DEFAULT_DESIGN_SETTINGS_V1.colors, green: "#123456" },
  });

  assert.deepEqual(Object.keys(variables), DESIGN_SETTINGS_V1_COLOR_KEYS.map((key) => `--${key}`));
  assert.equal(variables["--green"], "#123456");
  assert.equal(variables["--ink"], DEFAULT_DESIGN_SETTINGS_V1.colors.ink);
});

test("absent, malformed, or partial settings retain every required variable", () => {
  for (const input of [undefined, null, { version: 1, colors: { green: "not-a-color" } }]) {
    const variables = designSettingsToCssVariables(input);
    assert.deepEqual(Object.keys(variables), DESIGN_SETTINGS_V1_COLOR_KEYS.map((key) => `--${key}`));
    assert.equal(variables["--green"], DEFAULT_DESIGN_SETTINGS_V1.colors.green);
    assert.equal(variables["--copy"], DEFAULT_DESIGN_SETTINGS_V1.colors.copy);
  }
});

test("unapproved values cannot inject extra CSS variables", () => {
  const variables = designSettingsToCssVariables({
    version: 1,
    colors: { ...DEFAULT_DESIGN_SETTINGS_V1.colors, ultraviolet: "#123456" },
    "--danger": "red",
  });

  assert.equal("--ultraviolet" in variables, false);
  assert.equal("--danger" in variables, false);
  assert.equal(Object.keys(variables).length, 8);
});

test("the root layout is the single server-rendered runtime theme boundary", async () => {
  const layout = await source("src/app/layout.tsx");
  const routeShell = await source("src/components/route-shell.tsx");
  const home = await source("src/app/page.tsx");
  const work = await source("src/app/work/[slug]/page.tsx");
  const insights = await source("src/app/insights/page.tsx");

  assert.match(layout, /getPublishedDesignSettings/);
  assert.match(layout, /designSettingsToCssVariables/);
  assert.match(layout, /<html lang="en" style=\{designSettingsToCssVariables\(designSettings\)(?: as CSSProperties)?\}>/);
  for (const page of [routeShell, home, work, insights]) {
    assert.doesNotMatch(page, /designSettingsToCssVariables|--ink|--graphite|--green/);
  }
});

test("published loading is request-deduplicated and admin controls remain unchanged", async () => {
  const loader = await source("src/lib/cms-content.ts");
  const admin = await source("src/app/admin/page.tsx");

  assert.match(loader, /cache\(/);
  assert.doesNotMatch(admin, /Design Settings|color picker|Reset to Default/i);
});

test("static defaults and existing public selectors remain intact", async () => {
  const css = await source("src/app/globals.css");
  const layout = await source("src/app/layout.tsx");

  for (const [key, value] of Object.entries(DEFAULT_DESIGN_SETTINGS_V1.colors)) {
    assert.match(css, new RegExp(`--${key}:\\s*${value.replace("#", "\\#")};`));
  }
  for (const selector of [".hero", ".site-header", ".work-detail-layout", ".section-light"]) {
    assert.match(css, new RegExp(`\\${selector}\\s*\\{`));
  }
  assert.match(layout, /import "\.\/globals\.css"/);
});
