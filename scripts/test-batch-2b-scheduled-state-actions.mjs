import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [migration, data, controls, packageJson] = await Promise.all([
  read("supabase/migrations/20260831070000_add_insights_scheduled_state_actions.sql"),
  read("src/lib/insights-data.ts"),
  read("src/app/admin/insights/articles/WorkflowControls.tsx"),
  read("package.json"),
]);

assert.match(migration, /add column if not exists scheduled_publish_at timestamptz/);
assert.match(migration, /check \(status in \('draft', 'review', 'scheduled', 'published', 'unpublished'\)\)/);
assert.match(migration, /insights_articles_scheduled_due_idx/);
assert.match(migration, /'scheduled', 'rescheduled', 'cancelled'/);
assert.match(migration, /create or replace function public\.insights_schedule_article/);
assert.match(migration, /p_scheduled_publish_at is null or p_scheduled_publish_at <= now\(\)/);
assert.match(migration, /if public\.cms_current_role\(\) <> 'owner'/);
assert.match(migration, /if article\.status <> 'review'/);
assert.match(migration, /revision\.status <> 'review'/);
assert.match(migration, /insights_revision_is_publishable\(revision\.id\)/);
assert.match(migration, /set status = 'scheduled', scheduled_publish_at = p_scheduled_publish_at/);
assert.match(migration, /'scheduled', 'review', 'scheduled'/);
assert.match(migration, /create or replace function public\.insights_reschedule_article/);
assert.match(migration, /article\.status <> 'scheduled'/);
assert.match(migration, /'rescheduled', 'scheduled', 'scheduled'/);
assert.match(migration, /create or replace function public\.insights_cancel_scheduled_article/);
assert.match(migration, /set status = 'review', scheduled_publish_at = null/);
assert.match(migration, /'cancelled', 'scheduled', 'review'/);
assert.match(migration, /article\.status not in \('draft', 'review', 'scheduled'\)/);
assert.match(migration, /set status = 'published', scheduled_publish_at = null/);
assert.match(migration, /grant execute on function public\.insights_schedule_article.*to authenticated/s);
assert.match(migration, /grant execute on function public\.insights_reschedule_article.*to authenticated/s);
assert.match(migration, /grant execute on function public\.insights_cancel_scheduled_article.*to authenticated/s);
assert.equal((data.match(/status: "draft" \| "review" \| "scheduled" \| "published" \| "unpublished";/g) ?? []).length, 2);
assert.doesNotMatch(controls, /Schedule|Reschedule|Cancel schedule|scheduled_publish_at/);
assert.match(packageJson, /test:batch2b:scheduled-state/);

console.log("Batch 2B Scheduled Publishing Step 1 contract: 26/26 passed");
