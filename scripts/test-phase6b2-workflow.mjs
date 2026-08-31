import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Draft autosave uses one coordinated, truthful save boundary", async () => {
  const composer = await read("src/app/admin/insights/articles/Composer.tsx");
  assert.match(composer, /AUTOSAVE_DEBOUNCE_MS = 1750/);
  assert.match(composer, /AUTOSAVE_MIN_INTERVAL_MS = 5000/);
  assert.match(composer, /inFlightRef/);
  assert.match(composer, /queuedSaveRef/);
  assert.match(composer, /requestSave\("autosave"\)/);
  assert.match(composer, /requestSave\("explicit"\)/);
  assert.match(composer, /flushPendingSave/);
  assert.match(composer, /Unsaved changes/);
  assert.match(composer, /Saving…/);
  assert.match(composer, /Save failed/);
  assert.match(composer, /Conflict — reload required/);
  assert.match(composer, /Your local changes were not overwritten/);
  assert.match(composer, /beforeunload/);
  assert.match(composer, /insights-leave-dialog/);
  assert.match(composer, /Reload latest saved version/);
});

test("Private Preview is authenticated, revision-scoped, and non-cacheable", async () => {
  const [preview, data, proxy] = await Promise.all([
    read("src/app/admin/insights/articles/[id]/preview/page.tsx"),
    read("src/lib/insights-data.ts"),
    read("src/proxy.ts"),
  ]);
  assert.match(preview, /requireCmsInsightsEditor/);
  assert.match(preview, /getInsightsArticlePreviewData/);
  assert.match(preview, /force-dynamic/);
  assert.match(preview, /force-no-store/);
  assert.match(preview, /index: false/);
  assert.match(preview, /noarchive: true/);
  assert.match(preview, /Preview — unpublished content/);
  assert.match(preview, /ReadOnlyArticleBody/);
  assert.match(data, /article\.author_id !== user\.id/);
  assert.match(data, /\["draft", "review"\]/);
  assert.match(data, /active_revision_id/);
  assert.match(proxy, /Cache-Control/);
  assert.match(proxy, /private, no-store/);
  assert.match(proxy, /X-Robots-Tag/);
  assert.match(proxy, /noindex, nofollow, noarchive/);
});

test("Needs Review queue and workflow controls remain authoritative and role-scoped", async () => {
  const [dashboard, page, controls, actions, data] = await Promise.all([
    read("src/app/admin/insights/page.tsx"),
    read("src/app/admin/insights/articles/[id]/page.tsx"),
    read("src/app/admin/insights/articles/WorkflowControls.tsx"),
    read("src/app/admin/insights/articles/actions.ts"),
    read("src/lib/insights-data.ts"),
  ]);
  assert.match(dashboard, /reviewCount/);
  assert.match(dashboard, /membership\.role === "owner"/);
  assert.match(dashboard, /reviewQueue/);
  assert.match(dashboard, /submittedAt/);
  assert.match(dashboard, /Review ↗/);
  assert.match(data, /sort\(\(a, b\) => \(a\.submitted_at/);
  assert.match(page, /WorkflowControls/);
  assert.match(page, /article\.status === "review"\s*\|\|\s*article\.status === "scheduled"\s*\|\|\s*article\.status === "published"\s*\|\|\s*article\.status === "unpublished"/);
  assert.match(controls, /Preview ↗/);
  assert.match(controls, /Confirm Publish/);
  assert.match(controls, /Confirm Return to Draft/);
  assert.match(controls, /Confirm Withdraw to Draft/);
  assert.match(controls, /Confirm Unpublish/);
  for (const rpc of ["insights_submit_for_review", "insights_withdraw_review", "insights_return_to_draft", "insights_publish_article", "insights_unpublish_article"]) assert.match(actions, new RegExp(rpc));
  assert.match(controls, /authorId === props\.viewerId/);
  assert.match(controls, /canPublishInsights/);
});

test("B6B2 keeps media and public Insights outside the slice", async () => {
  const source = await Promise.all([
    read("src/app/admin/insights/page.tsx"),
    read("src/app/admin/insights/articles/Composer.tsx"),
    read("src/app/admin/insights/articles/[id]/preview/page.tsx"),
  ]).then((files) => files.join("\n"));
  assert.doesNotMatch(source, /ImageUpload|Cover upload|insights\/\[slug\]/);
  assert.doesNotMatch(source, /create table if not exists/);
});
