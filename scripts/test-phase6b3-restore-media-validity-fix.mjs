import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const baselineName = "20260829000000_add_phase6b3_restore_media_association.sql";
const fixName = "20260830000000_fix_phase6b3_restore_media_validity.sql";
const read = (file) => readFile(path.join(root, file), "utf8");

test("Migration 32 is the single additive Restore-validity correction", async () => {
  const files = (await readdir(path.join(root, "supabase", "migrations")))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  assert.equal(files.length, 33);
  assert.equal(files.at(-3), baselineName);
  assert.equal(files.at(-2), fixName);
  assert.equal(files.at(-1), "20260831000000_reconcile_production_legacy_baseline.sql");
});

test("Regression: migration 31 passed the body envelope instead of body.doc", async () => {
  const baseline = await read(`supabase/migrations/${baselineName}`);
  const fix = await read(`supabase/migrations/${fixName}`);

  assert.match(baseline, /insights_body_media_ids\(source_revision\.body\)/);
  assert.match(baseline, /insights_rewrite_restore_media_ids\(source_revision\.body, media_mapping\)/);
  assert.match(fix, /insights_body_media_ids\(source_revision\.body->'doc'\)/);
  assert.match(
    fix,
    /jsonb_set\(\s*source_revision\.body,\s*'\{doc\}',\s*public\.insights_rewrite_restore_media_ids\(source_revision\.body->'doc', media_mapping\),\s*true\s*\)/,
  );
  assert.doesNotMatch(fix, /insights_body_media_ids\(source_revision\.body\)(?!->)/);
  assert.doesNotMatch(fix, /insights_rewrite_restore_media_ids\(source_revision\.body, media_mapping\)/);
});

test("Regression fixture rewrites opaque inline IDs while preserving the body envelope", () => {
  const sourceInlineId = "11111111-1111-4111-8111-111111111111";
  const restoredInlineId = "22222222-2222-4222-8222-222222222222";
  const sourceBody = {
    schema: "insights-body",
    version: 2,
    doc: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Clean Restore fixture" }] },
        { type: "image", attrs: { mediaId: sourceInlineId, alt: "Meaningful inline alt", caption: "Preserved caption" } },
      ],
    },
  };

  const rewriteNode = (node, mapping) => {
    if (!node || typeof node !== "object") return node;
    const rewritten = { ...node };
    if (rewritten.type === "image") {
      delete rewritten.attrs?.src;
      rewritten.attrs = { ...rewritten.attrs, mediaId: mapping[rewritten.attrs?.mediaId] ?? rewritten.attrs?.mediaId };
    }
    if (Array.isArray(rewritten.content)) rewritten.content = rewritten.content.map((child) => rewriteNode(child, mapping));
    return rewritten;
  };

  const restoredBody = {
    ...sourceBody,
    doc: rewriteNode(sourceBody.doc, { [sourceInlineId]: restoredInlineId }),
  };
  const restoredImage = restoredBody.doc.content[1];

  assert.equal(restoredBody.schema, sourceBody.schema);
  assert.equal(restoredBody.version, sourceBody.version);
  assert.equal(restoredImage.attrs.mediaId, restoredInlineId);
  assert.equal(restoredImage.attrs.alt, "Meaningful inline alt");
  assert.equal(restoredImage.attrs.caption, "Preserved caption");
  assert.equal("src" in restoredImage.attrs, false);
  assert.equal(sourceBody.doc.content[1].attrs.mediaId, sourceInlineId);
});

test("Migration 32 keeps the canonical validator and historical media immutable", async () => {
  const sql = await read(`supabase/migrations/${fixName}`);

  assert.match(sql, /begin;/);
  assert.match(sql, /create or replace function public\.insights_restore_revision/);
  assert.match(sql, /asset\.article_id = article\.id/);
  assert.match(sql, /source_media\.revision_id <> source_revision\.id/);
  assert.match(sql, /source_media\.status <> 'ready'/);
  assert.match(sql, /restored_media_id := gen_random_uuid\(\)/);
  assert.match(sql, /insert into public\.insights_revision_media \(revision_id, media_id, role\)/);
  assert.match(sql, /if not public\.insights_revision_is_publishable\(restored_id\) then/);
  assert.match(sql, /perform public\.insights_write_audit/);
  assert.doesNotMatch(sql, /public_storage_path, public_artifact_status/);
  assert.doesNotMatch(sql, /update public\.insights_media_assets/);
  assert.doesNotMatch(sql, /delete from public\.insights_article_revisions/);
  assert.match(sql, /revoke all on function public\.insights_restore_revision\(uuid, uuid\) from public/);
  assert.match(sql, /grant execute on function public\.insights_restore_revision\(uuid, uuid\) to authenticated/);
});
