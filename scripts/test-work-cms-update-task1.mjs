import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const [
  workPage,
  publicLoader,
  adminPage,
  adminEditor,
  adminLoader,
  migration,
  foundation,
  readAccess,
  directWriteLock,
  auditMigration,
  publisherMigration,
  sitemap,
  mediaRoute,
  globalStyles,
] = await Promise.all([
  source("src/app/work/page.tsx"),
  source("src/lib/cms-content.ts"),
  source("src/app/admin/page.tsx"),
  source("src/app/admin/case-studies/[slug]/page.tsx"),
  source("src/lib/admin-case-studies.ts"),
  source("supabase/migrations/20261007000000_add_upcoming_work_unpublish.sql"),
  source("supabase/migrations/20260820000000_create_cms_foundation.sql"),
  source("supabase/migrations/20260821040000_restore_cms_read_access.sql"),
  source("supabase/migrations/20260821030000_lock_cms_direct_writes.sql"),
  source("supabase/migrations/20260820070000_add_staging_case_study_audit.sql"),
  source("supabase/migrations/20260831110000_add_design_settings_storage_contract.sql"),
  source("src/app/sitemap.ts"),
  source("src/app/api/work-media/[...path]/route.ts"),
  source("src/app/globals.css"),
]);

test("Case Study external CTAs use the approved destination and exact Visit Website label", () => {
  assert.match(workPage, /featuredProject\.status === "Case study" \? "Visit Website" : "Open Prototype"/);
  assert.match(workPage, /href=\{featuredProject\.href\} target="_blank" rel="noreferrer"/);
  assert.match(workPage, /project\.status === "Case study" \? "Visit Website" : "Open Prototype"/);
  assert.match(workPage, /href=\{project\.href\} target="_blank" rel="noreferrer"/);
  assert.match(publicLoader, /href: isApproved \? caseStudy\.external_url \|\| undefined : undefined/);

  const featuredStart = workPage.indexOf('<article className="work-featured">');
  const featuredEnd = workPage.indexOf('<div className="work-library-heading">');
  const featuredCard = workPage.slice(featuredStart, featuredEnd);
  assert.ok(featuredStart >= 0 && featuredEnd > featuredStart);
  assert.match(featuredCard, /featuredProject\.status !== "Upcoming" && featuredProject\.href/);
});

test("Prototype external CTA copy and existing external-link behavior use the latest canonical label", () => {
  assert.match(workPage, /"Open Prototype"/);
  assert.doesNotMatch(workPage, /Open prototype/);
  assert.match(workPage, /href=\{project\.href\} target="_blank" rel="noreferrer"/);
});

test("featured status and actions are type-aware without weakening privacy gating", () => {
  const featuredStart = workPage.indexOf('<article className="work-featured">');
  const featuredEnd = workPage.indexOf('<div className="work-library-heading">');
  const featuredCard = workPage.slice(featuredStart, featuredEnd);

  assert.match(featuredCard, /featuredProject\.status === "Upcoming" \? \([\s\S]*?<strong>In preparation<\/strong>/);
  assert.match(featuredCard, /featuredProject\.status !== "Upcoming" && featuredProject\.href/);
  assert.match(featuredCard, /featuredProject\.clientVisibility === "hidden"/);
  assert.match(featuredCard, /href=\{`\/work\/\$\{featuredProject\.slug\}`\}>View project/);
  assert.match(featuredCard, /href=\{featuredProject\.href\} target="_blank" rel="noreferrer"/);
  assert.match(workPage, /project\.href && project\.status !== "Upcoming"/);
});

test("featured real media reuses the established twelve-pixel Work radius and clips cleanly", () => {
  assert.match(globalStyles, /\.work-featured > \.work-card-media-preview \{ border-radius: 12px; \}/);
  assert.match(globalStyles, /\.work-card-media-preview \{[^}]*overflow: hidden;/);
  assert.match(globalStyles, /\.media-placeholder \{[^}]*border-radius: 12px;[^}]*overflow: hidden;/);
});

test("configured public Work loading is explicit and fails closed", () => {
  const loaderStart = publicLoader.indexOf("export async function getPublishedWorkProjects");
  const loaderEnd = publicLoader.indexOf("export async function getPublishedWorkProject(slug", loaderStart);
  const loaderBody = publicLoader.slice(loaderStart, loaderEnd);

  assert.match(loaderBody, /if \(!client\) \{\s*return localWorkProjects;\s*\}/);
  assert.match(loaderBody, /\.eq\("status", "published"\)/);
  assert.match(loaderBody, /\.not\("published_at", "is", null\)/);
  assert.match(loaderBody, /\.lte\("published_at", new Date\(\)\.toISOString\(\)\)/);
  assert.match(loaderBody, /if \(error\) \{[\s\S]*?return \[\];\s*\}/);
  assert.match(loaderBody, /if \(!data\?\.length\) \{\s*return \[\];\s*\}/);
  assert.equal((loaderBody.match(/return localWorkProjects;/g) ?? []).length, 1);
});

test("an empty public Work collection renders without fabricated cards or a crash", () => {
  assert.match(workPage, /const supportingProjects = workProjects\.slice\(1\)/);
  assert.match(workPage, /\{featuredProject \? <article className="work-featured">/);
  assert.doesNotMatch(workPage, /No work|Coming soon|placeholder project/i);
});

test("Upcoming unpublish RPC is narrow, Owner-only, and state guarded", () => {
  assert.match(migration, /create or replace function public\.cms_unpublish_upcoming_case_study\(p_case_study_id uuid\)/);
  assert.match(migration, /security definer\s+set search_path = public/);
  assert.match(migration, /auth\.uid\(\) is null or not public\.cms_has_role\(array\['owner'\]::text\[\]\)/);
  assert.doesNotMatch(migration, /array\['owner', 'editor'\]/);
  assert.match(migration, /from public\.case_studies[\s\S]*?where id = p_case_study_id[\s\S]*?for update/);
  assert.match(migration, /target\.project_type <> 'upcoming'/);
  assert.match(migration, /target\.status <> 'published'[\s\S]*?target\.published_at is null[\s\S]*?target\.published_at > now\(\)/);
  assert.match(migration, /revoke all on function public\.cms_unpublish_upcoming_case_study\(uuid\) from public/);
  assert.match(migration, /grant execute on function public\.cms_unpublish_upcoming_case_study\(uuid\) to authenticated/);
});

test("unpublish retains a Review revision, removes publication authority, and preserves unrelated content", () => {
  assert.match(migration, /public\.cms_save_revision\([\s\S]*?'case_study'[\s\S]*?'review'[\s\S]*?'\{\}'::jsonb/);
  const updateStatement = migration.match(/update public\.case_studies\s+set[\s\S]*?;/)?.[0] ?? "";
  assert.match(updateStatement, /status = 'review'/);
  assert.match(updateStatement, /published_at = null/);
  assert.doesNotMatch(updateStatement, /project_name|project_type|client_visibility|external_url|summary|media_status|sort_order|is_featured/);
  assert.match(auditMigration, /create trigger case_studies_audit_changes[\s\S]*?after insert or update or delete/);
  assert.match(publisherMigration, /revision\.entity_type = 'case_study'[\s\S]*?status = 'published'/);
  assert.doesNotMatch(migration, /case_study_services|storage\.objects|delete from public\.case_studies/);
});

test("RLS and revoked direct writes remain the public and authenticated boundaries", () => {
  assert.match(foundation, /create policy "published case studies are public"[\s\S]*?status = 'published' and published_at is not null and published_at <= now\(\)/);
  assert.match(foundation, /create policy "published case study relationships are public"[\s\S]*?case_studies\.status = 'published'/);
  assert.match(readAccess, /create policy "cms members can read all case studies"[\s\S]*?array\['owner', 'editor', 'reviewer'\]/);
  assert.match(directWriteLock, /revoke insert, update, delete on public\.case_studies from authenticated/);
  assert.doesNotMatch(migration, /grant (?:update|insert|delete|all) on public\.case_studies/);
  assert.match(sitemap, /getPublishedWorkProjects\(\{ includeRelatedCapabilities: false \}\)/);
  assert.match(sitemap, /export const dynamic = "force-dynamic"/);
  assert.match(mediaRoute, /client\.storage\.from\(CASE_STUDY_MEDIA_BUCKET\)\.download\(objectPath\)/);
});

test("Work Library exposes type and status while publication actions stay Owner-only", () => {
  assert.match(adminPage, /caseStudy\.project_type\} · \{caseStudy\.status/);
  assert.match(adminPage, /content\.caseStudies\.length\} records/);
  assert.match(adminEditor, /membership\.role !== "owner"[\s\S]*?Only the owner can unpublish Upcoming Work/);
  assert.match(adminEditor, /cms_unpublish_upcoming_case_study/);
  assert.match(adminEditor, /review\.publication_status === "published" && review\.publication_project_type === "upcoming"/);
  assert.match(adminEditor, /label="Unpublish"/);
  assert.match(adminEditor, /review\.revision_status === "review"[\s\S]*?publishCaseStudy/);
  assert.match(adminLoader, /publication_status: baseData\.status/);
  assert.match(adminLoader, /publication_project_type: baseData\.project_type/);
  assert.match(adminEditor, /formatDate\(review\.publication_published_at\)/);
});

test("publish and unpublish both invalidate public Work and sitemap routes", () => {
  const publishStart = adminEditor.indexOf("async function publishCaseStudy");
  const unpublishStart = adminEditor.indexOf("async function unpublishUpcoming", publishStart);
  const publishAction = adminEditor.slice(publishStart, unpublishStart);
  const unpublishAction = adminEditor.slice(unpublishStart);

  for (const action of [publishAction, unpublishAction]) {
    assert.match(action, /revalidatePath\("\/work"\)/);
    assert.match(action, /revalidatePath\(`\/work\/\$\{slug\}`\)/);
    assert.match(action, /revalidatePath\("\/sitemap\.xml"\)/);
  }
});

console.log("Work CMS Update v1 Task 1: focused contract assertions passed");
