import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

const workflow = (await readFile(
  new URL("../.github/workflows/supabase-release.yml", import.meta.url),
  "utf8",
)).replaceAll("\r\n", "\n");

function sectionBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing section: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  return source.slice(startIndex, endIndex === -1 ? source.length : endIndex);
}

const staging = sectionBetween(workflow, "  staging:\n", "  production:\n");
const production = workflow.slice(workflow.indexOf("  production:\n"));
const applyBoundary = sectionBetween(
  production,
  "      - name: Enforce Production-only apply boundary\n",
  "      - name: Verify exact Production project identity\n",
);
const applyStep = sectionBetween(
  production,
  "      - name: Apply Production migrations\n",
  "      - name: Verify Production migration parity\n",
);
const parityStep = production.slice(
  production.indexOf("      - name: Verify Production migration parity\n"),
);

test("historical Production ledger repair is absent from the ordinary release path", () => {
  assert.doesNotMatch(production, /supabase\s+migration\s+repair/i);
  assert.doesNotMatch(production, /Adopt the absent Production migration ledger/i);
  assert.doesNotMatch(production, /--status\s+(?:applied|reverted)/i);
  assert.doesNotMatch(production, /20260819000000 20260820000000/);
});

test("apply=false is a read-only Production plan with no mutation command", () => {
  assert.match(production, /supabase migration list --db-url "\$PRODUCTION_POOLER_DB_URL"/);
  assert.match(production, /supabase db push --db-url "\$PRODUCTION_POOLER_DB_URL" --dry-run/);
  assert.doesNotMatch(production, /supabase\s+migration\s+up/i);
  assert.doesNotMatch(production, /^\s*(?:insert|update|delete|alter|create|drop|truncate)\b/im);

  assert.match(applyStep, /github\.event_name == 'workflow_dispatch'/);
  assert.match(applyStep, /github\.ref == 'refs\/heads\/main'/);
  assert.match(applyStep, /inputs\.target == 'production'/);
  assert.match(applyStep, /inputs\.apply == true/);
  assert.match(applyStep, /supabase db push --db-url "\$PRODUCTION_POOLER_DB_URL" --yes/);
  assert.ok(
    production.indexOf("Validate Production migration plan") <
      production.indexOf("Apply Production migrations"),
    "Production dry-run must precede the conditional apply step",
  );
});

test("apply=true is manual-main-only, forward-only, and parity checked", () => {
  assert.match(applyBoundary, /github\.event_name == 'workflow_dispatch'/);
  assert.match(applyBoundary, /inputs\.apply == true/);
  assert.match(applyBoundary, /GITHUB_REF.*refs\/heads\/main/s);
  assert.match(applyBoundary, /EXPECTED_PRODUCTION_NAME.*ocscolabs-platform-website-crm/s);
  assert.match(parityStep, /set transaction read only;/);
  assert.match(parityStep, /select version from supabase_migrations\.schema_migrations order by version;/);
  assert.match(parityStep, /diff -u "\$local_versions_file" "\$production_versions_file"/);
  assert.match(parityStep, /duplicates=0; pending=0/);
  assert.ok(
    production.indexOf("Apply Production migrations") <
      production.indexOf("Verify Production migration parity"),
    "exact parity must be checked after the forward apply",
  );
});

test("Production identity, pooler transport, and secret masking fail closed", () => {
  assert.match(production, /EXPECTED_PRODUCTION_NAME: ocscolabs-platform-website-crm/);
  assert.match(production, /https:\/\/api\.supabase\.com\/v1\/projects\/\$SUPABASE_PROJECT_REF/);
  assert.match(production, /project_ref.*SUPABASE_PROJECT_REF/s);
  assert.match(production, /project_name.*EXPECTED_PRODUCTION_NAME/s);
  assert.match(production, /Link Production project[\s\S]*supabase link --project-ref "\$SUPABASE_PROJECT_REF"/);
  assert.match(production, /jq -rn --arg value "\$SUPABASE_DB_PASSWORD" '\$value \| @uri'/);
  assert.match(production, /::add-mask::\$SUPABASE_DB_PASSWORD/);
  assert.match(production, /::add-mask::\$encoded_db_password/);
  assert.match(production, /::add-mask::\$pooler_db_url/);
  assert.match(
    production,
    /postgresql:\/\/postgres\.\$\{SUPABASE_PROJECT_REF\}:\$encoded_db_password@aws-0-ap-northeast-1\.pooler\.supabase\.com:5432\/postgres\?sslmode=require/,
  );
  assert.ok(
    production.indexOf('echo "::add-mask::$pooler_db_url"') <
      production.indexOf("printf 'PRODUCTION_POOLER_DB_URL=%s\\n'"),
    "the complete Production URL must be masked before it enters GITHUB_ENV",
  );
  assert.doesNotMatch(production, /echo\s+"\$SUPABASE_DB_PASSWORD"/);
  assert.doesNotMatch(production, /echo\s+"\$PRODUCTION_POOLER_DB_URL"/);
});

test("unexpected Production drift fails without automatic reconciliation", () => {
  assert.match(production, /Verify Production ledger is a canonical prefix/);
  assert.ok((production.match(/set transaction read only;/g) ?? []).length >= 3);
  assert.match(production, /comm -23 "\$production_versions_file" "\$local_versions_file"/);
  assert.match(production, /head -n "\$production_count" "\$local_versions_file"/);
  assert.match(production, /diff -u "\$expected_prefix_file" "\$production_versions_file"/);
  assert.match(production, /explicit reconciliation review is required/);
  assert.doesNotMatch(workflow, /supabase\s+migration\s+repair/i);
});

test("staging keeps its established identity, pooler, plan, apply, and parity path", () => {
  assert.match(staging, /environment: staging-supabase/);
  assert.match(staging, /EXPECTED_STAGING_NAME: crimson-staging/);
  assert.match(staging, /Verify exact staging project identity/);
  assert.match(staging, /Prepare masked staging shared pooler URL/);
  assert.match(staging, /postgresql:\/\/postgres\.\$\{SUPABASE_PROJECT_REF\}:/);
  assert.match(staging, /supabase migration list --db-url "\$STAGING_POOLER_DB_URL"/);
  assert.match(staging, /supabase db push --db-url "\$STAGING_POOLER_DB_URL" --dry-run/);
  assert.match(staging, /supabase db push --db-url "\$STAGING_POOLER_DB_URL" --yes/);
  assert.match(staging, /Verify staging migration parity/);
  assert.match(staging, /diff -u.*local_versions_file.*remote_versions_file/s);
});
