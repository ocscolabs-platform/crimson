import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");

test("6C1 public Insights routes use the published boundary", async () => {
  const [data, landing, detail, navigation] = await Promise.all([
    read("src/lib/insights-data.ts"),
    read("src/app/insights/page.tsx"),
    read("src/app/insights/[slug]/page.tsx"),
    read("src/lib/site-navigation.ts"),
  ]);
  const publicLoader = data.slice(data.indexOf("export async function getPublishedInsightsArticles"), data.indexOf("function withMediaPreviewUrls"));

  assert.match(publicLoader, /from\("insights_published_articles"\)/);
  assert.doesNotMatch(publicLoader, /insights_articles|insights_article_revisions|insights_media_assets|cms_members|cms_member_access/);
  assert.match(publicLoader, /order\("published_at", \{ ascending: false \}\)/);
  assert.match(data, /insights-published-media/);
  assert.match(navigation, /label: "Insights"/);
  assert.match(navigation, /href: "\/insights"/);

  assert.match(landing, /getPublishedInsightsArticles/);
  assert.match(landing, /title: \{ absolute: "Insights" \}/);
  assert.match(landing, /alternates: \{ canonical: "\/insights" \}/);
  assert.doesNotMatch(landing, /search|filter|related/i);

  assert.match(detail, /getPublishedInsightsArticle/);
  assert.match(detail, /notFound\(\)/);
  assert.match(detail, /renderInsightsBody/);
  assert.match(detail, /publishedTime: article\.publishedAt/);
  assert.match(detail, /coverImageUrl/);
  assert.doesNotMatch(detail, /tiptap|Tiptap|use client|article\.id|revision/i);
});

test("6C1 does not add a migration", async () => {
  const files = (await readdir(path.join(root, "supabase/migrations"))).filter((file) => file.endsWith(".sql")).sort();
  assert.equal(files.length, 30);
  assert.equal(files.at(-1), "20260828000000_add_phase6b3_insights_media_workflow.sql");
});
