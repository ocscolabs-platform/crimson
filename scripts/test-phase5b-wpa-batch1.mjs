import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const adapterSource = read("src/lib/admin-page-documents.ts");
const indexSource = read("src/app/admin/content/pages/page.tsx");
const editorSource = read("src/app/admin/content/pages/[pageKey]/page.tsx");
const accessSource = read("src/app/admin/content/pages/_lib.ts");
const readonlySource = read("src/app/admin/content/pages/_components/PageDocumentReadOnly.tsx");
const dashboardSource = read("src/app/admin/page.tsx");

test("Batch 1 exposes exactly the four approved PageDocument keys", () => {
  for (const pageKey of ["home", "services", "about", "contact"]) {
    assert.match(adapterSource, new RegExp(`pageKey: "${pageKey}"`));
  }
  assert.doesNotMatch(adapterSource, /pageKey: "work"/);
  assert.match(adapterSource, /PAGE_DOCUMENT_ADMIN_ADAPTERS/);
});

test("Batch 1 rejects unknown keys through the shared adapter boundary", () => {
  assert.match(editorSource, /getPageDocumentAdminAdapter\(pageKey\)/);
  assert.match(editorSource, /if \(!adapter\) notFound\(\)/);
  assert.doesNotMatch(editorSource, /params\.pageKey.*work/);
});

test("Batch 1 uses authenticated server reads and the canonical validator", () => {
  assert.match(accessSource, /createClient\(\)/);
  assert.match(accessSource, /getCmsMembership/);
  assert.match(adapterSource, /validatePageDocument/);
  assert.match(adapterSource, /from\("pages"\)/);
  assert.match(adapterSource, /from\("cms_revisions"\)/);
  assert.match(indexSource, /getAdminPageDocumentReadModel/);
  assert.match(editorSource, /getAdminPageDocumentReadModel/);
});

test("Batch 1 contains no PageDocument mutation path", () => {
  const implementation = [adapterSource, indexSource, editorSource, accessSource, readonlySource].join("\n");
  for (const forbidden of ["cms_save_revision", "cms_publish_revision", "cms_restore_revision", ".insert(", ".update(", ".delete(", ".rpc("]) {
    assert.equal(implementation.includes(forbidden), false, `Unexpected mutation marker: ${forbidden}`);
  }
});

test("Batch 1 preserves the Services and Contact authority boundaries", () => {
  assert.match(editorSource, /canonical validator|canonical PageDocument/i);
  assert.match(editorSource, /Legacy controls preserved/);
  assert.match(editorSource, /Work remains legacy|Work.*excluded/i);
  assert.match(editorSource, /canonical public\.services/i);
  assert.match(editorSource, /functional ContactForm/);
  assert.match(dashboardSource, /content\/pages/);
});

test("Batch 1 keeps the direct admin namespace protected by the existing proxy", () => {
  const proxySource = read("src/proxy.ts");
  assert.match(proxySource, /pathname === "\/admin"/);
  assert.match(proxySource, /status: 404/);
});
