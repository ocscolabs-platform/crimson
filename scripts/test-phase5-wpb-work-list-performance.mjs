import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = async (path) => readFile(new URL(path, root), "utf8");

test("Work list requests no unused related-Service reads", async () => {
  const page = await source("src/app/work/page.tsx");
  const loader = await source("src/lib/cms-content.ts");

  assert.match(page, /getPublishedWorkProjects\(\{ includeRelatedCapabilities: false \}\)/);
  assert.match(loader, /includeRelatedCapabilities = options\.includeRelatedCapabilities \?\? true/);
  assert.match(loader, /if \(includeRelatedCapabilities\)/);
  assert.match(loader, /from\("case_study_services"\)/);
  assert.match(loader, /from\("services"\)/);
});

test("Work detail retains related-Service loading", async () => {
  const detail = await source("src/app/work/[slug]/page.tsx");
  const loader = await source("src/lib/cms-content.ts");

  assert.match(detail, /getPublishedWorkProject\(slug\)/);
  assert.match(detail, /<WorkDetailView project=\{project\} \/>/);
  assert.match(loader, /const includeRelatedCapabilities = options\.includeRelatedCapabilities \?\? true/);
  assert.match(loader, /getPublishedWorkProjects\(\)/);
  assert.match(loader, /from\("case_study_services"\)/);
  assert.match(loader, /from\("services"\)/);
});

test("approved media uses one safe batch signing path", async () => {
  const loader = await source("src/lib/cms-content.ts");

  assert.match(loader, /createSignedUrls\(uniquePaths, 3600\)/);
  assert.doesNotMatch(loader, /createSignedUrl\(/);
  assert.match(loader, /item\.path && item\.signedUrl && !item\.error/);
  assert.match(loader, /const mediaUrls = await createPublicMediaUrls\(client, mediaPaths\)/);
  assert.match(loader, /mediaItems\.flatMap/);
});

test("media path order and published-only Work behavior remain explicit", async () => {
  const loader = await source("src/lib/cms-content.ts");
  const page = await source("src/app/work/page.tsx");

  assert.match(loader, /caseStudy\.media_status !== "approved"/);
  assert.match(loader, /\[caseStudy\.featured_image_path, \.\.\.supportingPaths\]/);
  assert.match(loader, /Promise\.all\(caseStudies\.map/);
  assert.match(page, /RouteShell/);
  assert.match(page, /page=\{page\}/);
});
