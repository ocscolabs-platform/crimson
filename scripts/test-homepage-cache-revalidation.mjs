import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

function between(value, start, end) {
  const startIndex = value.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing source boundary: ${start}`);
  const endIndex = value.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing source boundary: ${end}`);
  return value.slice(startIndex, endIndex);
}

test("all public homepage CMS dependencies share one persistent cache tag", async () => {
  const [cacheBoundary, chrome, pageDocument] = await Promise.all([
    source("src/lib/public-homepage-cache.ts"),
    source("src/lib/cms-content.ts"),
    source("src/lib/page-document-loader.ts"),
  ]);

  assert.match(cacheBoundary, /PUBLIC_HOMEPAGE_CACHE_TAG\s*=\s*"public-homepage-v1"/);
  assert.match(cacheBoundary, /updateTag\(PUBLIC_HOMEPAGE_CACHE_TAG\)/);
  assert.match(cacheBoundary, /revalidatePath\("\/"\)/);

  assert.match(chrome, /unstable_cache\(\s*readPublishedSiteSettings/);
  assert.match(chrome, /unstable_cache\(\s*readPublishedNavigation/);
  assert.equal((chrome.match(/tags:\s*\[PUBLIC_HOMEPAGE_CACHE_TAG\]/g) ?? []).length, 2);

  assert.match(pageDocument, /unstable_cache\(\s*\(\) => readPublishedPageDocument\("home"\)/);
  assert.match(pageDocument, /unstable_cache\(\s*readPublishedPageServices/);
  assert.equal((pageDocument.match(/tags:\s*\[PUBLIC_HOMEPAGE_CACHE_TAG\]/g) ?? []).length, 2);
});

test("Home publication and restore expire the homepage only after successful RPC completion", async () => {
  const actions = await source("src/app/admin/content/pages/actions.ts");
  const restore = between(actions, "export async function restorePageDocument", "export async function publishPageDocument");
  const publish = actions.slice(actions.indexOf("export async function publishPageDocument"));

  for (const action of [restore, publish]) {
    const successBoundary = action.indexOf("if (error || !");
    const invalidation = action.indexOf("invalidatePublicHomepage()");
    assert.ok(successBoundary >= 0 && invalidation > successBoundary);
    assert.match(action, /authorized\.adapter\.pageKey === "home"/);
  }

  const draft = between(actions, "export async function savePageDocumentDraft", "export async function submitPageDocumentForReview");
  assert.doesNotMatch(draft, /invalidatePublicHomepage/);
});

test("published Service changes expire homepage data while private Service revisions do not", async () => {
  const services = await source("src/app/admin/services/[slug]/page.tsx");
  const save = between(services, "async function saveService", "async function publishService");
  const publish = between(services, "async function publishService", "async function restoreServiceFromAudit");
  const restore = between(services, "async function restoreServiceFromAudit", "export const dynamic");

  assert.doesNotMatch(save, /invalidatePublicHomepage/);
  assert.match(publish, /cms_publish_revision/);
  assert.ok(publish.indexOf("invalidatePublicHomepage()") > publish.indexOf("if (publishError)"));
  assert.doesNotMatch(restore, /invalidatePublicHomepage/);
});

test("published settings, design settings, global copy, and navigation expire homepage data", async () => {
  const globalContent = await source("src/app/admin/content/page.tsx");
  const publish = between(globalContent, "async function publishRevision", "async function saveSiteSettings");

  assert.match(publish, /entityType === "site_settings" \|\| entityType === "navigation_item"/);
  assert.ok(publish.indexOf("invalidatePublicHomepage()") > publish.indexOf("if (publishError)"));
});

test("homepage metadata and body share the same cached published PageDocument", async () => {
  const [home, metadata, loader] = await Promise.all([
    source("src/app/page.tsx"),
    source("src/lib/page-metadata.ts"),
    source("src/lib/page-document-loader.ts"),
  ]);

  assert.match(home, /getPublishedPageDocument\("home"\)/);
  assert.match(home, /getPublishedPageMetadata\("home"\)/);
  assert.match(metadata, /getPublishedPageDocument\(pageKey\)/);
  assert.match(loader, /pageKey === "home"\s*\? getPersistedPublishedHomePageDocument\(\)/);
});

test("cached homepage reads remain anonymous and published-only", async () => {
  const [chrome, pageDocument, home] = await Promise.all([
    source("src/lib/cms-content.ts"),
    source("src/lib/page-document-loader.ts"),
    source("src/app/page.tsx"),
  ]);

  for (const loader of [chrome, pageDocument]) {
    assert.match(loader, /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
    assert.doesNotMatch(loader, /cookies\(|createServerClient|service_role|SUPABASE_SECRET_KEY/);
  }
  assert.match(pageDocument, /\.eq\("status", "published"\)/);
  assert.match(pageDocument, /\.not\("published_at", "is", null\)/);
  assert.match(pageDocument, /\.lte\("published_at", now\.toISOString\(\)\)/);
  assert.match(home, /export const dynamic = "force-dynamic"/);
});
