import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationName = "20260829000000_add_phase6b3_restore_media_association.sql";
const read = (file) => readFile(path.join(root, file), "utf8");

test("Restore media hotfix is the single additive migration after the staging baseline", async () => {
  const files = (await readdir(path.join(root, "supabase", "migrations")))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  assert.equal(files.length, 31);
  assert.equal(files.at(-2), "20260828000000_add_phase6b3_insights_media_workflow.sql");
  assert.equal(files.at(-1), migrationName);
});

test("Restore clones canonical media metadata with fresh revision-owned IDs", async () => {
  const sql = await read(`supabase/migrations/${migrationName}`);

  for (const contract of [
    "drop constraint if exists insights_media_assets_storage_path_key",
    "create index if not exists insights_media_assets_storage_path_idx",
    "create or replace function public.insights_rewrite_restore_media_ids",
    "restored_media_id := gen_random_uuid()",
    "media_mapping := media_mapping || jsonb_build_object",
    "asset.article_id = article.id",
    "source_media.revision_id <> source_revision.id",
    "source_media.status <> 'ready'",
    "article.id, restored_id, auth.uid(), source_media.kind, source_media.storage_path",
    "relation.revision_id = source_revision.id",
    "relation.media_id = source_media.id",
    "asset.revision_id, asset.kind, asset.storage_path",
  ]) assert.ok(sql.includes(contract), `Missing restore contract: ${contract}`);

  assert.match(sql, /source_media\.storage_path/);
  assert.match(sql, /created_by, kind, storage_path,[\s\S]*source_mime_type/);
  assert.doesNotMatch(sql, /public_storage_path, public_artifact_status/);
  assert.match(sql, /source_media\.alt_text,\s*source_media\.caption/);
});

test("Restore rewrites opaque body media IDs and strips resolved URLs", async () => {
  const sql = await read(`supabase/migrations/${migrationName}`);

  assert.match(sql, /p_node := p_node #- '\{attrs,src\}'/);
  assert.match(sql, /jsonb_set\(p_node, '\{attrs,mediaId\}', to_jsonb\(p_mapping->>media_key\), true\)/);
  assert.match(sql, /public\.insights_body_media_ids\(source_revision\.body\)/);
  assert.match(sql, /not \(media_mapping \? referenced\.media_id::text\)/);
  assert.match(sql, /restored_body := public\.insights_rewrite_restore_media_ids/);
  assert.match(sql, /set body = restored_body, cover_media_id = restored_cover_media_id/);
});

test("Restore is transactional, validates publishability, preserves history, and cannot be called publicly", async () => {
  const sql = await read(`supabase/migrations/${migrationName}`);

  assert.match(sql, /begin;/);
  assert.match(sql, /select \* into source_revision[\s\S]*for update/);
  assert.match(sql, /insert into public\.insights_article_revisions/);
  assert.match(sql, /if not public\.insights_revision_is_publishable\(restored_id\) then/);
  assert.match(sql, /raise exception 'Restored media is not valid for the new Draft revision'/);
  assert.match(sql, /update public\.insights_articles/);
  assert.match(sql, /perform public\.insights_write_audit/);
  assert.doesNotMatch(sql, /delete from public\.insights_article_revisions/);
  assert.match(sql, /revoke all on function public\.insights_rewrite_restore_media_ids\(jsonb, jsonb\) from public/);
  assert.match(sql, /revoke all on function public\.insights_restore_revision\(uuid, uuid\) from public/);
  assert.match(sql, /grant execute on function public\.insights_restore_revision\(uuid, uuid\) to authenticated/);
});

test("Restore assigns Cover and all source roles to the cloned media", async () => {
  const sql = await read(`supabase/migrations/${migrationName}`);

  assert.match(sql, /if source_revision\.cover_media_id = source_media\.id then/);
  assert.match(sql, /restored_cover_media_id := restored_media_id/);
  assert.match(sql, /if source_revision\.cover_media_id is not null and restored_cover_media_id is null then/);
  assert.match(sql, /insert into public\.insights_revision_media \(revision_id, media_id, role\)/);
  assert.match(sql, /select restored_id, restored_media_id, relation\.role/);
  assert.match(sql, /set body = restored_body, cover_media_id = restored_cover_media_id/);
});
