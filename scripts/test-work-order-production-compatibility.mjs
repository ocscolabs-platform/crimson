import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hasDuplicateWorkSortOrder,
  orderWorkRowsForCompatibility,
} from "../src/lib/work-order-compatibility.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const [migration, publicLoader, adminLoader] = await Promise.all([
  source("supabase/migrations/20261007030000_normalize_legacy_work_ordering.sql"),
  source("src/lib/cms-content.ts"),
  source("src/lib/admin-content.ts"),
]);

const legacyProduction = [
  { slug: "casa-dental-singapore", sort_order: 0, created_at: "2026-08-01T00:00:00Z", is_featured: false },
  { slug: "oliv-lead-discovery", sort_order: 0, created_at: "2026-08-02T00:00:00Z", is_featured: false },
  { slug: "cimet-law", sort_order: 1, created_at: "2026-08-03T00:00:00Z", is_featured: true },
  { slug: "cairnstack", sort_order: 2, created_at: "2026-08-04T00:00:00Z", is_featured: false },
  { slug: "trxio", sort_order: 3, created_at: "2026-08-05T00:00:00Z", is_featured: false },
  { slug: "toofarts", sort_order: 4, created_at: "2026-08-06T00:00:00Z", is_featured: false },
  { slug: "my-gym-vault", sort_order: 5, created_at: "2026-08-07T00:00:00Z", is_featured: false },
];

const expectedLegacyOrder = [
  "cimet-law",
  "casa-dental-singapore",
  "oliv-lead-discovery",
  "cairnstack",
  "trxio",
  "toofarts",
  "my-gym-vault",
];

test("legacy duplicate fixture preserves the approved featured-first sequence", () => {
  assert.equal(hasDuplicateWorkSortOrder(legacyProduction), true);
  assert.deepEqual(
    orderWorkRowsForCompatibility(legacyProduction).map(({ slug }) => slug),
    expectedLegacyOrder,
  );
});

test("already-normalized data remains under canonical manual ordering", () => {
  const normalized = expectedLegacyOrder.map((slug, sort_order) => {
    const sourceRow = legacyProduction.find((row) => row.slug === slug);
    return { ...sourceRow, sort_order };
  });

  assert.equal(hasDuplicateWorkSortOrder(normalized), false);
  assert.deepEqual(
    orderWorkRowsForCompatibility(normalized).map(({ slug }) => slug),
    expectedLegacyOrder,
  );

  const ownerReordered = [normalized[1], normalized[0], ...normalized.slice(2)]
    .map((row, sort_order) => ({ ...row, sort_order }));
  assert.deepEqual(
    orderWorkRowsForCompatibility(ownerReordered).map(({ slug }) => slug),
    ["casa-dental-singapore", "cimet-law", ...expectedLegacyOrder.slice(2)],
  );
});

test("forward migration is duplicate-gated and derives one local dense legacy order", () => {
  assert.match(migration, /if not exists \([\s\S]*?group by sort_order[\s\S]*?having count\(\*\) > 1[\s\S]*?return;/);
  assert.match(migration, /row_number\(\) over \([\s\S]*?order by is_featured desc, sort_order asc, created_at asc, slug asc[\s\S]*?\) - 1/);
  assert.match(migration, /set sort_order = desired\.sort_order/);
  assert.doesNotMatch(migration, /cimet|casa|oliv|cairnstack|trxio|toofarts|my-gym-vault/i);
  assert.doesNotMatch(migration, /insert into public\.case_studies|delete from public\.case_studies/i);
});

test("migration retains the publication guard and normal audit behavior", () => {
  assert.match(migration, /disable trigger case_studies_prepare_publication/);
  assert.match(migration, /enable trigger case_studies_prepare_publication/g);
  assert.doesNotMatch(migration, /disable trigger (?:all|case_studies_audit_changes|case_studies_set_updated_at)/i);
  assert.doesNotMatch(migration, /grant |revoke |alter policy|drop policy/i);
});

test("only active private revision payloads are aligned", () => {
  const revisionUpdate = migration.slice(migration.indexOf("update public.cms_revisions as revision"));
  assert.match(revisionUpdate, /jsonb_set\([\s\S]*?'\{sort_order\}'[\s\S]*?to_jsonb\(desired\.sort_order\)/);
  assert.match(revisionUpdate, /revision\.status in \('draft', 'review'\)/);
  assert.doesNotMatch(revisionUpdate, /revision\.status in \('published', 'archived'\)/);
  assert.doesNotMatch(revisionUpdate, /delete from public\.cms_revisions/);
});

test("public and Work Library loaders share the transitional compatibility boundary", () => {
  assert.match(publicLoader, /select\("[^"]*is_featured[^"]*sort_order[^"]*created_at/);
  assert.match(publicLoader, /orderWorkRowsForCompatibility\(data as PublishedCaseStudy\[\]\)/);
  assert.match(adminLoader, /select\("[^"]*status[^"]*sort_order[^"]*is_featured[^"]*published_at[^"]*created_at/);
  assert.match(adminLoader, /hasDuplicateWorkSortOrder\(publishedCaseStudies\)/);
  assert.match(adminLoader, /orderWorkRowsForCompatibility\(/);
});

console.log("Production legacy Work-order compatibility assertions passed");
