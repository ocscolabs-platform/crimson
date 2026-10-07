import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const workflow = (await readFile(new URL("../.github/workflows/supabase-release.yml", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const pipelineDocs = (await readFile(new URL("../docs/SUPABASE-RELEASE-PIPELINE.md", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
const decisionLog = (await readFile(new URL("../docs/DECISIONS.md", import.meta.url), "utf8")).replaceAll("\r\n", "\n");

function sectionBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing section: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  return source.slice(startIndex, endIndex === -1 ? source.length : endIndex);
}

test("staging migration workflow applies on protected staging pushes", () => {
  assert.match(workflow, /branches:\s*\[main, staging\]/);
  assert.match(workflow, /- "\.github\/workflows\/supabase-release\.yml"/);
  assert.match(workflow, /- "scripts\/test-staging-supabase-migration-auto-apply\.mjs"/);

  const staging = sectionBetween(workflow, "  staging:\n", "  production:\n");
  assert.match(staging, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/staging'/);
  assert.match(staging, /environment: staging-supabase/);
  assert.match(staging, /EXPECTED_STAGING_NAME: crimson-staging/);
  assert.match(staging, /https:\/\/api\.supabase\.com\/v1\/projects\/\$SUPABASE_PROJECT_REF/);
  assert.match(staging, /project_name.*EXPECTED_STAGING_NAME/);
  assert.match(staging, /Link staging project[\s\S]*?supabase link --project-ref "\$SUPABASE_PROJECT_REF" --password "\$SUPABASE_DB_PASSWORD"/);
  assert.match(staging, /Prepare masked staging shared pooler URL/);
  assert.match(staging, /jq -rn --arg value "\$SUPABASE_DB_PASSWORD" '\$value \| @uri'/);
  assert.match(staging, /::add-mask::\$SUPABASE_DB_PASSWORD/);
  assert.match(staging, /::add-mask::\$encoded_db_password/);
  assert.match(staging, /::add-mask::\$pooler_db_url/);
  assert.match(staging, /postgresql:\/\/postgres\.\$\{SUPABASE_PROJECT_REF\}:\$encoded_db_password@aws-0-ap-northeast-1\.pooler\.supabase\.com:5432\/postgres\?sslmode=require/);
  assert.match(staging, /supabase migration list --db-url "\$STAGING_POOLER_DB_URL"/);
  assert.match(staging, /supabase db push --db-url "\$STAGING_POOLER_DB_URL" --dry-run/);
  assert.match(staging, /supabase db push --db-url "\$STAGING_POOLER_DB_URL" --yes/);
  assert.doesNotMatch(staging, /supabase (?:migration list|db push) --linked/);
  assert.match(staging, /Verify staging migration parity/);
  assert.match(staging, /schema_migrations/);
  assert.match(staging, /diff -u.*local_versions_file.*remote_versions_file/s);
  assert.match(staging, /export PGHOST="aws-0-ap-northeast-1\.pooler\.supabase\.com"/);
  assert.match(staging, /export PGPORT=5432/);
  assert.match(staging, /psql -Atqc "select version from supabase_migrations\.schema_migrations order by version"/);
  assert.match(staging, /duplicates=0; pending=0/);
  assert.doesNotMatch(staging, /20260829000000|migration #31|Migration #31/);
});

test("staging apply is branch- and target-gated while Production remains separate", () => {
  const staging = sectionBetween(workflow, "  staging:\n", "  production:\n");
  const production = workflow.slice(workflow.indexOf("  production:\n"));

  assert.match(staging, /Enforce staging-only apply boundary/);
  assert.match(staging, /GITHUB_REF.*refs\/heads\/staging/);
  assert.match(staging, /inputs\.target == 'staging'/);
  assert.doesNotMatch(staging, /inputs\.target == 'production'/);

  assert.match(production, /github\.ref == 'refs\/heads\/main'/);
  assert.match(production, /inputs\.target == 'production'/);
  assert.match(production, /inputs\.apply == true/);
  assert.match(production, /environment: production-supabase/);
  assert.match(production, /Apply Production migrations/);
});

test("release documentation records idempotent parity verification", () => {
  assert.match(pipelineDocs, /applies all pending canonical migrations in order/);
  assert.match(pipelineDocs, /Shared Session Pooler/);
  assert.match(pipelineDocs, /--db-url/);
  assert.match(pipelineDocs, /exact repository\/database migration parity/);
  assert.match(pipelineDocs, /If no migrations are pending/);
  assert.match(decisionLog, /ADR-066 - Automatically apply canonical migrations on protected staging pushes/);
  assert.match(decisionLog, /No account-specific project ref, credential, Production connection, or `main` change/);
});
