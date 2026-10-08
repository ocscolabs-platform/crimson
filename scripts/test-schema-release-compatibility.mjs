import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateMigrationDelta,
  REQUIRES_TWO_PHASE,
} from "./verify-schema-release-compatibility.mjs";

const migration = (classification) =>
  classification
    ? `-- release-compatibility: ${classification}\n\nselect 1;\n`
    : "select 1;\n";

const loadFrom = (sources) => async (path) => sources[path];
const ciWorkflow = (await readFile(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
)).replaceAll("\r\n", "\n");

test("no migration delta passes without database ceremony", async () => {
  const result = await evaluateMigrationDelta([]);

  assert.equal(result.ok, true);
  assert.equal(result.message, "NO DATABASE MIGRATION — NOT APPLICABLE");
});

test("an additive migration declared backward-compatible passes", async () => {
  const path = "supabase/migrations/20990101000000_add_example.sql";
  const result = await evaluateMigrationDelta(
    [{ status: "A", path }],
    loadFrom({ [path]: migration("backward-compatible") }),
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.files, [path]);
});

test("a new migration without a declaration fails", async () => {
  const path = "supabase/migrations/20990101000000_add_example.sql";
  const result = await evaluateMigrationDelta(
    [{ status: "A", path }],
    loadFrom({ [path]: migration(null) }),
  );

  assert.equal(result.ok, false);
  assert.match(result.errors[0], /missing release-compatibility declaration/);
});

test("a migration declared two-phase blocks promotion", async () => {
  const path = "supabase/migrations/20990101000000_break_example.sql";
  const result = await evaluateMigrationDelta(
    [{ status: "A", path }],
    loadFrom({ [path]: migration(REQUIRES_TWO_PHASE) }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.message, "SCHEMA-SENSITIVE RELEASE REQUIRES SPLIT PROMOTION");
});

test("untouched historical migrations require no retroactive metadata", async () => {
  const result = await evaluateMigrationDelta([]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.files, []);
});

test("an edited historical migration is rejected instead of reclassified", async () => {
  const path = "supabase/migrations/20260819000000_create_inquiries.sql";
  const result = await evaluateMigrationDelta(
    [{ status: "M", path }],
    loadFrom({ [path]: migration("backward-compatible") }),
  );

  assert.equal(result.ok, false);
  assert.match(result.errors[0], /existing canonical migrations are immutable/);
});

test("protected CI evaluates the release delta without a Production environment", () => {
  assert.match(ciWorkflow, /fetch-depth: 0/);
  assert.match(ciWorkflow, /github\.event\.pull_request\.base\.sha/);
  assert.match(ciWorkflow, /github\.event\.before/);
  assert.match(
    ciWorkflow,
    /node scripts\/verify-schema-release-compatibility\.mjs --base "\$SCHEMA_RELEASE_BASE"/,
  );
  assert.doesNotMatch(ciWorkflow, /environment:\s*production-supabase/);
  assert.doesNotMatch(ciWorkflow, /supabase (?:db push|migration)/);
});
