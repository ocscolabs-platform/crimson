import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationPath = "supabase/migrations/20260826010000_add_phase6b1_insights_slug_update_contract.sql";
const read = (file) => readFile(path.join(root, file), "utf8");

test("Batch 6B1 remains migration #28 without changing the prior baseline", async () => {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(path.join(root, "supabase", "migrations")))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  assert.equal(files.length, 33);
  assert.equal(files.at(-7), "20260826000000_add_phase6a_insights_foundation.sql");
  assert.equal(files.at(-6), "20260826010000_add_phase6b1_insights_slug_update_contract.sql");
  assert.equal(files.at(-5), "20260827000000_add_phase6_insights_public_projection_security.sql");
  assert.equal(files.at(-4), "20260828000000_add_phase6b3_insights_media_workflow.sql");
  assert.equal(files.at(-1), "20260831000000_reconcile_production_legacy_baseline.sql");
});

test("The slug RPC is authenticated, narrow, and optimistic-concurrency protected", async () => {
  const sql = await read(migrationPath);

  for (const contract of [
    "create or replace function public.insights_update_article_slug(",
    "p_article_id uuid",
    "p_expected_updated_at timestamptz",
    "p_slug text",
    "security definer",
    "set search_path = public",
    "cms_can_edit_insights()",
    "cms_has_full_cms_access()",
    "article.author_id <> auth.uid()",
    "article.updated_at <> p_expected_updated_at",
    "update public.insights_articles",
    "updated_at = now()",
    "revoke all on function public.insights_update_article_slug(uuid, timestamptz, text) from public",
    "grant execute on function public.insights_update_article_slug(uuid, timestamptz, text) to authenticated",
  ]) assert.ok(sql.includes(contract), "Missing contract: " + contract);
});

test("Slug validation and uniqueness remain database-authoritative", async () => {
  const sql = await read(migrationPath);

  assert.ok(sql.includes("char_length(p_slug) not between 1 and 120"));
  assert.ok(sql.includes("p_slug <> btrim(p_slug)"));
  assert.ok(sql.includes("p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'"));
  assert.match(sql, /when unique_violation then/);
  assert.match(sql, /That Insight slug is already in use/);
});

test("Slug freeze uses the durable first-publication signals", async () => {
  const sql = await read(migrationPath);

  assert.ok(sql.includes("article.status <> 'draft'"));
  assert.ok(sql.includes("article.published_at is not null"));
  assert.ok(sql.includes("article.last_published_revision_id is not null"));
  assert.ok(sql.includes("revision.status = 'published'"));
  assert.ok(sql.includes("Published Insight slugs are immutable"));
  assert.ok(sql.includes("Batch 6A archives a Published revision during Unpublish"));
});

test("Slug editing is metadata-only and does not expand workflow audit", async () => {
  const sql = await read(migrationPath);

  assert.doesNotMatch(sql, /insights_write_audit/);
  assert.match(sql, /metadata editing, not a workflow transition/);
  assert.match(sql, /Published slugs remain frozen forever/);
});
