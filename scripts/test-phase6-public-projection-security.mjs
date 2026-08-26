import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationPath = "supabase/migrations/20260827000000_add_phase6_insights_public_projection_security.sql";
const read = (file) => readFile(path.join(root, file), "utf8");

test("Security hardening adds migration #29 without changing migrations 1-28", async () => {
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(path.join(root, "supabase", "migrations")))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  assert.equal(files.length, 29);
  assert.equal(files.at(-2), "20260826010000_add_phase6b1_insights_slug_update_contract.sql");
  assert.equal(files.at(-1), "20260827000000_add_phase6_insights_public_projection_security.sql");
});

test("The public projection is sanitized, RLS-protected, and SELECT-only", async () => {
  const sql = await read(migrationPath);
  for (const contract of [
    "create table if not exists public.insights_public_articles",
    "body jsonb not null",
    "alter table public.insights_public_articles enable row level security",
    "revoke all on public.insights_public_articles from public, anon, authenticated",
    "grant select on public.insights_public_articles to anon, authenticated",
    "create policy \"Public can read Published Insights\"",
    "using (published_at is not null)",
    "revoke all on public.insights_published_articles from public, anon, authenticated",
    "grant select on public.insights_published_articles to anon, authenticated",
  ]) assert.ok(sql.includes(contract), `Missing contract: ${contract}`);

  assert.doesNotMatch(sql, /grant (?:insert|update|delete|truncate|references|trigger)/i);
  assert.match(sql, /with \(security_invoker = true\)/);
  assert.doesNotMatch(sql, /security definer.*insights_published_articles/i);
});

test("Publish synchronizes the sanitized projection in the same transaction", async () => {
  const sql = await read(migrationPath);
  const publishStart = sql.indexOf("create or replace function public.insights_publish_article");
  const unpublishStart = sql.indexOf("create or replace function public.insights_unpublish_article");
  const publish = sql.slice(publishStart, unpublishStart);

  for (const contract of [
    "previous_revision_id uuid",
    "update public.insights_article_revisions",
    "update public.insights_articles",
    "insert into public.insights_public_articles",
    "current_revision.body",
    "current_revision.author_display_name_snapshot",
    "on conflict (article_id) do update set",
    "perform public.insights_write_audit",
  ]) assert.ok(publish.includes(contract), `Missing publish contract: ${contract}`);
});

test("Unpublish removes only the public projection and preserves private history", async () => {
  const sql = await read(migrationPath);
  const unpublishStart = sql.indexOf("create or replace function public.insights_unpublish_article");
  const grantsStart = sql.indexOf("revoke all on function", unpublishStart);
  const unpublish = sql.slice(unpublishStart, grantsStart);

  assert.match(unpublish, /delete from public\.insights_public_articles/);
  assert.match(unpublish, /update public\.insights_article_revisions/);
  assert.match(unpublish, /update public\.insights_articles/);
  assert.match(unpublish, /perform public\.insights_write_audit/);
  assert.doesNotMatch(unpublish, /delete from public\.insights_article_revisions/);
});

test("Existing private editorial grants remain private", async () => {
  const sql = await read(migrationPath);
  assert.doesNotMatch(sql, /grant select on public\.(insights_articles|insights_article_revisions|insights_article_revision_tags|insights_categories|insights_tags) to anon/i);
  assert.match(sql, /from public\.insights_articles article/);
  assert.match(sql, /references public\.insights_article_revisions/);
});
