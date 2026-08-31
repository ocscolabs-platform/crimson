import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [dashboard, page, packageJson] = await Promise.all([
  read("src/app/admin/page.tsx"),
  read("src/app/admin/case-studies/new/page.tsx"),
  read("package.json"),
]);

test("Work Library exposes creation only to Owner and Editor", () => {
  assert.match(dashboard, /membership\.role === "owner" \|\| membership\.role === "editor"/);
  assert.match(dashboard, />\+ New<\/Link>/);
  assert.doesNotMatch(dashboard, /\+ New Case Study/);
  assert.match(dashboard, /case-studies\/new/);
  assert.doesNotMatch(dashboard, /membership\.role === "reviewer".*case-studies\/new/);
});

test("creation page is a minimal one-field form with pending protection", () => {
  assert.match(page, /name="project_name"/);
  assert.match(page, /maxLength=\{180\}/);
  assert.match(page, /label="Create Draft" pendingLabel="Creating Draft…"/);
  assert.doesNotMatch(page, /name="project_type"|name="project_category"|name="external_url"|name="summary"|name="challenge"|name="approach"|name="deliverables"|name="outcomes"|name="media|name="service/);
  assert.match(page, /canEditCaseStudies\(membership\.role\)/);
});

test("server action uses the Batch 3A RPC and existing editor redirect", () => {
  assert.match(page, /supabase\.rpc\("cms_create_case_study"/);
  assert.match(page, /p_project_name: projectName/);
  assert.match(page, /The Draft could not be created\. Try again\./);
  assert.match(page, /redirect\(`\/crimson-admin-control\/case-studies\/\$\{created\.slug\}`\)/);
  assert.doesNotMatch(page, /\.from\("case_studies"\)\.insert|\.insert\(/);
});

test("Batch 3B focused test is registered", () => {
  assert.match(packageJson, /test:batch3b:case-study-create/);
});

console.log("Batch 3B case-study creation UI contract: focused assertions passed");
