import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [controls, composer, migration] = await Promise.all([
  read("src/app/admin/insights/articles/WorkflowControls.tsx"),
  read("src/app/admin/insights/articles/Composer.tsx"),
  read("supabase/migrations/20260831000000_reconcile_production_legacy_baseline.sql"),
]);

assert.match(controls, /const canPublish = props\.status === "review" && props\.role === "owner";/);
assert.doesNotMatch(controls, /props\.role === "editor" && props\.canPublishInsights/);
assert.match(composer, /const canPublishDraft = Boolean\(article\) && role === "editor" && canPublishInsights;/);
assert.match(migration, /if not public\.cms_can_publish_insights\(\) then raise exception 'This member cannot publish Insights'; end if;/);
assert.match(migration, /if public\.cms_current_role\(\) <> 'owner' and article\.author_id <> auth\.uid\(\)/);
assert.match(migration, /if public\.cms_current_role\(\) <> 'owner' and article\.status <> 'draft'/);
assert.match(migration, /if public\.cms_current_role\(\) = 'owner' and article\.status not in \('draft', 'review'\)/);

console.log("Batch 2A publisher authorization alignment: 7/7 passed");
