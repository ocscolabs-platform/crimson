import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Batch 3B uses the dedicated Owner-only canonical publish action", async () => {
  const actions = await read("src/app/admin/content/pages/actions.ts");

  assert.match(actions, /getAuthorizedOwnerPageAction/);
  assert.match(actions, /authorized\.role !== "owner"/);
  assert.match(actions, /export async function publishPageDocument/);
  assert.match(actions, /supabase\.rpc\("cms_page_document_publish"/);
  assert.match(actions, /p_page_key: authorized\.adapter\.pageKey/);
  assert.match(actions, /p_revision_id: revisionId/);
  assert.match(actions, /p_expected_updated_at: expectedUpdatedAt/);
  assert.doesNotMatch(actions, /cms_page_document_restore/);
  assert.doesNotMatch(actions, /errorState\(error\?\.message/);
});

test("Publish is Review-only, uses exact updated_at, confirms the public transition, and guards repeat submission", async () => {
  const page = await read("src/app/admin/content/pages/[pageKey]/page.tsx");
  const control = await read("src/app/admin/content/pages/_components/PageDocumentPublishControl.tsx");

  assert.match(page, /page\.activeRevision\.status === "review"/);
  assert.match(page, /membership\.role === "owner"/);
  assert.match(page, /expectedUpdatedAt=\{page\.activeRevision\.updatedAt\}/);
  assert.match(page, /validationIssues\.length === 0/);
  assert.match(control, /Publish changes/);
  assert.match(control, /role="dialog"/);
  assert.match(control, /current Review to Published/);
  assert.match(control, /previous Published revision will become Archived/);
  assert.match(control, /name="expected_updated_at" value=\{expectedUpdatedAt\}/);
  assert.match(control, /const \[submitLocked, setSubmitLocked\] = useState\(false\)/);
  assert.match(control, /const locked = pending \|\| submitLocked/);
  assert.match(control, /disabled=\{locked\}/);
  assert.match(control, /onClick=\{onCancel\}/);
  assert.match(control, /onCancel=\{\(\) => setConfirmationOpen\(false\)\}/);
  assert.doesNotMatch(control, /Restore|cms_page_document_restore/);
});

test("History remains pointer- and audit-authoritative while public loaders remain Published-only", async () => {
  const model = await read("src/lib/admin-page-documents.ts");
  const publicLoader = await read("src/lib/page-document-loader.ts");

  assert.match(model, /published_revision_id/);
  assert.match(model, /revision\.id === page\?\.published_revision_id/);
  assert.match(model, /publish_archived_previous/);
  assert.match(model, /published/);
  assert.match(publicLoader, /\.eq\("status", "published"\)/);
});

test("The four approved page adapters remain the only publishable PageDocument targets", async () => {
  const adminModel = await read("src/lib/admin-page-documents.ts");
  for (const pageKey of ["home", "services", "about", "contact"]) {
    assert.match(adminModel, new RegExp(`pageKey: "${pageKey}"`));
  }
});
