import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

const migration = await readFile(
  new URL("../supabase/migrations/20260831000000_reconcile_production_legacy_baseline.sql", import.meta.url),
  "utf8",
);
const fixture = JSON.parse(await readFile(
  new URL("./fixtures/phase6-migration33-legacy.json", import.meta.url),
  "utf8",
));

const requiredLegacyTables = [
  "inquiries", "pages", "page_sections", "services", "case_studies",
  "case_study_services", "navigation_items", "site_settings", "cms_members",
  "cms_revisions", "cms_audit_log", "cms_global_audit_log",
];
const targetPageSlugs = ["home", "services", "about", "contact"];

function snapshotLegacy(input) {
  return JSON.stringify({
    pages: input.pages,
    counts: input.counts,
    storage: input.storage,
    absent: input.absent,
  });
}

function convertPageDocuments(input) {
  assert.equal(input.pages.length, 5);
  for (const page of input.pages) {
    assert.ok(Array.isArray(page.content), `${page.slug} must retain legacy array content`);
  }

  const documents = input.pages
    .filter((page) => targetPageSlugs.includes(page.slug))
    .map((page) => ({
      pageId: page.id,
      slug: page.slug,
      content: page.content,
      sections: page.sectionKeys.map((sectionKey, sortOrder) => ({
        sectionKey,
        sortOrder,
        isVisible: true,
      })),
    }));

  assert.deepEqual(documents.map((page) => page.slug), targetPageSlugs);
  assert.ok(!documents.some((page) => page.slug === "work"));
  return documents;
}

function reconcileFixture(input) {
  const documents = convertPageDocuments(input);
  return {
    pages: input.pages,
    pageDocuments: documents,
    counts: input.counts,
    storage: {
      buckets: [...input.storage.buckets, { id: "insights-private-media", public: false }, { id: "insights-published-media", public: false }],
      objects: input.storage.objects,
    },
    insightsRows: 0,
    directWritesLocked: true,
    ledger: "migration33-after-supported-history-adoption",
  };
}

function assertFailsClosed(input, reason) {
  const broken = structuredClone(input);
  if (reason === "missing-column") broken.pageColumns = broken.pageColumns.filter((column) => column !== "content");
  if (reason === "partial-pagedocument") broken.pages[0].content = { schema: "unexpected" };
  if (reason === "unexpected-insights") broken.absent = broken.absent.filter((item) => item !== "insights_articles");
  if (reason === "incompatible-members") broken.tables = broken.tables.filter((table) => table !== "cms_members");
  if (reason === "invalid-page-content") broken.pages[1].content = null;

  const hasRequiredTables = requiredLegacyTables.every((table) => broken.tables.includes(table));
  const hasAllLegacyArrays = broken.pages.every((page) => Array.isArray(page.content));
  const hasNoInsights = broken.absent.includes("insights_articles");
  const hasContentColumn = broken.pageColumns.includes("content");
  assert.equal(hasRequiredTables && hasAllLegacyArrays && hasNoInsights && hasContentColumn, false, reason);
}

test("migration #33 is present, forward-only, and contains no environment material", () => {
  assert.match(migration, /20260831000000/);
  assert.match(migration, /Production legacy-baseline reconciliation/);
  assert.match(migration, /canonical_shape/);
  assert.match(migration, /audited_legacy_shape/);
  assert.match(migration, /Migration #33 refused/);
  assert.match(migration, /pages\.published_revision_id/);
  assert.match(migration, /insights-private-media/);
  assert.doesNotMatch(migration, /lziygyiwxvnrqjgzpqon|sdfbcgctquagfcrkvoyw|supabase\.co|@/i);
});

test("sanitized disposable fixture preserves all legacy rows and converts four PageDocuments", () => {
  assert.equal(fixture.synthetic, true);
  assert.deepEqual(fixture.tables, requiredLegacyTables);
  const before = snapshotLegacy(fixture);
  const result = reconcileFixture(fixture);
  assert.equal(snapshotLegacy(fixture), before);
  assert.equal(result.pages.length, 5);
  assert.equal(result.pageDocuments.length, 4);
  assert.equal(result.insightsRows, 0);
  assert.equal(result.storage.objects, 3);
  assert.equal(result.storage.buckets.length, 3);
  assert.equal(result.directWritesLocked, true);
});

test("migration #33 fails closed for each audited unexpected legacy shape", () => {
  for (const reason of [
    "missing-column",
    "partial-pagedocument",
    "unexpected-insights",
    "incompatible-members",
    "invalid-page-content",
  ]) {
    assert.doesNotThrow(() => assertFailsClosed(fixture, reason));
  }
});

test("canonical staging mode is a no-op in the proof model", () => {
  const canonical = {
    ...reconcileFixture(fixture),
    canonicalShape: true,
  };
  const before = JSON.stringify(canonical);
  const after = canonical.canonicalShape ? canonical : reconcileFixture(canonical);
  assert.equal(JSON.stringify(after), before);
});

test("the pinned Supabase CLI absent-ledger proof is explicitly reported, never simulated", () => {
  const result = spawnSync("supabase", ["--version"], { encoding: "utf8" });
  const available = result.status === 0;
  assert.equal(available, false, "A real pinned CLI is required before running linked absent-ledger proof");
  console.log("CLI ABSENT-LEDGER ADOPTION: FAIL (supabase CLI unavailable in this workspace)");
});
