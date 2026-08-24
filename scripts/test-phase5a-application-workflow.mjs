import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

test("PageDocument application workflow uses only the approved transition RPCs", async () => {
  const actions = await read("src/app/admin/content/pages/actions.ts");
  assert.match(actions, /cms_page_document_save_draft/);
  assert.match(actions, /cms_page_document_submit_for_review/);
  assert.match(actions, /cms_page_document_return_to_draft/);
  assert.doesNotMatch(actions, /cms_save_revision/);
  assert.doesNotMatch(actions, /cms_page_document_publish|cms_page_document_restore/);
  assert.doesNotMatch(actions, /error\.message/);
});

test("PageDocument adapters allow only the four approved pages", async () => {
  const source = await read("src/lib/admin-page-documents.ts");
  const adapterBlock = source.slice(source.indexOf("export const PAGE_DOCUMENT_ADMIN_ADAPTERS"), source.indexOf("const PAGE_DOCUMENT_ADMIN_ADAPTER_MAP"));
  for (const pageKey of ["home", "services", "about", "contact"]) assert.match(adapterBlock, new RegExp(`pageKey: "${pageKey}"`));
  assert.doesNotMatch(adapterBlock, /work/i);
  assert.match(source, /published_revision_id/);
});

test("Published identity is pointer-authoritative and public reads remain Published-only", async () => {
  const adminModel = await read("src/lib/admin-page-documents.ts");
  const publicLoader = await read("src/lib/page-document-loader.ts");
  assert.match(adminModel, /revisions\.find\(\(revision\) => revision\.id === page\.published_revision_id\)/);
  assert.match(adminModel, /revision\.id === page\?\.published_revision_id/);
  assert.match(publicLoader, /\.eq\("status", "published"\)/);
  assert.doesNotMatch(publicLoader, /\.eq\("status", "draft"\)|\.eq\("status", "review"\)/);
});

test("Review is immutable in the editor and roles are explicit", async () => {
  const page = await read("src/app/admin/content/pages/[pageKey]/page.tsx");
  const controls = await read("src/app/admin/content/pages/_components/PageDocumentWorkflowControls.tsx");
  assert.match(page, /page\.activeRevision\.status === "review"/);
  assert.match(page, /Review is immutable/);
  assert.match(page, /membership\.role === "owner" \|\| membership\.role === "editor"/);
  assert.match(controls, /Reviewer access is read-only/);
  assert.match(controls, /Submit for Review/);
  assert.match(controls, /Return to Draft/);
});

test("History and audit presentation preserve newest-first markers", async () => {
  const model = await read("src/lib/admin-page-documents.ts");
  const page = await read("src/app/admin/content/pages/[pageKey]/page.tsx");
  assert.match(model, /\.sort\(\(left, right\) => Date\.parse\(right\.updated_at\) - Date\.parse\(left\.updated_at\)\)/);
  assert.match(model, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(model, /cms_workflow_audit_log/);
  assert.match(page, /Revision and workflow history/);
  assert.match(page, /Immutable record/);
});

test("Approved application surface contains no Publish or Restore callable controls", async () => {
  const editor = await read("src/app/admin/content/pages/_components/PageDocumentEditor.tsx");
  const controls = await read("src/app/admin/content/pages/_components/PageDocumentWorkflowControls.tsx");
  assert.doesNotMatch(editor, /\bPublish\b|\bRestore\b|cms_page_document_publish|cms_page_document_restore/);
  assert.doesNotMatch(controls, /\bPublish\b|\bRestore\b|cms_page_document_publish|cms_page_document_restore/);
});
