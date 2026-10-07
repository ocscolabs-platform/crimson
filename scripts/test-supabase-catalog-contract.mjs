import assert from "node:assert/strict";
import test from "node:test";

import {
  CATALOG_QUERY,
  createPassingCatalogFixture,
  evaluateCatalogContract,
} from "./verify-supabase-catalog-contract.mjs";

function cloneFixture() {
  return structuredClone(createPassingCatalogFixture());
}

test("passing fixture satisfies the shared catalog contract", () => {
  assert.deepEqual(evaluateCatalogContract(cloneFixture()), { pass: true, errors: [] });
});

test("detects a missing required trigger", () => {
  const fixture = cloneFixture();
  fixture.triggers = fixture.triggers.filter(({ name }) => name !== "case_studies_prepare_publication");
  const result = evaluateCatalogContract(fixture);
  assert.equal(result.pass, false);
  assert.ok(result.errors.some(({ section, object, issue }) =>
    section === "triggers" && object === "case_studies_prepare_publication" && issue === "missing object"));
});

test("detects a missing required function", () => {
  const fixture = cloneFixture();
  fixture.functions = fixture.functions.filter(({ identity }) => identity !== "cms_publish_revision(uuid)");
  const result = evaluateCatalogContract(fixture);
  assert.equal(result.pass, false);
  assert.ok(result.errors.some(({ section, object, issue }) =>
    section === "functions" && object === "cms_publish_revision(uuid)" && issue === "missing object"));
});

test("detects a trigger attached to the wrong function", () => {
  const fixture = cloneFixture();
  const trigger = fixture.triggers.find(({ name }) => name === "case_studies_audit_changes");
  trigger.function = "public.cms_set_updated_at()";
  const result = evaluateCatalogContract(fixture);
  assert.equal(result.pass, false);
  assert.ok(result.errors.some(({ section, object, issue }) =>
    section === "triggers" && object === "case_studies_audit_changes" && issue === "mismatched object"));
});

test("detects a missing required policy", () => {
  const fixture = cloneFixture();
  fixture.policies = fixture.policies.filter(({ name }) => name !== "cms members can read revisions");
  const result = evaluateCatalogContract(fixture);
  assert.equal(result.pass, false);
  assert.ok(result.errors.some(({ section, object, issue }) =>
    section === "policies" && object.endsWith("cms members can read revisions") && issue === "missing object"));
});

test("detects an unexpected direct authenticated write grant", () => {
  const fixture = cloneFixture();
  fixture.tableGrants.push({ table: "case_studies", grantee: "authenticated", privilege: "UPDATE" });
  const result = evaluateCatalogContract(fixture);
  assert.equal(result.pass, false);
  assert.ok(result.errors.some(({ section, object, issue }) =>
    section === "grants" && object === "case_studies.authenticated.UPDATE" && issue.includes("unexpected")));
});

test("catalog SQL is explicitly read-only and catalog-scoped", () => {
  assert.match(CATALOG_QUERY, /set transaction read only;/i);
  assert.match(CATALOG_QUERY, /pg_catalog\.pg_trigger/);
  assert.match(CATALOG_QUERY, /pg_catalog\.pg_policies/);
  assert.doesNotMatch(CATALOG_QUERY, /^\s*(?:insert|update|delete|alter|create|drop|truncate)\b/im);
  assert.doesNotMatch(CATALOG_QUERY, /public\.case_studies\s+(?:where|join)/i);
});
