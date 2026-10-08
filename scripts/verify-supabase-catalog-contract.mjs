import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const CORE_TABLES = [
  "site_settings",
  "navigation_items",
  "pages",
  "page_sections",
  "services",
  "case_studies",
  "case_study_services",
  "cms_members",
  "cms_audit_log",
  "cms_global_audit_log",
  "cms_revisions",
  "inquiries",
];

const PROTECTED_TABLES = [
  "site_settings",
  "navigation_items",
  "pages",
  "page_sections",
  "services",
  "case_studies",
  "case_study_services",
  "cms_revisions",
];

const WRITE_PRIVILEGES = new Set([
  "INSERT",
  "UPDATE",
  "DELETE",
]);

export const CATALOG_CONTRACT = Object.freeze({
  tables: CORE_TABLES.map((name) => ({ name, rls: true })),
  columns: [
    { table: "pages", name: "content", type: "jsonb", nullable: false },
    { table: "pages", name: "status", type: "text", nullable: false },
    { table: "services", name: "status", type: "text", nullable: false },
    { table: "services", name: "published_at", type: "timestamptz", nullable: true },
    { table: "case_studies", name: "status", type: "text", nullable: false },
    { table: "case_studies", name: "project_type", type: "text", nullable: false },
    { table: "case_studies", name: "is_featured", type: "bool", nullable: false },
    { table: "case_studies", name: "sort_order", type: "int4", nullable: false },
    { table: "case_studies", name: "published_at", type: "timestamptz", nullable: true },
    { table: "cms_revisions", name: "entity_type", type: "text", nullable: false },
    { table: "cms_revisions", name: "entity_key", type: "text", nullable: false },
    { table: "cms_revisions", name: "status", type: "text", nullable: false },
    { table: "cms_revisions", name: "payload", type: "jsonb", nullable: false },
    { table: "cms_members", name: "role", type: "text", nullable: false },
  ],
  functions: [
    { identity: "cms_set_updated_at()", securityDefiner: false, owner: "postgres" },
    { identity: "cms_current_role()", securityDefiner: true, owner: "postgres" },
    { identity: "cms_has_role(text[])", securityDefiner: true, owner: "postgres" },
    { identity: "cms_audit_case_study_change()", securityDefiner: true, owner: "postgres" },
    { identity: "cms_validate_case_study_media()", securityDefiner: false, owner: "postgres" },
    { identity: "cms_prepare_case_study_publication()", securityDefiner: true, owner: "postgres" },
    { identity: "cms_save_revision(text, text, text, jsonb)", securityDefiner: true, owner: "postgres" },
    { identity: "cms_publish_revision(uuid)", securityDefiner: true, owner: "postgres" },
    { identity: "cms_restore_revision(uuid)", securityDefiner: true, owner: "postgres" },
    { identity: "cms_create_case_study(text)", securityDefiner: true, owner: "postgres" },
    { identity: "cms_unpublish_upcoming_case_study(uuid)", securityDefiner: true, owner: "postgres" },
    { identity: "cms_save_case_study_revision(uuid, text, jsonb)", securityDefiner: true, owner: "postgres" },
    { identity: "cms_reorder_case_studies(uuid[])", securityDefiner: true, owner: "postgres" },
  ],
  triggers: [
    {
      name: "case_studies_audit_changes",
      table: "case_studies",
      timing: "AFTER",
      events: ["INSERT", "UPDATE", "DELETE"],
      rowLevel: true,
      enabled: "O",
      function: "public.cms_audit_case_study_change()",
      when: null,
    },
    {
      name: "case_studies_prepare_publication",
      table: "case_studies",
      timing: "BEFORE",
      events: ["UPDATE"],
      rowLevel: true,
      enabled: "O",
      function: "public.cms_prepare_case_study_publication()",
      when: null,
    },
    {
      name: "case_studies_set_updated_at",
      table: "case_studies",
      timing: "BEFORE",
      events: ["UPDATE"],
      rowLevel: true,
      enabled: "O",
      function: "public.cms_set_updated_at()",
      when: null,
    },
    {
      name: "case_studies_validate_media",
      table: "case_studies",
      timing: "BEFORE",
      events: ["INSERT", "UPDATE"],
      rowLevel: true,
      enabled: "O",
      function: "public.cms_validate_case_study_media()",
      when: null,
    },
  ],
  policies: [
    {
      schema: "public",
      table: "case_studies",
      name: "published case studies are public",
      command: "SELECT",
      roles: ["anon", "authenticated"],
    },
    {
      schema: "public",
      table: "case_studies",
      name: "cms members can read all case studies",
      command: "SELECT",
      roles: ["authenticated"],
    },
    {
      schema: "public",
      table: "cms_revisions",
      name: "cms members can read revisions",
      command: "SELECT",
      roles: ["authenticated"],
    },
    {
      schema: "storage",
      table: "objects",
      name: "cms members can view case study media",
      command: "SELECT",
      roles: ["authenticated"],
    },
    {
      schema: "storage",
      table: "objects",
      name: "owners can upload case study media",
      command: "INSERT",
      roles: ["authenticated"],
    },
    {
      schema: "storage",
      table: "objects",
      name: "owners can update case study media",
      command: "UPDATE",
      roles: ["authenticated"],
    },
    {
      schema: "storage",
      table: "objects",
      name: "owners can remove case study media",
      command: "DELETE",
      roles: ["authenticated"],
    },
    {
      schema: "storage",
      table: "objects",
      name: "published approved case study media is public",
      command: "SELECT",
      roles: ["anon", "authenticated"],
    },
  ],
  buckets: [
    { id: "case-study-media", public: false, fileSizeLimit: 2097152, mimeTypes: ["image/webp"] },
    { id: "insights-private-media", public: false, fileSizeLimit: 2097152, mimeTypes: ["image/webp"] },
    { id: "insights-published-media", public: true, fileSizeLimit: 2097152, mimeTypes: ["image/webp"] },
  ],
  protectedTables: PROTECTED_TABLES,
  tableSelectGrants: [
    { table: "cms_revisions", grantee: "authenticated", privilege: "SELECT" },
  ],
  routineExecuteGrants: [
    "cms_save_revision(text, text, text, jsonb)",
    "cms_publish_revision(uuid)",
    "cms_restore_revision(uuid)",
    "cms_create_case_study(text)",
    "cms_unpublish_upcoming_case_study(uuid)",
    "cms_save_case_study_revision(uuid, text, jsonb)",
    "cms_reorder_case_studies(uuid[])",
  ],
});

const functionNames = CATALOG_CONTRACT.functions
  .map(({ identity }) => `'${identity.slice(0, identity.indexOf("("))}'`)
  .join(", ");
const tableNames = CATALOG_CONTRACT.tables.map(({ name }) => `'${name}'`).join(", ");
const columnTables = [...new Set(CATALOG_CONTRACT.columns.map(({ table }) => table))]
  .map((name) => `'${name}'`)
  .join(", ");
const triggerNames = CATALOG_CONTRACT.triggers.map(({ name }) => `'${name}'`).join(", ");
const policyNames = CATALOG_CONTRACT.policies.map(({ name }) => `'${name.replaceAll("'", "''")}'`).join(", ");
const bucketNames = CATALOG_CONTRACT.buckets.map(({ id }) => `'${id}'`).join(", ");
const protectedTables = CATALOG_CONTRACT.protectedTables.map((name) => `'${name}'`).join(", ");

export const CATALOG_QUERY = `
begin;
set transaction read only;
set local statement_timeout = '30s';
select json_build_object(
  'tables', coalesce((
    select json_agg(json_build_object(
      'name', c.relname,
      'rls', c.relrowsecurity
    ) order by c.relname)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relname in (${tableNames})
  ), '[]'::json),
  'columns', coalesce((
    select json_agg(json_build_object(
      'table', cols.table_name,
      'name', cols.column_name,
      'type', cols.udt_name,
      'nullable', cols.is_nullable = 'YES'
    ) order by cols.table_name, cols.column_name)
    from information_schema.columns cols
    where cols.table_schema = 'public'
      and cols.table_name in (${columnTables})
  ), '[]'::json),
  'functions', coalesce((
    select json_agg(json_build_object(
      'identity', p.proname || '(' || pg_catalog.oidvectortypes(p.proargtypes) || ')',
      'securityDefiner', p.prosecdef,
      'owner', pg_catalog.pg_get_userbyid(p.proowner)
    ) order by p.proname, pg_catalog.oidvectortypes(p.proargtypes))
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (${functionNames})
  ), '[]'::json),
  'triggers', coalesce((
    select json_agg(json_build_object(
      'name', t.tgname,
      'table', relation.relname,
      'timing', case when (t.tgtype & 2) <> 0 then 'BEFORE' else 'AFTER' end,
      'events', array_remove(array[
        case when (t.tgtype & 4) <> 0 then 'INSERT' end,
        case when (t.tgtype & 16) <> 0 then 'UPDATE' end,
        case when (t.tgtype & 8) <> 0 then 'DELETE' end,
        case when (t.tgtype & 32) <> 0 then 'TRUNCATE' end
      ], null),
      'rowLevel', (t.tgtype & 1) <> 0,
      'enabled', t.tgenabled::text,
      'function', function_ns.nspname || '.' || function_proc.proname || '(' || pg_catalog.oidvectortypes(function_proc.proargtypes) || ')',
      'when', pg_catalog.pg_get_expr(t.tgqual, t.tgrelid)
    ) order by t.tgname)
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_class relation on relation.oid = t.tgrelid
    join pg_catalog.pg_namespace relation_ns on relation_ns.oid = relation.relnamespace
    join pg_catalog.pg_proc function_proc on function_proc.oid = t.tgfoid
    join pg_catalog.pg_namespace function_ns on function_ns.oid = function_proc.pronamespace
    where not t.tgisinternal
      and relation_ns.nspname = 'public'
      and t.tgname in (${triggerNames})
  ), '[]'::json),
  'policies', coalesce((
    select json_agg(json_build_object(
      'schema', schemaname,
      'table', tablename,
      'name', policyname,
      'command', cmd,
      'roles', roles::text[],
      'permissive', permissive,
      'usingExpression', qual,
      'checkExpression', with_check
    ) order by schemaname, tablename, policyname)
    from pg_catalog.pg_policies
    where policyname in (${policyNames})
       or (schemaname = 'storage' and tablename = 'objects')
  ), '[]'::json),
  'buckets', coalesce((
    select json_agg(json_build_object(
      'id', id,
      'public', public,
      'fileSizeLimit', file_size_limit,
      'mimeTypes', allowed_mime_types
    ) order by id)
    from storage.buckets
    where id in (${bucketNames})
  ), '[]'::json),
  'tableGrants', coalesce((
    select json_agg(json_build_object(
      'table', table_name,
      'grantee', grantee,
      'privilege', privilege_type
    ) order by table_name, grantee, privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (${protectedTables})
      and grantee in ('anon', 'authenticated')
  ), '[]'::json),
  'routineGrants', coalesce((
    select json_agg(json_build_object(
      'identity', p.proname || '(' || pg_catalog.oidvectortypes(p.proargtypes) || ')',
      'grantee', role_name,
      'execute', pg_catalog.has_function_privilege(role_name, p.oid, 'EXECUTE')
    ) order by p.proname, pg_catalog.oidvectortypes(p.proargtypes), role_name)
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join (values ('authenticated'::text)) roles(role_name)
    where n.nspname = 'public'
      and p.proname in (${functionNames})
  ), '[]'::json)
)::text;
commit;
`;

function sameArray(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function rolesInclude(actual = [], expected = []) {
  return expected.every((role) => actual.includes(role));
}

function addError(errors, section, object, issue, expected, actual) {
  errors.push({ section, object, issue, expected, actual });
}

export function evaluateCatalogContract(snapshot, contract = CATALOG_CONTRACT) {
  const errors = [];
  const tableByName = new Map((snapshot.tables ?? []).map((item) => [item.name, item]));
  for (const expected of contract.tables) {
    const actual = tableByName.get(expected.name);
    if (!actual) {
      addError(errors, "tables", expected.name, "missing object", expected, null);
    } else if (actual.rls !== expected.rls) {
      addError(errors, "rls", expected.name, "mismatched object", expected.rls, actual.rls);
    }
  }

  const columnByKey = new Map((snapshot.columns ?? []).map((item) => [`${item.table}.${item.name}`, item]));
  for (const expected of contract.columns) {
    const key = `${expected.table}.${expected.name}`;
    const actual = columnByKey.get(key);
    if (!actual) {
      addError(errors, "columns", key, "missing object", expected, null);
    } else if (actual.type !== expected.type || actual.nullable !== expected.nullable) {
      addError(errors, "columns", key, "mismatched object", expected, actual);
    }
  }

  const functionByIdentity = new Map((snapshot.functions ?? []).map((item) => [item.identity, item]));
  for (const expected of contract.functions) {
    const actual = functionByIdentity.get(expected.identity);
    if (!actual) {
      addError(errors, "functions", expected.identity, "missing object", expected, null);
    } else if (
      actual.securityDefiner !== expected.securityDefiner ||
      actual.owner !== expected.owner
    ) {
      addError(errors, "functions", expected.identity, "mismatched object", expected, actual);
    }
  }

  const triggerByName = new Map((snapshot.triggers ?? []).map((item) => [item.name, item]));
  for (const expected of contract.triggers) {
    const actual = triggerByName.get(expected.name);
    if (!actual) {
      addError(errors, "triggers", expected.name, "missing object", expected, null);
      continue;
    }
    const matches =
      actual.table === expected.table &&
      actual.timing === expected.timing &&
      sameArray(actual.events, expected.events) &&
      actual.rowLevel === expected.rowLevel &&
      actual.enabled === expected.enabled &&
      actual.function === expected.function &&
      actual.when === expected.when;
    if (!matches) {
      addError(errors, "triggers", expected.name, "mismatched object", expected, actual);
    }
  }

  const policyByKey = new Map(
    (snapshot.policies ?? []).map((item) => [`${item.schema}.${item.table}.${item.name}`, item]),
  );
  for (const expected of contract.policies) {
    const key = `${expected.schema}.${expected.table}.${expected.name}`;
    const actual = policyByKey.get(key);
    if (!actual) {
      addError(errors, "policies", key, "missing object", expected, null);
    } else if (actual.command !== expected.command || !rolesInclude(actual.roles, expected.roles)) {
      addError(errors, "policies", key, "mismatched object", expected, actual);
    }
  }

  const bucketById = new Map((snapshot.buckets ?? []).map((item) => [item.id, item]));
  for (const expected of contract.buckets) {
    const actual = bucketById.get(expected.id);
    if (!actual) {
      addError(errors, "storage", expected.id, "missing object", expected, null);
    } else if (
      actual.public !== expected.public ||
      Number(actual.fileSizeLimit) !== expected.fileSizeLimit ||
      !sameArray(actual.mimeTypes, expected.mimeTypes)
    ) {
      addError(errors, "storage", expected.id, "mismatched object", expected, actual);
    }
  }

  for (const grant of snapshot.tableGrants ?? []) {
    if (
      grant.grantee === "authenticated" &&
      contract.protectedTables.includes(grant.table) &&
      WRITE_PRIVILEGES.has(grant.privilege)
    ) {
      addError(
        errors,
        "grants",
        `${grant.table}.${grant.grantee}.${grant.privilege}`,
        "unexpected direct authenticated write grant",
        "absent",
        "present",
      );
    }
  }

  for (const expected of contract.tableSelectGrants) {
    const present = (snapshot.tableGrants ?? []).some(
      (actual) =>
        actual.table === expected.table &&
        actual.grantee === expected.grantee &&
        actual.privilege === expected.privilege,
    );
    if (!present) {
      addError(
        errors,
        "grants",
        `${expected.table}.${expected.grantee}.${expected.privilege}`,
        "missing object",
        expected,
        null,
      );
    }
  }

  const routineGrantByIdentity = new Map(
    (snapshot.routineGrants ?? [])
      .filter(({ grantee }) => grantee === "authenticated")
      .map((item) => [item.identity, item]),
  );
  for (const identity of contract.routineExecuteGrants) {
    const actual = routineGrantByIdentity.get(identity);
    if (!actual?.execute) {
      addError(errors, "grants", `${identity}.authenticated.EXECUTE`, "missing object", true, actual ?? null);
    }
  }

  return { pass: errors.length === 0, errors };
}

export function createPassingCatalogFixture(contract = CATALOG_CONTRACT) {
  return {
    tables: contract.tables.map((item) => ({ ...item })),
    columns: contract.columns.map((item) => ({ ...item })),
    functions: contract.functions.map((item) => ({ ...item })),
    triggers: contract.triggers.map((item) => ({ ...item, events: [...item.events] })),
    policies: contract.policies.map((item) => ({ ...item, roles: [...item.roles] })),
    buckets: contract.buckets.map((item) => ({ ...item, mimeTypes: [...item.mimeTypes] })),
    tableGrants: contract.tableSelectGrants.map((item) => ({ ...item })),
    routineGrants: contract.routineExecuteGrants.map((identity) => ({
      identity,
      grantee: "authenticated",
      execute: true,
    })),
  };
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sanitize(message, databaseUrl) {
  return String(message ?? "").replaceAll(databaseUrl, "[REDACTED_DB_URL]").trim();
}

export function readCatalogSnapshot(databaseUrl) {
  const result = spawnSync(
    "psql",
    [databaseUrl, "-X", "-Atq", "-v", "ON_ERROR_STOP=1"],
    {
      input: CATALOG_QUERY,
      encoding: "utf8",
      env: { ...process.env, PGAPPNAME: "crimson-catalog-contract" },
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw new Error(`psql could not start: ${sanitize(result.error.message, databaseUrl)}`);
  }
  if (result.status !== 0) {
    throw new Error(`catalog query failed: ${sanitize(result.stderr, databaseUrl)}`);
  }

  const jsonLine = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("{") && line.endsWith("}"));
  if (!jsonLine) {
    throw new Error("catalog query returned no JSON snapshot");
  }
  return JSON.parse(jsonLine);
}

export function formatCatalogResult(environment, result) {
  if (result.pass) {
    return [`PASS environment=${environment} contract=cms-catalog`];
  }
  return [
    `FAIL environment=${environment} contract=cms-catalog mismatches=${result.errors.length}`,
    ...result.errors.map(
      ({ section, object, issue, expected, actual }) =>
        `FAIL environment=${environment} section=${section} object=${object} issue=${issue} expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
    ),
  ];
}

export function formatCaseStudyMediaPolicyDiagnostics(environment, snapshot) {
  const policies = (snapshot.policies ?? []).filter((policy) => {
    if (policy.schema !== "storage" || policy.table !== "objects") return false;
    const searchable = [policy.name, policy.usingExpression, policy.checkExpression]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchable.includes("case-study-media") || searchable.includes("case study media");
  });

  if (policies.length === 0) {
    return [`DIAGNOSTIC environment=${environment} case-study-media-policies=[]`];
  }

  return policies.map((policy) =>
    `DIAGNOSTIC environment=${environment} case-study-media-policy=${JSON.stringify(policy)}`,
  );
}

async function main() {
  const environment = readArgument("--environment") ?? process.env.SUPABASE_ENVIRONMENT;
  const databaseUrl = readArgument("--database-url") ?? process.env.SUPABASE_DB_URL;
  if (!environment || !databaseUrl) {
    console.error(
      "Usage: node scripts/verify-supabase-catalog-contract.mjs --environment <name> --database-url <postgres-url>",
    );
    process.exitCode = 2;
    return;
  }

  try {
    const snapshot = readCatalogSnapshot(databaseUrl);
    if (process.argv.includes("--report-case-study-media-policies")) {
      for (const line of formatCaseStudyMediaPolicyDiagnostics(environment, snapshot)) console.log(line);
    }
    const result = evaluateCatalogContract(snapshot);
    for (const line of formatCatalogResult(environment, result)) console.log(line);
    if (!result.pass) process.exitCode = 1;
  } catch (error) {
    console.error(`FAIL environment=${environment} contract=cms-catalog error=${sanitize(error.message, databaseUrl)}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
