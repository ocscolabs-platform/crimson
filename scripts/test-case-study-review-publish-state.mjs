import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const [
  repair,
  editor,
  publisher,
  publicationGuard,
  foundation,
  directWriteLock,
  task1,
] = await Promise.all([
  source("supabase/migrations/20261007010000_align_case_study_review_state.sql"),
  source("src/app/admin/case-studies/[slug]/page.tsx"),
  source("supabase/migrations/20260831110000_add_design_settings_storage_contract.sql"),
  source("supabase/migrations/20260821050000_allow_revision_case_study_publish.sql"),
  source("supabase/migrations/20260820000000_create_cms_foundation.sql"),
  source("supabase/migrations/20260821030000_lock_cms_direct_writes.sql"),
  source("supabase/migrations/20261007000000_add_upcoming_work_unpublish.sql"),
]);

function alignPrivateBase(baseStatus, revisionStatus) {
  return ["draft", "review"].includes(baseStatus) ? revisionStatus : baseStatus;
}

test("Case Study-specific revision save aligns only non-public Draft and Review bases", () => {
  assert.match(repair, /create or replace function public\.cms_save_case_study_revision\(/);
  assert.match(repair, /security definer\s+set search_path = public/);
  assert.match(repair, /auth\.uid\(\) is null or not public\.cms_has_role\(array\['owner', 'editor'\]::text\[\]\)/);
  assert.match(repair, /p_status not in \('draft', 'review'\)/);
  assert.match(repair, /from public\.case_studies[\s\S]*?where id = p_case_study_id[\s\S]*?for update/);
  assert.match(repair, /public\.cms_save_revision\([\s\S]*?'case_study'[\s\S]*?p_status[\s\S]*?p_payload/);
  assert.match(repair, /base_status in \('draft', 'review'\) and base_status <> p_status/);
  assert.match(repair, /update public\.case_studies\s+set status = p_status[\s\S]*?and status = base_status/);
  assert.doesNotMatch(repair, /set[\s\S]*?published_at\s*=/);

  assert.equal(alignPrivateBase("draft", "review"), "review");
  assert.equal(alignPrivateBase("review", "draft"), "draft");
  assert.equal(alignPrivateBase("published", "review"), "published");
  assert.equal(alignPrivateBase("archived", "review"), "archived");
});

test("all normal Case Study revision writes use the aligned save boundary", () => {
  assert.equal((editor.match(/cms_save_case_study_revision/g) ?? []).length, 5);
  assert.doesNotMatch(editor, /supabase\.rpc\("cms_save_revision"/);
  assert.match(editor, /p_case_study_id: current\.id/);
  assert.match(editor, /p_status: requestedStatus/);
  assert.match(editor, /membership\.role !== "owner"[\s\S]*?Only the owner can publish a case-study revision/);
  assert.match(editor, /supabase\.rpc\("cms_publish_revision"/);
});

test("Owner publication remains gated by a legitimate Review state", () => {
  assert.match(publisher, /if not public\.cms_has_role\(array\['owner'\]::text\[\]\)/);
  assert.match(publisher, /where id = p_revision_id and status = 'review'/);
  assert.match(publisher, /revision\.entity_type = 'case_study'[\s\S]*?status = 'published'/);
  assert.match(publicationGuard, /new\.status = 'published' and old\.status not in \('review', 'published'\)/);
  assert.match(publicationGuard, /raise exception 'Move the case study to review before publishing it'/);
  assert.doesNotMatch(repair, /cms_prepare_case_study_publication|drop trigger|disable trigger/);
});

test("anonymous isolation and revoked direct writes remain unchanged", () => {
  assert.match(foundation, /create policy "published case studies are public"[\s\S]*?status = 'published' and published_at is not null and published_at <= now\(\)/);
  assert.match(directWriteLock, /revoke insert, update, delete on public\.case_studies from authenticated/);
  assert.doesNotMatch(repair, /grant (?:insert|update|delete|all) on public\.case_studies/);
  assert.match(repair, /revoke all on function public\.cms_save_case_study_revision\(uuid, text, jsonb\) from public/);
  assert.match(repair, /grant execute on function public\.cms_save_case_study_revision\(uuid, text, jsonb\) to authenticated/);
});

test("republish and Task 1 unpublish remain compatible", () => {
  assert.equal(alignPrivateBase("published", "review"), "published");
  assert.match(publicationGuard, /revision_publish := public\.cms_has_role\(array\['owner'\]/);
  assert.match(task1, /public\.cms_save_revision\([\s\S]*?'case_study'[\s\S]*?'review'/);
  assert.match(task1, /update public\.case_studies\s+set status = 'review',[\s\S]*?published_at = null/);
  assert.match(publisher, /revision\.entity_type = 'case_study'[\s\S]*?status = 'published'/);
  assert.doesNotMatch(repair, /cms_unpublish_upcoming_case_study/);
});

console.log("Case Study Review/Publish state repair: focused assertions passed");
