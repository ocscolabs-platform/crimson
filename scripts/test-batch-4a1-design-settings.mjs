import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_DESIGN_SETTINGS_V1,
  DESIGN_SETTINGS_V1_COLOR_KEYS,
  normalizeDesignSettingsV1,
  validateDesignSettingsV1,
} from "../src/lib/design-settings.ts";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("the v1 default document validates and contains exactly the approved colors", () => {
  const result = validateDesignSettingsV1(DEFAULT_DESIGN_SETTINGS_V1);
  assert.equal(result.success, true);
  assert.deepEqual(Object.keys(DEFAULT_DESIGN_SETTINGS_V1.colors), [...DESIGN_SETTINGS_V1_COLOR_KEYS]);
});

test("partial values resolve to immutable current defaults", () => {
  const result = normalizeDesignSettingsV1({ version: 1, colors: { green: "#123456" } });
  assert.equal(result.colors.green, "#123456");
  assert.equal(result.colors.ink, DEFAULT_DESIGN_SETTINGS_V1.colors.ink);
  assert.equal(result.colors.copy, DEFAULT_DESIGN_SETTINGS_V1.colors.copy);
});

test("malformed colors fail strict validation and normalize safely", () => {
  const input = { version: 1, colors: { ...DEFAULT_DESIGN_SETTINGS_V1.colors, green: "rgb(0 0 0)", ink: "#fff" } };
  const validation = validateDesignSettingsV1(input);
  assert.equal(validation.success, false);
  const normalized = normalizeDesignSettingsV1(input);
  assert.equal(normalized.colors.green, DEFAULT_DESIGN_SETTINGS_V1.colors.green);
  assert.equal(normalized.colors.ink, DEFAULT_DESIGN_SETTINGS_V1.colors.ink);
});

test("unknown keys are rejected by validation and cannot become active tokens", () => {
  const input = { version: 1, colors: { ...DEFAULT_DESIGN_SETTINGS_V1.colors, ultraviolet: "#123456" }, future: true };
  assert.equal(validateDesignSettingsV1(input).success, false);
  const normalized = normalizeDesignSettingsV1(input);
  assert.equal("ultraviolet" in normalized.colors, false);
  assert.equal("future" in normalized, false);
});

test("revision and publish paths preserve existing settings and accept only valid design data", async () => {
  const revisions = await source("supabase/migrations/20260821020000_add_cms_revisions.sql");
  const compatibility = await source("supabase/migrations/20260824000000_add_phase5a_page_document_workflow_contract.sql");
  const migration = await source("supabase/migrations/20260831110000_add_design_settings_storage_contract.sql");
  assert.match(revisions, /select to_jsonb\(s\) into current_payload/);
  assert.match(revisions, /merged_payload := merged_payload \|\| p_payload/);
  assert.match(migration, /add column if not exists design_settings jsonb not null/);
  assert.match(migration, /design_settings = coalesce\(revision\.payload->'design_settings', design_settings\)/);
  assert.match(migration, /cms_design_settings_v1_is_valid/);
  assert.match(migration, /p_design_settings->'colors'/);
  assert.match(compatibility, /cms_publish_revision/);
  assert.doesNotMatch(migration, /create table .*design_settings/i);
  assert.doesNotMatch(migration, /cms_members.*design_settings/i);
});

test("application defaults remain in exact parity with globals.css", async () => {
  const css = await source("src/app/globals.css");
  for (const [key, value] of Object.entries(DEFAULT_DESIGN_SETTINGS_V1.colors)) {
    assert.match(css, new RegExp(`--${key}:\\s*${value.replace("#", "\\#")};`));
  }
});

test("the public loader normalizes the persisted field without applying CSS variables", async () => {
  const loader = await source("src/lib/cms-content.ts");
  assert.match(loader, /design_settings/);
  assert.match(loader, /normalizeDesignSettingsV1/);
  assert.match(loader, /getPublishedDesignSettings/);
  assert.doesNotMatch(loader, /style=|--ink/);
});
