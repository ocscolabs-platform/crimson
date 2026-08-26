import assert from "node:assert/strict";
import test from "node:test";
import { emptyInsightsBody, validateInsightsBody } from "../src/lib/insights-body.ts";
import { getUniqueInsightsSlugCandidate, isValidInsightsSlug, slugifyInsightsTitle } from "../src/lib/insights-slug.ts";
import { readFile } from "node:fs/promises";

const body = emptyInsightsBody();

test("body schema accepts the empty v1 envelope", () => {
  assert.equal(validateInsightsBody(body).success, true);
});

test("body validator rejects H1, code blocks, unknown nodes, and unsafe links", () => {
  for (const node of [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "No" }] },
    { type: "codeBlock", content: [{ type: "text", text: "No" }] },
    { type: "script", content: [] },
    { type: "paragraph", content: [{ type: "text", text: "No", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }] },
  ]) {
    assert.equal(validateInsightsBody({ ...body, doc: { type: "doc", content: [node] } }).success, false);
  }
});

test("body validator rejects unknown attributes and pathological depth", () => {
  assert.equal(validateInsightsBody({ ...body, doc: { type: "doc", content: [{ type: "paragraph", attrs: { class: "unsafe" } }] } }).success, false);
  let nested = { type: "paragraph" };
  for (let index = 0; index < 14; index += 1) nested = { type: "blockquote", content: [nested] };
  assert.equal(validateInsightsBody({ ...body, doc: { type: "doc", content: [nested] } }).success, false);
});

test("server slug generation is lowercase, bounded, and deterministic", () => {
  assert.equal(slugifyInsightsTitle("Café & Systems: A Better Way"), "cafe-systems-a-better-way");
  assert.equal(isValidInsightsSlug("cafe-systems"), true);
  assert.equal(isValidInsightsSlug("Bad Slug"), false);
  assert.equal(getUniqueInsightsSlugCandidate("a-safe-title", 2), "a-safe-title-2");
  assert.equal(getUniqueInsightsSlugCandidate("a".repeat(120), 10).length, 120);
});

test("B6B1 application contracts remain scoped to Draft authoring", async () => {
  const files = await Promise.all([
    "../src/app/admin/insights/page.tsx",
    "../src/app/admin/insights/articles/new/page.tsx",
    "../src/app/admin/insights/articles/[id]/page.tsx",
    "../src/app/admin/insights/articles/Composer.tsx",
    "../src/app/admin/insights/articles/actions.ts",
    "../src/lib/insights-renderer.tsx",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const source = files.join("\n");
  for (const required of ["Save Draft", "insights_save_draft", "insights_create_article", "insights_update_article_slug", "schema: \"insights-body\"", "autosave", "Read-only article state"]) {
    assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(source, /renderInsightsBody/);
  assert.match(source, /noreferrer noopener/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  for (const forbidden of ["insights_publish_article", "Preview route", "<img", "ImageUpload"]) assert.doesNotMatch(source, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
