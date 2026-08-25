import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => readFile(path.join(root, file), "utf8");

test("Batch 6A is additive after the Phase 5 migration baseline", async () => {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(path.join(root, "supabase", "migrations")))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  assert.equal(files.length, 27);
  assert.equal(files.at(-2), "20260824000000_add_phase5a_page_document_workflow_contract.sql");
  assert.equal(files.at(-1), "20260826000000_add_phase6a_insights_foundation.sql");
});

test("Batch 6A defines a narrow access scope and Trusted Publisher capability", async () => {
  const sql = await read("supabase/migrations/20260826000000_add_phase6a_insights_foundation.sql");
  for (const contract of [
    "create table if not exists public.cms_member_access",
    "access_scope in ('full_cms', 'insights_only')",
    "can_publish_insights",
    "cms_can_access_insights()",
    "cms_can_access_crimson_area(p_area text)",
    "cms_has_full_cms_access()",
    "Existing cms_has_role callers are the Phase 4/5 full-CMS boundary",
  ]) assert.ok(sql.includes(contract), `Missing contract: ${contract}`);
});

test("Trusted Publisher publication is ownership-checked in the database", async () => {
  const sql = await read("supabase/migrations/20260826000000_add_phase6a_insights_foundation.sql");
  assert.match(sql, /author_id uuid not null references auth\.users/);
  assert.match(sql, /Author ownership is immutable/);
  assert.match(sql, /cms_current_role\(\) <> 'owner' and article\.author_id <> auth\.uid\(\)/);
  assert.match(sql, /Trusted Publishers may only publish their own Insight articles/);
  assert.match(sql, /coalesce\(access_scope\.can_publish_insights, false\)/);
});

test("Workflow RPCs carry the locked transitions and stale-write protection", async () => {
  const sql = await read("supabase/migrations/20260826000000_add_phase6a_insights_foundation.sql");
  for (const contract of [
    "insights_create_article",
    "insights_save_draft",
    "insights_submit_for_review",
    "insights_withdraw_review",
    "insights_publish_article",
    "insights_return_to_draft",
    "insights_unpublish_article",
    "insights_restore_revision",
    "The Insight changed. Reload before",
    "Review is immutable; withdraw it before saving a Draft",
    "A primary Category is required before Submit",
    "A primary Category is required before Publish",
    "restored",
  ]) assert.ok(sql.includes(contract), `Missing contract: ${contract}`);
});

test("RLS and the public projection isolate private Insights data", async () => {
  const sql = await read("supabase/migrations/20260826000000_add_phase6a_insights_foundation.sql");
  for (const contract of [
    "alter table public.insights_articles enable row level security",
    "Insights members can read articles",
    "Insights members can read revisions",
    "Insights members can read workflow audit",
    "revoke all on public.insights_articles from anon, authenticated",
    "create or replace view public.insights_published_articles",
    "where article.published_revision_id is not null",
    "grant select on public.insights_published_articles to anon, authenticated",
    "Draft",
    "Review",
    "Published Insight revisions are immutable",
  ]) assert.ok(sql.includes(contract), `Missing contract: ${contract}`);
});

test("The application denies the broad admin surface to Insights-only members", async () => {
  const proxy = await read("src/proxy.ts");
  const dashboard = await read("src/app/admin/page.tsx");
  assert.match(proxy, /access_scope === "insights_only"/);
  assert.match(proxy, /relativePath\.startsWith\("\/insights"\)/);
  assert.match(proxy, /status: 404/);
  assert.match(dashboard, /redirect\("\/crimson-admin-control\/insights"\)/);
});
