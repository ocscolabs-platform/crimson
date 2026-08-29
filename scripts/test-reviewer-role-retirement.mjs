import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

test("Team & Access exposes only Owner and Editor for normal assignment", async () => {
  const members = await read("src/lib/admin-members.ts");
  const team = await read("src/app/admin/team/page.tsx");

  assert.match(members, /CMS_ROLES = \["owner", "editor"\]/);
  assert.match(members, /CMS_PERSISTED_ROLES = \["owner", "editor", "reviewer"\]/);
  assert.match(members, /isAssignableCmsRole/);
  assert.match(team, /isAssignableCmsRole\(role\)/);
  assert.match(team, /CMS_ROLE_LABELS\[role\]/);
});

test("Existing Reviewer memberships remain readable and require an explicit replacement", async () => {
  const members = await read("src/lib/admin-members.ts");
  const team = await read("src/app/admin/team/page.tsx");

  assert.match(members, /isCmsRole\(member\.role\)/);
  assert.match(members, /export function isAssignableCmsRole/);
  assert.match(team, /member\.role === "reviewer"/);
  assert.match(team, /Reviewer \(legacy\)/);
  assert.match(team, /Choose new role/);
  assert.match(team, /required=\{member\.role === "reviewer"\}/);
});

test("Reviewer storage and authorization compatibility remain intact", async () => {
  const migration = await read("supabase/migrations/20260820040000_create_cms_members.sql");
  const auth = await read("src/lib/cms-auth.ts");

  assert.match(migration, /role in \('owner', 'editor', 'reviewer'\)/);
  assert.match(migration, /cms_has_role\(array\['owner'\]/);
  assert.match(auth, /membership\.role === "reviewer"/);
  assert.match(auth, /canPublishInsights/);
  assert.doesNotMatch(auth, /Trusted Publisher/);
});

test("The independent Insights publishing capability remains defined and separate", async () => {
  const auth = await read("src/lib/cms-auth.ts");
  const insightsFoundation = await read("supabase/migrations/20260826000000_add_phase6a_insights_foundation.sql");

  assert.match(auth, /canPublishInsights: boolean/);
  assert.match(insightsFoundation, /can_publish_insights/);
  assert.match(insightsFoundation, /coalesce\(access_scope\.can_publish_insights, false\)/);
});
