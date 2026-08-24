import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Batch 3C Restore uses the dedicated Owner-only PageDocument action and RPC", async () => {
  const actions = await read("src/app/admin/content/pages/actions.ts");
  assert.match(actions, /export async function restorePageDocument/);
  assert.match(actions, /Only an Owner can restore historical page versions/);
  assert.match(actions, /supabase\.rpc\("cms_page_document_restore"/);
  assert.match(actions, /p_page_key: authorized\.adapter\.pageKey/);
  assert.match(actions, /p_source_revision_id: sourceRevisionId/);
  assert.doesNotMatch(actions, /cms_save_revision/);
  assert.doesNotMatch(actions, /errorState\(error\?\.message/);
});

test("Restore eligibility is Owner-only, archived-only, and pointer-authoritative", async () => {
  const page = await read("src/app/admin/content/pages/[pageKey]/page.tsx");
  const control = await read("src/app/admin/content/pages/_components/PageDocumentRestoreControl.tsx");
  const model = await read("src/lib/admin-page-documents.ts");
  assert.match(page, /canRestore=\{membership\.role === "owner"\}/);
  assert.match(page, /revision\.status === "archived" && !revision\.isPublished/);
  assert.match(model, /revision\.id === page\?\.published_revision_id/);
  assert.match(control, /Restore revision/);
  assert.match(control, /The public site will <strong>not<\/strong> change/);
  assert.match(control, /current editorial revision will be Archived/);
  assert.match(control, /new revision ID/);
});

test("Restore confirmation has strict repeat protection and safe failure UX", async () => {
  const control = await read("src/app/admin/content/pages/_components/PageDocumentRestoreControl.tsx");
  const actions = await read("src/app/admin/content/pages/actions.ts");
  assert.match(control, /const \[submitLocked, setSubmitLocked\] = useState\(false\)/);
  assert.match(control, /const locked = pending \|\| \(submitLocked && state\.status === "idle"\)/);
  assert.match(control, /Restoring…/);
  assert.match(control, /disabled=\{locked\}/);
  assert.match(control, /onClick=\{\(\) => setConfirmationOpen\(false\)\}/);
  assert.match(control, /router\.refresh\(\)/);
  assert.match(actions, /That historical version is no longer available/);
  assert.match(actions, /The editorial state changed while you were restoring/);
  assert.match(actions, /The public page was not changed/);
  assert.doesNotMatch(actions, /errorState\(error\?\.message/);
});

test("Save, Submit, and Return use local one-shot submit locks", async () => {
  const editor = await read("src/app/admin/content/pages/_components/PageDocumentEditor.tsx");
  const controls = await read("src/app/admin/content/pages/_components/PageDocumentWorkflowControls.tsx");
  assert.match(editor, /const \[submitLocked, setSubmitLocked\] = useState\(false\)/);
  assert.match(editor, /disabled=\{locked\}/);
  assert.match(controls, /const \[submitLocked, setSubmitLocked\] = useState\(false\)/);
  assert.match(controls, /disabled=\{locked\}/);
  assert.match(controls, /pending \|\| \(submitLocked && state\.status === "idle"\)/);
});

test("Restore audit presentation uses human labels and preserves relationships", async () => {
  const model = await read("src/lib/admin-page-documents.ts");
  const page = await read("src/app/admin/content/pages/[pageKey]/page.tsx");
  assert.match(model, /actor_user_id/);
  assert.match(model, /actorLabel/);
  assert.match(model, /CMS member/);
  assert.match(page, /Archived active editorial revision/);
  assert.match(page, /Restored historical revision as Review/);
  assert.match(page, /source \$\{entry\.sourceRevisionId\}/);
  assert.match(page, /related \$\{entry\.relatedRevisionId\}/);
});

test("Batch 3C remains schema-neutral and excludes unrelated surfaces", async () => {
  const migration = await read("supabase/migrations/20260824000000_add_phase5a_page_document_workflow_contract.sql");
  const actions = await read("src/app/admin/content/pages/actions.ts");
  assert.match(migration, /cms_page_document_restore/);
  assert.doesNotMatch(actions, /Work|Insights/);
});
