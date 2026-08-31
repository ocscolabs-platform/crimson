import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("successful Restore lifecycle returns to reusable idle state", async () => {
  const control = await read("src/app/admin/content/pages/_components/PageDocumentRestoreControl.tsx");

  assert.match(control, /const \[showSuccess, setShowSuccess\] = useState\(false\)/);
  assert.match(control, /state\.status === "success"/);
  assert.match(control, /setConfirmationOpen\(false\)/);
  assert.match(control, /setSubmitLocked\(false\)/);
  assert.match(control, /setShowSuccess\(true\)/);
  assert.match(control, /router\.refresh\(\)/);
  assert.match(control, /\[router, state\.status, state\.revisionId\]/);
  assert.match(control, /\{confirmationOpen \? \(/);
  assert.doesNotMatch(control, /confirmationOpen && state\.status !== "success"/);
  assert.match(control, /setShowSuccess\(false\);\s+setConfirmationOpen\(true\)/);
});

test("Restore failure returns to retryable idle while preserving safe error UX", async () => {
  const control = await read("src/app/admin/content/pages/_components/PageDocumentRestoreControl.tsx");
  const actions = await read("src/app/admin/content/pages/actions.ts");

  assert.match(control, /state\.status === "error"/);
  assert.match(control, /else if \(state\.status === "error"\)/);
  assert.match(control, /setSubmitLocked\(false\)/);
  assert.match(control, /disabled=\{locked\}/);
  assert.match(control, /onClick=\{\(\) => setConfirmationOpen\(false\)\}/);
  assert.match(actions, /The public page was not changed/);
  assert.match(actions, /Reload and try again/);
});

test("Restore repeat protection remains locked during the first pending submission", async () => {
  const control = await read("src/app/admin/content/pages/_components/PageDocumentRestoreControl.tsx");
  const submitButton = await read("src/app/admin/AdminSubmitButton.tsx");

  assert.match(control, /const locked = pending \|\| \(submitLocked && state\.status === "idle"\)/);
  assert.match(control, /if \(locked\) \{\s+event\.preventDefault\(\);\s+return;\s+\}/s);
  assert.match(control, /setSubmitLocked\(true\)/);
  assert.match(control, /disabled=\{locked\}/);
  assert.match(control, /<AdminSubmitButton[\s\S]*label="Confirm Restore revision"[\s\S]*pendingLabel="Restoring…"/);
  assert.match(submitButton, /const locked = pending \|\| disabled/);
  assert.match(submitButton, /locked \? \(\s*<>[\s\S]*pendingLabel/);
});
