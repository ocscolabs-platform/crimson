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

test("Production verifier is manual, environment-scoped, and least-privileged", () => {
  assert.match(verifier, /on:\n  workflow_dispatch:/);
  assert.doesNotMatch(verifier, /\n  push:/);
  assert.match(verifier, /permissions:\n  contents: read/);
  assert.match(verifier, /environment: production-supabase/);
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

test("Production verifier masks its connection and uses only read-only SQL", () => {
  assert.match(verifier, /::add-mask::\$SUPABASE_DB_PASSWORD/);
  assert.match(verifier, /::add-mask::\$encoded_db_password/);
  assert.match(verifier, /::add-mask::\$pooler_db_url/);
  assert.match(verifier, /postgresql:\/\/postgres\.\$\{SUPABASE_PROJECT_REF\}:\$encoded_db_password@\$PGHOST:\$PGPORT\/\$PGDATABASE\?sslmode=\$PGSSLMODE/);
  assert.ok((verifier.match(/set transaction read only;/g) ?? []).length >= 4);
  assert.doesNotMatch(verifier, /supabase\s+(?:migration repair|db push|migration up)/i);
  assert.doesNotMatch(verifier, /^\s*(?:insert|update|delete|alter|create|drop|truncate)\b/im);
});

test("Production verifier requires exact ledger and catalog baselines", () => {
  assert.match(verifier, /EXPECTED_MAIN_MIGRATION_COUNT: "48"/);
  assert.match(verifier, /EXPECTED_STAGING_MIGRATION_COUNT: "51"/);
  assert.match(verifier, /20261007000000/);
  assert.match(verifier, /20261007010000/);
  assert.match(verifier, /20261007020000/);
  assert.match(verifier, /diff -u "\$main_versions_file" "\$production_versions_file"/);
  assert.match(verifier, /cms_unpublish_upcoming_case_study\(uuid\)/);
  assert.match(verifier, /cms_save_case_study_revision\(uuid,text,jsonb\)/);
  assert.match(verifier, /cms_reorder_case_studies\(uuid\[\]\)/);
  assert.match(verifier, /mutation=NONE/);
});

test("Production verifier remains separate from the forward-only release path", () => {
  assert.doesNotMatch(releaseWorkflow, /Adopt the absent Production migration ledger/);
  assert.doesNotMatch(releaseWorkflow, /supabase migration repair/);
  assert.doesNotMatch(verifier, /Adopt the absent Production migration ledger/);
});
