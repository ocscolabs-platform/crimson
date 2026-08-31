import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const migration = await read("supabase/migrations/20260831100000_add_case_study_create_draft_rpc.sql");
const editor = await read("src/app/admin/case-studies/[slug]/page.tsx");
const foundation = await read("supabase/migrations/20260820000000_create_cms_foundation.sql");
const presentation = await read("supabase/migrations/20260820020000_add_work_presentation_fields.sql");
const media = await read("supabase/migrations/20260820080000_add_staging_case_study_media_contract.sql");

function slugifyCaseStudyName(name) {
  let slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "case-study";
}

function nextSlug(name, existing) {
  const base = slugifyCaseStudyName(name);
  let suffix = 1;
  let candidate = base;
  while (existing.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

test("RPC is narrow, security-definer, and Owner/Editor-only", () => {
  assert.match(migration, /create or replace function public\.cms_create_case_study\(p_project_name text\)/);
  assert.match(migration, /returns table \(id uuid, slug text\)/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = public/);
  assert.match(migration, /auth\.uid\(\) is null or not public\.cms_has_role\(array\['owner', 'editor'\]/);
  assert.doesNotMatch(migration, /array\['reviewer'/);
  assert.doesNotMatch(migration, /grant (?:insert|all) on public\.case_studies/);
  assert.match(migration, /grant execute on function public\.cms_create_case_study\(text\) to authenticated/);
});

test("name validation, slug normalization, and deterministic collision suffixes are covered", () => {
  assert.match(migration, /btrim\(coalesce\(p_project_name, ''\)\)/);
  assert.match(migration, /char_length\(clean_name\) < 1 or char_length\(clean_name\) > 180/);
  assert.match(migration, /regexp_replace\(base_slug, '\[\^a-z0-9\]\+'/);
  assert.match(migration, /pg_advisory_xact_lock\(hashtext\(base_slug\)\)/);
  assert.equal(slugifyCaseStudyName("  Example Project / 2026! "), "example-project-2026");
  assert.equal(nextSlug("Example Project", new Set()), "example-project");
  assert.equal(nextSlug("Example Project", new Set(["example-project"])), "example-project-2");
  assert.equal(nextSlug("Example Project", new Set(["example-project", "example-project-2"])), "example-project-3");
  assert.equal(nextSlug("!!!", new Set()), "case-study");
});

test("created row uses existing safe defaults and audit trigger", () => {
  assert.match(migration, /insert into public\.case_studies \(project_name, slug\)/);
  assert.doesNotMatch(migration, /p_status|p_published_at|p_client_visibility|p_is_featured|p_media_status/);
  assert.match(foundation, /status text not null default 'draft'/);
  assert.match(foundation, /client_visibility text not null default 'hidden'/);
  assert.match(foundation, /deliverables jsonb not null default '\[\]'::jsonb/);
  assert.match(foundation, /outcomes jsonb not null default '\[\]'::jsonb/);
  assert.match(foundation, /supporting_media jsonb not null default '\[\]'::jsonb/);
  assert.match(presentation, /project_type text not null default 'case-study'/);
  assert.match(presentation, /is_featured boolean not null default false/);
  assert.match(media, /media_status text not null default 'pending'/);
  assert.match(migration, /return query select created_case_study_id, candidate_slug/);
  assert.match(editor, /cms_save_revision/);
  assert.match(editor, /cms_publish_revision/);
});

test("future editor/media/relationship boundaries remain unchanged", () => {
  assert.match(editor, /Only the owner can upload case-study media/);
  assert.match(editor, /saveCaseStudyRelationships/);
  assert.match(editor, /Only the owner can publish a case-study revision/);
  assert.doesNotMatch(migration, /case_study_services/);
  assert.doesNotMatch(migration, /cms_publish_revision/);
});

console.log("Batch 3A case-study create RPC contract: focused assertions passed");
