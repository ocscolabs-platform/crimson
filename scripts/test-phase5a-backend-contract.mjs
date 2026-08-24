import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationDir = path.join(root, "supabase", "migrations");
const migrationName = "20260824000000_add_phase5a_page_document_workflow_contract.sql";

const readMigration = async () =>
  (await readFile(path.join(migrationDir, migrationName), "utf8")).replaceAll("\r\n", "\n");

test("Batch 3A creates exactly the 26th canonical migration", async () => {
  const files = (await readdir(migrationDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  assert.equal(files.length, 26);
  assert.equal(files.at(-1), migrationName);
});

test("Batch 3A exposes the approved PageDocument RPC contracts", async () => {
  const sql = await readMigration();

  for (const signature of [
    "cms_page_document_save_draft(\n  p_page_key text,\n  p_payload jsonb",
    "cms_page_document_submit_for_review(\n  p_page_key text,\n  p_revision_id uuid",
    "cms_page_document_return_to_draft(\n  p_page_key text,\n  p_revision_id uuid",
    "cms_page_document_publish(\n  p_page_key text,\n  p_revision_id uuid,\n  p_expected_updated_at timestamptz",
    "cms_page_document_restore(\n  p_page_key text,\n  p_source_revision_id uuid",
  ]) {
    assert.match(sql, new RegExp(signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(sql, /array\['home', 'services', 'about', 'contact'\]/);
  assert.match(sql, /Review is immutable/);
  assert.match(sql, /This revision changed\. Reload before publishing\./);
  assert.match(sql, /The current Published pointer is missing; publication aborted/);
  assert.match(sql, /lock-free avoids an unnecessary opposite-order contention window/);
  assert.match(sql, /source_revision_id/);
  assert.match(sql, /related_revision_id/);
});

test("Batch 3A protects the generic transition compatibility boundary", async () => {
  const sql = await readMigration();

  assert.match(sql, /PageDocument workflow requires the dedicated Submit for Review RPC/);
  assert.match(sql, /Review is immutable; use the dedicated Return to Draft RPC/);
  assert.match(sql, /PageDocument publication requires the dedicated Publish RPC/);
  assert.match(sql, /PageDocument restore requires the dedicated Restore RPC/);
  assert.match(sql, /cms_write_page_workflow_audit/);
});

test("Batch 3A backfill is content-verified and leaves editorial revisions alone", async () => {
  const sql = await readMigration();
  const backfill = sql.slice(
    sql.indexOf("-- Fail-closed pointer backfill."),
    sql.indexOf("create or replace function public.cms_page_document_save_draft")
  );

  assert.match(backfill, /candidate_count <> 1/);
  assert.match(backfill, /candidate\.payload is distinct from expected_payload/);
  assert.match(backfill, /candidate\.published_at is distinct from page_row\.published_at/);
  assert.match(backfill, /set published_revision_id = candidate\.id/);
  assert.doesNotMatch(backfill, /update public\.cms_revisions/);
});

test("Batch 3A audit and pointer integrity are database-enforced", async () => {
  const sql = await readMigration();

  assert.match(sql, /create table if not exists public\.cms_workflow_audit_log/);
  assert.match(sql, /create constraint trigger pages_published_revision_integrity/);
  assert.match(sql, /create constraint trigger cms_revisions_published_revision_integrity/);
  assert.match(sql, /on delete restrict/);
});
