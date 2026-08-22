#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const CATEGORIES = [
  "tables",
  "columns",
  "constraints",
  "indexes",
  "policies",
  "functions",
  "triggers",
  "grants",
  "routineGrants",
  "buckets",
  "migrationLedger",
];

const MIGRATION_DIRECTORY = path.resolve("supabase/migrations");

const QUERIES = {
  tables: `
    select n.nspname as schema_name, c.relname as table_name,
      case c.relkind when 'r' then 'table' when 'p' then 'partitioned_table'
        when 'v' then 'view' when 'm' then 'materialized_view' else c.relkind::text end as relation_kind,
      c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p','v','m')
    order by schema_name, table_name;
  `,
  columns: `
    select table_schema as schema_name, table_name, column_name,
      ordinal_position, data_type, udt_schema, udt_name, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_schema, table_name, ordinal_position;
  `,
  constraints: `
    select n.nspname as schema_name, cls.relname as table_name, con.conname as constraint_name,
      case con.contype when 'p' then 'primary_key' when 'f' then 'foreign_key'
        when 'u' then 'unique' when 'c' then 'check' when 'x' then 'exclusion'
        else con.contype::text end as constraint_type,
      pg_get_constraintdef(con.oid, true) as definition
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace n on n.oid = cls.relnamespace
    where n.nspname = 'public'
    order by schema_name, table_name, constraint_name;
  `,
  indexes: `
    select schemaname as schema_name, tablename as table_name, indexname as index_name,
      indexdef as definition
    from pg_indexes
    where schemaname = 'public'
    order by schema_name, table_name, index_name;
  `,
  policies: `
    select schemaname as schema_name, tablename as table_name, policyname as policy_name,
      permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
    order by schema_name, table_name, policy_name;
  `,
  functions: `
    select n.nspname as schema_name, p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments,
      pg_get_function_result(p.oid) as return_type, p.provolatile as volatility,
      p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f','p')
    order by schema_name, function_name, identity_arguments;
  `,
  triggers: `
    select n.nspname as schema_name, cls.relname as table_name,
      t.tgname as trigger_name, pg_get_triggerdef(t.oid, true) as definition
    from pg_trigger t
    join pg_class cls on cls.oid = t.tgrelid
    join pg_namespace n on n.oid = cls.relnamespace
    where n.nspname in ('public','storage') and not t.tgisinternal
    order by schema_name, table_name, trigger_name;
  `,
  grants: `
    select grantee, table_schema as schema_name, table_name, privilege_type,
      is_grantable
    from information_schema.table_privileges
    where table_schema in ('public', 'storage')
    order by grantee, schema_name, table_name, privilege_type;
  `,
  routineGrants: `
    select grantee, routine_schema as schema_name, routine_name as function_name,
      specific_name, privilege_type, is_grantable
    from information_schema.routine_privileges
    where routine_schema in ('public', 'storage')
    order by grantee, schema_name, function_name, specific_name, privilege_type;
  `,
  buckets: `
    select id, name, public, file_size_limit, allowed_mime_types
    from storage.buckets
    order by id;
  `,
  migrationLedger: `
    select version::text as version, name
    from supabase_migrations.schema_migrations
    order by version;
  `,
};

function usage() {
  console.error(`Usage:
  node scripts/audit-supabase-drift.mjs snapshot --source expected|staging --output <file> [--read-only]
  node scripts/audit-supabase-drift.mjs compare --expected <file> --actual <file> --output <file>`);
  process.exit(2);
}

function argValue(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)]));
  }
  if (typeof value === "string") {
    return value
      .replace(/\s+/g, " ")
      .replace(/\"/g, "")
      .replace(/\s*,\s*/g, ",")
      .trim()
      .toLowerCase();
  }
  return value;
}

function connectionFromEnvironment(source) {
  if (source === "expected") {
    const url = process.env.EXPECTED_DATABASE_URL;
    assert(url, "EXPECTED_DATABASE_URL is required for the expected-state database.");
    return { url, env: { ...process.env } };
  }

  assert(process.env.SUPABASE_PROJECT_REF, "SUPABASE_PROJECT_REF is required for the staging snapshot.");
  assert(process.env.SUPABASE_DB_PASSWORD, "SUPABASE_DB_PASSWORD is required for the staging snapshot.");
  const pgEnv = {
    ...process.env,
    PGHOST: `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
    PGPORT: "5432",
    PGUSER: "postgres",
    PGPASSWORD: process.env.SUPABASE_DB_PASSWORD,
    PGDATABASE: "postgres",
    PGSSLMODE: "require",
  };
  return { env: pgEnv };
}

function runPsql(connection, sql) {
  const query = sql.trim().replace(/;+\s*$/, "");
  const wrapped = `begin; set transaction read only; select coalesce(json_agg(row_to_json(result)), '[]'::json)::text from (${query}) result; commit;`;
  const args = ["-q", "-X", "-v", "ON_ERROR_STOP=1", "-t", "-A"];
  if (connection.url) args.push("--dbname", connection.url);
  args.push("-c", wrapped);
  const result = spawnSync("psql", args, { encoding: "utf8", env: connection.env });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "psql failed").trim());
  }
  const lines = result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const jsonLine = lines.at(-1);
  assert(jsonLine, "psql returned no JSON metadata.");
  return JSON.parse(jsonLine);
}

async function migrationFiles() {
  assert(existsSync(MIGRATION_DIRECTORY), `Missing ${MIGRATION_DIRECTORY}`);
  const names = (await readdir(MIGRATION_DIRECTORY))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
  return Promise.all(names.map(async (name) => ({
    name,
    content: await readFile(path.join(MIGRATION_DIRECTORY, name), "utf8"),
  })));
}

function tableKey(row) {
  return `${row.schema_name}.${row.table_name}`;
}

function categoryKey(category, row) {
  switch (category) {
    case "tables": return tableKey(row);
    case "columns": return `${row.schema_name}.${row.table_name}.${row.column_name}`;
    case "constraints": return `${row.schema_name}.${row.table_name}.${row.constraint_name}`;
    case "indexes": return `${row.schema_name}.${row.index_name}`;
    case "policies": return `${row.schema_name}.${row.table_name}.${row.policy_name}`;
    case "functions": return `${row.schema_name}.${row.function_name}(${row.identity_arguments})`;
    case "triggers": return `${row.schema_name}.${row.table_name}.${row.trigger_name}`;
    case "grants": return `${row.grantee}.${row.schema_name}.${row.table_name}.${row.privilege_type}`;
    case "routineGrants": return `${row.grantee}.${row.schema_name}.${row.function_name}.${row.specific_name}.${row.privilege_type}`;
    case "buckets": return row.id;
    case "migrationLedger": return row.version;
    default: return JSON.stringify(row);
  }
}

function rowSignature(category, row) {
  const copy = { ...row };
  switch (category) {
    case "tables": delete copy.table_name; break;
    case "columns": delete copy.ordinal_position; break;
    case "constraints": delete copy.constraint_name; break;
    case "indexes": delete copy.index_name; break;
    case "policies": delete copy.policy_name; break;
    case "functions": delete copy.function_name; delete copy.identity_arguments; break;
    case "triggers": delete copy.trigger_name; break;
    case "grants": delete copy.privilege_type; break;
    case "routineGrants": delete copy.privilege_type; break;
    case "migrationLedger": delete copy.version; break;
    default: break;
  }
  return JSON.stringify(normalize(copy));
}

function migrationEvidence(key, category, files) {
  const text = key.toLowerCase();
  const matches = files.filter((file) => {
    const content = file.content.toLowerCase();
    const parts = text.split(/[.()]/).filter((part) => part.length > 2);
    return parts.some((part) => content.includes(part));
  });
  if (matches.length === 0 && category === "migrationLedger") {
    return files.filter((file) => key === file.name.slice(0, 14)).map((file) => file.name);
  }
  return matches.map((file) => file.name);
}

async function snapshot(source, output) {
  const connection = connectionFromEnvironment(source);
  const files = await migrationFiles();
  const records = {};
  const warnings = [];
  for (const category of CATEGORIES) {
    try {
      records[category] = runPsql(connection, QUERIES[category]);
    } catch (error) {
      if (category === "buckets" && /relation .*storage\.buckets.* does not exist/i.test(error.message)) {
        records[category] = [];
        warnings.push(`${source}: storage.buckets is unavailable; Storage bucket comparison is incomplete.`);
      } else if (category === "migrationLedger" && /relation .*schema_migrations.* does not exist/i.test(error.message)) {
        records[category] = [];
        warnings.push(`${source}: supabase_migrations.schema_migrations is unavailable; migration-ledger comparison is incomplete.`);
      } else {
        throw new Error(`${source} snapshot failed for ${category}: ${error.message}`);
      }
    }
  }
  const snapshot = {
    schemaVersion: 1,
    source,
    generatedAt: new Date().toISOString(),
    migrationFiles: files.map(({ name }) => name),
    warnings,
    records,
  };
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`${source} snapshot written: ${output}`);
}

async function compareRecords(expected, actual) {
  const report = { categories: {}, summary: { MATCH: 0, MISSING: 0, DIFFERENT: 0, EXTRA: 0 }, dataCompatibilityRisks: [] };
  const allFiles = await migrationFiles();

  for (const category of CATEGORIES) {
    const expectedRows = expected.records[category] || [];
    const actualRows = actual.records[category] || [];
    const expectedMap = new Map(expectedRows.map((row) => [categoryKey(category, row), row]));
    const actualMap = new Map(actualRows.map((row) => [categoryKey(category, row), row]));
    const keys = new Set([...expectedMap.keys(), ...actualMap.keys()]);
    const objects = [];
    const details = [];
    for (const key of [...keys].sort()) {
      const expectedRow = expectedMap.get(key);
      const actualRow = actualMap.get(key);
      let status;
      if (!actualRow) status = "MISSING";
      else if (!expectedRow) status = "EXTRA";
      else if (rowSignature(category, expectedRow) === rowSignature(category, actualRow)) status = "MATCH";
      else status = "DIFFERENT";
      report.summary[status] += 1;
      const migration = status === "MATCH" ? [] : migrationEvidence(key, category, allFiles);
      objects.push({
        status,
        key,
        expected: expectedRow || null,
        actual: actualRow || null,
        migration,
      });
      if (status !== "MATCH") {
        details.push({ status, key, expected: expectedRow || null, actual: actualRow || null, migration });
      }
    }
    report.categories[category] = { expected: expectedRows.length, actual: actualRows.length, objects, details };
  }

  const nullableExpected = new Map((expected.records.columns || []).filter((row) => row.is_nullable === "NO").map((row) => [categoryKey("columns", row), row]));
  const actualColumns = new Map((actual.records.columns || []).map((row) => [categoryKey("columns", row), row]));
  for (const [key, expectedColumn] of nullableExpected) {
    const actualColumn = actualColumns.get(key);
    if (actualColumn && actualColumn.is_nullable !== "NO") {
      report.dataCompatibilityRisks.push({
        type: "nullable_column",
        key,
        migration: migrationEvidence(key, "columns", allFiles),
        message: "Existing rows may contain NULL values and must be checked before enforcing NOT NULL.",
      });
    }
  }
  for (const detail of report.categories.constraints.details || []) {
    if (detail.status === "MISSING" || detail.status === "DIFFERENT") {
      report.dataCompatibilityRisks.push({
        type: "constraint",
        key: detail.key,
        migration: detail.migration,
        message: "Existing rows must be validated against the expected constraint before it is added or changed.",
      });
    }
  }
  return report;
}

function markdown(report) {
  const lines = [
    "# Staging Supabase Schema Drift Inventory",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "This report compares a disposable database built from canonical Git migrations with a read-only catalog snapshot of `crimson-staging`.",
    "",
    "## Summary",
    "",
    ...Object.entries(report.summary).map(([status, count]) => `- ${status}: ${count}`),
    "",
  ];
  for (const [category, value] of Object.entries(report.categories)) {
    lines.push(`## ${category}`, "", `Expected objects: ${value.expected}; live objects: ${value.actual}.`, "");
    if (value.details.length === 0) lines.push("No drift detected.", "");
    else {
      lines.push("| Status | Object | Migration evidence |", "|---|---|---|");
      for (const detail of value.details) lines.push(`| ${detail.status} | \`${detail.key}\` | ${detail.migration.length ? detail.migration.map((item) => `\`${item}\``).join(", ") : "Unmapped; review required"} |`);
      lines.push("");
    }
  }
  lines.push("## Data compatibility risks", "");
  if (report.dataCompatibilityRisks.length === 0) lines.push("No automated risk indicators were found.", "");
  else for (const risk of report.dataCompatibilityRisks) lines.push(`- **${risk.type}** \`${risk.key}\`: ${risk.message} Migration evidence: ${risk.migration.join(", ") || "unmapped"}.`);
  return `${lines.join("\n")}\n`;
}

async function compare(expectedPath, actualPath, output) {
  const expected = JSON.parse(await readFile(expectedPath, "utf8"));
  const actual = JSON.parse(await readFile(actualPath, "utf8"));
  assert(expected.source === "expected", "Expected snapshot must have source=expected.");
  assert(actual.source === "staging", "Actual snapshot must have source=staging.");
  const report = await compareRecords(expected, actual);
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(output.replace(/\.json$/i, ".md"), markdown(report), "utf8");
  console.log(`comparison written: ${output}`);
  console.log(JSON.stringify(report.summary));
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "snapshot") {
    const source = argValue(args, "--source");
    const output = argValue(args, "--output");
    assert(source === "expected" || source === "staging", "--source must be expected or staging.");
    assert(output, "--output is required.");
    if (source === "staging") assert(args.includes("--read-only"), "Staging snapshots require --read-only.");
    await snapshot(source, output);
  } else if (command === "compare") {
    const expected = argValue(args, "--expected");
    const actual = argValue(args, "--actual");
    const output = argValue(args, "--output");
    assert(expected && actual && output, "--expected, --actual, and --output are required.");
    await compare(expected, actual, output);
  } else usage();
} catch (error) {
  console.error(`Drift audit failed: ${error.message}`);
  process.exit(1);
}
