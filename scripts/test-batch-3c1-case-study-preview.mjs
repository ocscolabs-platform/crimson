import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("public Work detail delegates to the shared presentation", async () => {
  const route = await source("src/app/work/[slug]/page.tsx");
  assert.match(route, /getPublishedWorkProject\(slug\)/);
  assert.match(route, /<WorkDetailView project=\{project\} \/>/);
  assert.doesNotMatch(route, /cms_revisions|case-study-preview/);
});

test("shared Work detail preserves the existing presentation contract", async () => {
  const view = await source("src/components/work-detail-view.tsx");
  for (const label of ["work-detail-media", "work-detail-gallery", "Related capabilities", "Challenge", "Approach", "Deliverables", "Outcomes", "Open prototype", "Project story in preparation"]) {
    assert.match(view, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Preview loader authenticates and permits existing CMS read roles only", async () => {
  const loader = await source("src/lib/case-study-preview.ts");
  assert.match(loader, /supabase\.auth\.getUser\(\)/);
  assert.match(loader, /getCmsMembership\(user\.id\)/);
  assert.match(loader, /role === "owner" \|\| role === "editor" \|\| role === "reviewer"/);
  assert.match(loader, /getAdminCaseStudyReview\(slug\)/);
});

test("Preview is bound to an active Draft or Review revision", async () => {
  const loader = await source("src/lib/case-study-preview.ts");
  assert.match(loader, /review\.revision_id/);
  assert.match(loader, /review\.revision_status/);
  assert.match(loader, /\["draft", "review"\]\.includes\(review\.revision_status\)/);
  assert.match(await source("src/lib/admin-case-studies.ts"), /entity_type.*case_study/);
  assert.match(await source("src/lib/admin-case-studies.ts"), /\.in\("status", \["draft", "review"\]\)/);
});

test("Preview normalizes privacy-sensitive content and published relationships", async () => {
  const loader = await source("src/lib/case-study-preview.ts");
  assert.match(loader, /client_visibility === "approved"/);
  assert.match(loader, /safeName/);
  assert.match(loader, /href: isApproved/);
  assert.match(loader, /filter\(\(service\) => service\.status === "published"\)/);
});

test("Preview media is based on authenticated signed URLs from the admin helper", async () => {
  const loader = await source("src/lib/case-study-preview.ts");
  const admin = await source("src/lib/admin-case-studies.ts");
  assert.match(loader, /getAdminCaseStudyReview/);
  assert.match(admin, /createSignedUrl/);
  assert.doesNotMatch(loader, /getPublicCmsClient|createPublicMediaUrls/);
});

test("Preview route is no-store, no-index, and read-only", async () => {
  const route = await source("src/app/admin/case-studies/[slug]/preview/page.tsx");
  assert.match(route, /force-dynamic/);
  assert.match(route, /revalidate = 0/);
  assert.match(route, /force-no-store/);
  assert.match(route, /index: false/);
  assert.match(await source("src/components/route-shell.tsx"), /Preview — unpublished content/);
  assert.doesNotMatch(route, /cms_save|cms_publish|\.insert\(|\.update\(|\.delete\(/);
});

test("Preview route renders the shared Work detail view", async () => {
  const route = await source("src/app/admin/case-studies/[slug]/preview/page.tsx");
  assert.match(route, /getAuthenticatedCaseStudyPreview\(slug\)/);
  assert.match(route, /<WorkDetailView project=\{preview\.project\} \/>/);
  assert.match(route, /returnHref: `\/crimson-admin-control\/case-studies/);
});

test("Public Work remains isolated from Draft and Review revisions", async () => {
  const content = await source("src/lib/cms-content.ts");
  const route = await source("src/app/work/[slug]/page.tsx");
  assert.match(content, /from\("case_studies"\)/);
  assert.match(content, /getPublishedWorkProject/);
  assert.match(route, /getPublishedWorkProject/);
  assert.doesNotMatch(route, /revision_id|preview/);
});

test("Batch 3C2 editor Preview control remains deferred", async () => {
  const editor = await source("src/app/admin/case-studies/[slug]/page.tsx");
  assert.doesNotMatch(editor, /case-studies\/\$\{slug\}\/preview/);
});
