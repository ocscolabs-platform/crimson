import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => readFile(path.join(root, file), "utf8");

test("Cover alt editing reuses the existing authenticated media action", async () => {
  const [composer, actions, sql] = await Promise.all([
    read("src/app/admin/insights/articles/Composer.tsx"),
    read("src/app/admin/insights/articles/actions.ts"),
    read("supabase/migrations/20260828000000_add_phase6b3_insights_media_workflow.sql"),
  ]);
  assert.match(composer, /coverAlt/);
  assert.match(composer, /Update Cover alt/);
  assert.match(composer, /set\("media_id", coverMedia\.id\)/);
  assert.match(composer, /updateInsightsMediaAlt\(initialMediaState, data\)/);
  assert.match(actions, /authorized\.supabase\.rpc\("insights_update_media_alt"/);
  assert.match(sql, /article\.status <> 'draft'/);
  assert.match(sql, /article\.author_id <> auth\.uid\(\)/);
  assert.match(sql, /insights_revision_media where revision_id = revision\.id and media_id = p_media_id/);
  assert.match(sql, /p_expected_updated_at/);
});

test("Cover alt editing does not add a migration or broaden public access", async () => {
  const [composer, sql] = await Promise.all([
    read("src/app/admin/insights/articles/Composer.tsx"),
    read("supabase/migrations/20260828000000_add_phase6b3_insights_media_workflow.sql"),
  ]);
  assert.doesNotMatch(composer, /insights_media_assets.*\.update/);
  assert.match(sql, /revoke all on function public\.insights_update_media_alt/);
  assert.match(sql, /grant execute on function public\.insights_update_media_alt\(uuid, timestamptz, uuid, text\) to authenticated/);
  assert.doesNotMatch(composer, /fetch\(/);
});
