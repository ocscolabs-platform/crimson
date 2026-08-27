import assert from "node:assert/strict";
import fs from "node:fs";

const controls = fs.readFileSync("src/app/admin/insights/articles/WorkflowControls.tsx", "utf8");
const page = fs.readFileSync("src/app/admin/insights/articles/[id]/page.tsx", "utf8");
const actions = fs.readFileSync("src/app/admin/insights/articles/actions.ts", "utf8");

assert.match(controls, /canEditPublished = props\.status === "published"/);
assert.match(controls, /<summary className="button button-light">Edit Article<\/summary>/);
assert.match(controls, /Create Draft to Edit/);
assert.match(controls, /The Published revision will remain immutable and public until the Draft is published/);
assert.match(controls, /name="source_revision_id" value=\{props\.revisionHistory\[0\]\?\.id/);
assert.match(controls, /action=\{restoreAction\}/);
assert.match(page, /article\.status === "unpublished" \|\| article\.status === "published"/);
assert.match(actions, /insights_restore_revision/);

console.log("Phase 6 Owner Published → Draft regression: 7/7 passed");
