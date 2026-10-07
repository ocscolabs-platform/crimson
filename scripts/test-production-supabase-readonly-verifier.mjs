import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const verifier = (await readFile(
  new URL("../.github/workflows/verify-production-supabase-readonly.yml", import.meta.url),
  "utf8",
)).replaceAll("\r\n", "\n");
const releaseWorkflow = (await readFile(
  new URL("../.github/workflows/supabase-release.yml", import.meta.url),
  "utf8",
)).replaceAll("\r\n", "\n");
const catalogVerifier = (await readFile(
  new URL("./verify-supabase-catalog-contract.mjs", import.meta.url),
  "utf8",
)).replaceAll("\r\n", "\n");

test("Production verifier is manual, environment-scoped, and least-privileged", () => {
  assert.match(verifier, /on:\n  workflow_dispatch:/);
  assert.doesNotMatch(verifier, /\n  push:/);
  assert.match(verifier, /permissions:\n  contents: read/);
  assert.match(verifier, /environment: production-supabase/);
  assert.match(verifier, /ref: staging/);
  assert.match(verifier, /SUPABASE_ACCESS_TOKEN: \$\{\{ secrets\.SUPABASE_ACCESS_TOKEN \}\}/);
  assert.match(verifier, /SUPABASE_DB_PASSWORD: \$\{\{ secrets\.SUPABASE_DB_PASSWORD \}\}/);
  assert.match(verifier, /SUPABASE_PROJECT_REF: \$\{\{ vars\.SUPABASE_PROJECT_REF \}\}/);
  assert.match(verifier, /version: 2\.111\.0/);
});

test("Production verifier proves token auth and exact project identity read-only", () => {
  assert.match(verifier, /curl --fail-with-body --silent --show-error/);
  assert.match(verifier, /https:\/\/api\.supabase\.com\/v1\/projects\/\$SUPABASE_PROJECT_REF/);
  assert.match(verifier, /project_ref.*SUPABASE_PROJECT_REF/s);
  assert.match(verifier, /project_name.*EXPECTED_PRODUCTION_NAME/s);
  assert.match(verifier, /Unauthorized absent/);
  assert.doesNotMatch(verifier, /supabase projects create|POST|PATCH|PUT|DELETE/);
});

test("Production verifier derives ledger parity from the checked-out repository", () => {
  assert.match(verifier, /find supabase\/migrations/);
  assert.match(verifier, /supabase_migrations\.schema_migrations/);
  assert.match(verifier, /diff -u "\$canonical_versions_file" "\$production_versions_file"/);
  assert.doesNotMatch(verifier, /EXPECTED_(?:MAIN|STAGING)_MIGRATION_COUNT/);
  assert.doesNotMatch(verifier, /20261007000000|20261007010000|20261007020000/);
  assert.doesNotMatch(verifier, /expected staging delta|pre-promotion state/i);
});

test("Production verifier masks transport and invokes the shared read-only catalog contract", () => {
  assert.match(verifier, /::add-mask::\$SUPABASE_DB_PASSWORD/);
  assert.match(verifier, /::add-mask::\$encoded_db_password/);
  assert.match(verifier, /::add-mask::\$pooler_db_url/);
  assert.ok((verifier.match(/set transaction read only;/g) ?? []).length >= 2);
  assert.match(verifier, /node scripts\/verify-supabase-catalog-contract\.mjs/);
  assert.match(catalogVerifier, /set transaction read only;/);
  assert.doesNotMatch(verifier, /supabase\s+(?:migration repair|db push|migration up)/i);
  assert.doesNotMatch(verifier, /^\s*(?:insert|update|delete|alter|create|drop|truncate)\b/im);
});

test("release workflow keeps ledger and shared catalog checks separate", () => {
  assert.match(releaseWorkflow, /name: Verify staging migration parity/);
  assert.match(releaseWorkflow, /name: Verify staging catalog contract/);
  assert.match(releaseWorkflow, /name: Verify Production ledger is a canonical prefix/);
  assert.match(releaseWorkflow, /name: Verify current Production catalog precondition/);
  assert.match(releaseWorkflow, /name: Verify Production migration parity/);
  assert.match(releaseWorkflow, /name: Verify Production catalog contract after apply/);
  assert.doesNotMatch(releaseWorkflow, /supabase migration repair/);
});
