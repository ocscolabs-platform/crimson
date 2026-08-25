import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("authenticated PageDocument Preview is private and revision-scoped", async () => {
  const loader = await source("src/lib/page-document-preview.ts");
  assert.match(loader, /getUser\(\)/);
  assert.match(loader, /owner.*editor.*reviewer/);
  assert.match(loader, /entity_type.*page/);
  assert.match(loader, /entity_key.*page\.id/);
  assert.match(loader, /in\("status", \["draft", "review"\]\)/);
  assert.match(loader, /validatePageDocument/);
  assert.doesNotMatch(loader, /cms_publish_revision|cms_restore_revision|cms_save_revision/);
});

test("Preview route is limited to approved pages and request-time rendering", async () => {
  const route = await source("src/app/admin/content/pages/[pageKey]/preview/page.tsx");
  assert.match(route, /force-dynamic/);
  assert.match(route, /force-no-store/);
  assert.match(route, /revision_id/);
  assert.match(route, /getAuthenticatedPageDocumentPreview/);
  assert.match(route, /preview\.pageKey === "home"/);
  assert.match(route, /preview\.pageKey === "services"/);
  assert.match(route, /preview\.pageKey === "about"/);
  assert.match(route, /ContactPageBody body=\{body\} preview/);
  assert.doesNotMatch(route, /pageKey === "work"/);
});

test("CMS exposes Preview only for a valid active Draft or Review", async () => {
  const admin = await source("src/app/admin/content/pages/[pageKey]/page.tsx");
  assert.match(admin, /Preview Review/);
  assert.match(admin, /Preview Draft/);
  assert.match(admin, /activeDocument/);
  assert.match(admin, /revision_id=/);
});

test("Contact Preview cannot submit inquiries", async () => {
  const form = await source("src/components/contact-form.tsx");
  assert.match(form, /preview/);
  assert.match(form, /if \(preview\) return/);
  assert.match(form, /type=\{preview \? "button" : "submit"\}/);
  assert.match(form, /Preview mode — submissions are disabled/);
});

test("public loader remains Published-only", async () => {
  const loader = await source("src/lib/page-document-loader.ts");
  assert.match(loader, /eq\("status", "published"\)/);
});
