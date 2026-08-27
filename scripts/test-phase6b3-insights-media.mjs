import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationName = "20260828000000_add_phase6b3_insights_media_workflow.sql";
const migration = () => readFile(path.join(root, "supabase", "migrations", migrationName), "utf8");
const read = (file) => readFile(path.join(root, file), "utf8");

test("B6B3 is additive after the 29-migration staging baseline", async () => {
  const files = (await readdir(path.join(root, "supabase", "migrations"))).filter((file) => file.endsWith(".sql")).sort();
  assert.equal(files.length, 30);
  assert.equal(files.at(-2), "20260827000000_add_phase6_insights_public_projection_security.sql");
  assert.equal(files.at(-1), migrationName);
});

test("Canonical media is private, dedicated, normalized, and server-registered", async () => {
  const [sql, actions] = await Promise.all([migration(), read("src/app/admin/insights/articles/actions.ts")]);
  for (const contract of [
    "create table if not exists public.insights_media_assets",
    "create table if not exists public.insights_revision_media",
    "insights-private-media",
    "insights-published-media",
    "('insights-private-media', 'insights-private-media', false",
    "source_mime_type in ('image/avif', 'image/jpeg', 'image/png', 'image/webp')",
    "normalized_mime_type text not null default 'image/webp'",
    "file_size_limit",
    "alter table public.insights_media_assets enable row level security",
    "revoke all on public.insights_media_assets, public.insights_revision_media from anon, authenticated",
    "on storage.objects for select to authenticated",
    "create or replace function public.insights_register_media",
  ]) assert.ok(sql.includes(contract), `Missing migration contract: ${contract}`);
  assert.match(actions, /import sharp.*from "sharp"/);
  assert.match(actions, /isDeclaredTypeConsistent/);
  assert.match(actions, /MEDIA_SOURCE_SIZE_LIMIT = 2 \* 1024 \* 1024/);
  assert.match(actions, /\.rotate\(\)\.resize/);
  assert.match(actions, /\.webp\(/);
  assert.match(actions, /createAdminClient\(\)/);
  assert.doesNotMatch(actions, /storage\.from\(MEDIA_BUCKET\)\.upload[\s\S]*?supabase\.storage/);
});

test("The v2 body keeps opaque media IDs and never persists resolved URLs", async () => {
  const [body, actions, composer] = await Promise.all([
    read("src/lib/insights-body.ts"),
    read("src/app/admin/insights/articles/actions.ts"),
    read("src/app/admin/insights/articles/Composer.tsx"),
  ]);
  assert.match(body, /INSIGHTS_BODY_VERSION = 2/);
  assert.match(body, /image/);
  assert.match(body, /mediaId/);
  assert.match(body, /stripResolvedInsightsMedia/);
  assert.match(body, /if \(isRecord\(result\.doc\)\) result\.doc = stripResolvedInsightsMedia\(result\.doc\)/);
  assert.match(actions, /stripResolvedInsightsMedia\(body\.value\)/);
  assert.match(composer, /version: 2/);
  assert.match(composer, /Insert inline image/);
  assert.match(composer, /Add Cover|Replace Cover/);
  assert.match(composer, /Remove Cover/);
  assert.match(composer, /Alternative text/);
});

test("Submit and Publish require a valid Cover and referenced inline media", async () => {
  const sql = await migration();
  for (const contract of [
    "create or replace function public.insights_revision_is_publishable",
    "revision.cover_media_id",
    "relation.role = 'cover'",
    "relation.role = 'inline'",
    "create or replace function public.insights_submit_for_review",
    "Add a valid Title, Body, Category, Cover, and image alternative text before Submit",
    "create or replace function public.insights_publish_article",
    "Published media artifacts are incomplete",
    "public_path",
    "public.insights_sanitize_public_body",
  ]) assert.ok(sql.includes(contract), `Missing workflow contract: ${contract}`);
});

test("Publication uses exact revision artifacts and Unpublish preserves canonical history", async () => {
  const sql = await migration();
  assert.match(sql, /format\('articles\/%s\/revisions\/%s\/%s\.webp'/);
  assert.match(sql, /insert into public\.insights_public_articles/);
  assert.match(sql, /delete from public\.insights_public_articles/);
  assert.doesNotMatch(sql, /delete from public\.insights_article_revisions/);
  assert.match(sql, /public\.insights_mark_media_artifacts_removed/);
  assert.match(sql, /insert into public\.insights_revision_media \(revision_id, media_id, role\) select restored_id/);
  assert.match(sql, /public\.insights_is_public_media_path/);
  assert.match(sql, /Published Insights media artifacts are public/);
});

test("No public Insights routes are introduced by B6B3", async () => {
  const routes = await read("src/app/admin/insights/page.tsx");
  assert.doesNotMatch(routes, /href=\"\/insights/);
  const routeFiles = (await import("node:fs/promises")).readdir;
  const publicRoot = path.join(root, "src", "app", "insights");
  await assert.rejects(routeFiles(publicRoot));
});
