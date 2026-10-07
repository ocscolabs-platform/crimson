import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const [
  migration,
  action,
  controls,
  dashboard,
  adminLoader,
  publicLoader,
  workPage,
  editor,
  directWriteLock,
] = await Promise.all([
  source("supabase/migrations/20261007020000_add_manual_work_ordering.sql"),
  source("src/app/admin/work-actions.ts"),
  source("src/app/admin/WorkOrderControls.tsx"),
  source("src/app/admin/page.tsx"),
  source("src/lib/admin-content.ts"),
  source("src/lib/cms-content.ts"),
  source("src/app/work/page.tsx"),
  source("src/app/admin/case-studies/[slug]/page.tsx"),
  source("supabase/migrations/20260821030000_lock_cms_direct_writes.sql"),
]);

function moveAdjacent(ids, target, direction) {
  const result = [...ids];
  const current = result.indexOf(target);
  const adjacent = direction === "up" ? current - 1 : current + 1;
  if (current < 0 || adjacent < 0 || adjacent >= result.length) {
    return result;
  }
  [result[current], result[adjacent]] = [result[adjacent], result[current]];
  return result;
}

test("Owner UI submits only target identity and direction with safe boundaries", () => {
  assert.match(dashboard, /membership\.role === "owner"/);
  assert.match(dashboard, /name="target_id" value=\{caseStudy\.id\}/);
  assert.match(controls, /name="direction"[\s\S]*?value="up"/);
  assert.match(controls, /name="direction"[\s\S]*?value="down"/);
  assert.match(dashboard, /canMoveUp=\{index > 0\}/);
  assert.match(dashboard, /canMoveDown=\{index < content\.caseStudies\.length - 1\}/);
  assert.match(controls, /disabled=\{pending \|\| !canMoveUp\}/);
  assert.match(controls, /disabled=\{pending \|\| !canMoveDown\}/);
  assert.equal(moveAdjacent(["a", "b", "c"], "a", "up").join(), "a,b,c");
  assert.equal(moveAdjacent(["a", "b", "c"], "c", "down").join(), "a,b,c");
});

test("adjacent moves preserve every unaffected Work record", () => {
  assert.deepEqual(moveAdjacent(["a", "b", "c", "d"], "c", "up"), ["a", "c", "b", "d"]);
  assert.deepEqual(moveAdjacent(["a", "b", "c", "d"], "b", "down"), ["a", "c", "b", "d"]);
  assert.match(action, /const adjacentIndex = direction === "up" \? targetIndex - 1 : targetIndex \+ 1/);
  assert.match(action, /\[orderedIds\[targetIndex\], orderedIds\[adjacentIndex\]\] = \[orderedIds\[adjacentIndex\], orderedIds\[targetIndex\]\]/);
});

test("server action derives the complete authoritative set and invokes one RPC", () => {
  assert.match(action, /membership\.role !== "owner"/);
  assert.match(action, /\.from\("case_studies"\)[\s\S]*?\.select\("id, sort_order, created_at, slug"\)/);
  assert.doesNotMatch(action, /\.eq\("status"/);
  assert.match(action, /\.order\("sort_order"[\s\S]*?\.order\("created_at"[\s\S]*?\.order\("slug"/);
  assert.match(action, /supabase\.rpc\("cms_reorder_case_studies", \{[\s\S]*?p_ordered_case_study_ids: orderedIds/);
  assert.doesNotMatch(action, /formData\.get\("(?:ordered_ids|sort_order)/);
});

test("reorder RPC is authenticated Owner-only and receives no role broadening", () => {
  assert.match(migration, /create or replace function public\.cms_reorder_case_studies\([\s\S]*?p_ordered_case_study_ids uuid\[\]/);
  assert.match(migration, /security definer\s+set search_path = public/);
  assert.match(migration, /auth\.uid\(\) is null[\s\S]*?not public\.cms_has_role\(array\['owner'\]::text\[\]\)/);
  assert.doesNotMatch(migration, /array\['owner', 'editor'\]/);
  assert.match(migration, /revoke all on function public\.cms_reorder_case_studies\(uuid\[\]\) from public/);
  assert.match(migration, /grant execute on function public\.cms_reorder_case_studies\(uuid\[\]\) to authenticated/);
  assert.match(directWriteLock, /revoke insert, update, delete on public\.case_studies from authenticated/);
  assert.doesNotMatch(migration, /grant (?:insert|update|delete|all) on public\.case_studies/);
});

test("RPC rejects malformed complete-order lists and serializes the mutation", () => {
  assert.match(migration, /array_position\(p_ordered_case_study_ids, null\)/);
  assert.match(migration, /supplied_count <> distinct_count[\s\S]*?duplicate IDs/);
  assert.match(migration, /left join public\.case_studies[\s\S]*?unknown ID/);
  assert.match(migration, /where not \(case_study\.id = any\(p_ordered_case_study_ids\)\)[\s\S]*?missing a current Work record/);
  assert.match(migration, /supplied_count <> \(select count\(\*\) from public\.case_studies\)/);
  assert.match(migration, /lock table public\.case_studies in share row exclusive mode/);
});

test("RPC writes a dense atomic order and changes no Case Study content field", () => {
  const baseUpdate = migration.match(/with desired as \([\s\S]*?update public\.case_studies as case_study[\s\S]*?;/)?.[0] ?? "";
  assert.match(baseUpdate, /\(ordered\.ordinality - 1\)::integer as sort_order/);
  assert.match(baseUpdate, /set sort_order = desired\.sort_order/);
  assert.match(baseUpdate, /case_study\.sort_order is distinct from desired\.sort_order/);
  assert.doesNotMatch(baseUpdate, /set[\s\S]*?(?:status|published_at|project_name|is_featured|external_url)\s*=/);
  assert.doesNotMatch(migration, /begin;|commit;/i);
});

test("Published reorder exception is transaction-local and sort_order-only", () => {
  assert.match(migration, /set_config\('app\.cms_work_reorder', 'on', true\)/);
  assert.match(migration, /set_config\('app\.cms_work_reorder', 'off', true\)/);
  assert.match(migration, /work_reorder := false;[\s\S]*?if tg_op = 'UPDATE'/);
  assert.match(migration, /old\.sort_order is distinct from new\.sort_order/);
  assert.match(migration, /old\.project_name is not distinct from new\.project_name/);
  assert.match(migration, /old\.status is not distinct from new\.status/);
  assert.match(migration, /old\.published_at is not distinct from new\.published_at/);
  assert.match(migration, /and not revision_publish[\s\S]*?and not work_reorder/);
});

test("only active private revision payloads receive the new sort order", () => {
  const revisionUpdate = migration.slice(migration.indexOf("update public.cms_revisions as revision"));
  assert.match(revisionUpdate, /jsonb_set\([\s\S]*?'\{sort_order\}'[\s\S]*?to_jsonb\(desired\.sort_order\)/);
  assert.match(revisionUpdate, /revision\.status in \('draft', 'review'\)/);
  assert.doesNotMatch(revisionUpdate, /revision\.status in \('published', 'archived'\)/);
  assert.doesNotMatch(revisionUpdate, /delete from public\.cms_revisions/);
});

test("admin and public reads share deterministic manual ordering", () => {
  for (const loader of [adminLoader, publicLoader]) {
    assert.match(loader, /\.order\("sort_order", \{ ascending: true \}\)[\s\S]*?\.order\("created_at", \{ ascending: true \}\)[\s\S]*?\.order\("slug", \{ ascending: true \}\)/);
  }
  const publicRead = publicLoader.slice(
    publicLoader.indexOf("export async function getPublishedWorkProjects"),
    publicLoader.indexOf("export async function getPublishedWorkProject"),
  );
  assert.doesNotMatch(publicRead, /\.order\("is_featured"/);
  assert.match(workPage, /const featuredProject = workProjects\[0\]/);
  assert.match(workPage, /const supportingProjects = workProjects\.slice\(1\)/);
  assert.match(editor, /<dt>Manual order<\/dt><dd>Position \{review\.sort_order \+ 1\}<\/dd>/);
  assert.doesNotMatch(editor, /<dt>Featured order<\/dt>/);
});

test("existing CTA behavior and empty Work rendering remain intact", () => {
  assert.match(workPage, /project\.status === "Case study" \? "Visit Website" : "Open Prototype"/);
  assert.match(workPage, /href=\{project\.href\} target="_blank" rel="noreferrer"/);
  assert.match(workPage, /\{featuredProject \? <article className="work-featured">/);
  assert.doesNotMatch(workPage, /No work|Coming soon|placeholder project/i);
});

console.log("Work CMS Update v1 Task 2: manual ordering contract assertions passed");
