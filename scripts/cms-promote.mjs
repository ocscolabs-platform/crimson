#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const SOURCE_URL = process.env.CMS_SOURCE_SUPABASE_URL;
const SOURCE_KEY = process.env.CMS_SOURCE_SUPABASE_SERVICE_ROLE_KEY;
const TARGET_URL = process.env.CMS_TARGET_SUPABASE_URL;
const TARGET_KEY = process.env.CMS_TARGET_SUPABASE_SERVICE_ROLE_KEY;
const SOURCE_BUCKET = process.env.CMS_SOURCE_STORAGE_BUCKET || "case-study-media";
const TARGET_BUCKET = process.env.CMS_TARGET_STORAGE_BUCKET || "case-study-media";
const isApply = process.argv.includes("--apply");
const isDryRun = !isApply;

const REQUIRED_ENV = [
  ["CMS_SOURCE_SUPABASE_URL", SOURCE_URL],
  ["CMS_SOURCE_SUPABASE_SERVICE_ROLE_KEY", SOURCE_KEY],
  ["CMS_TARGET_SUPABASE_URL", TARGET_URL],
  ["CMS_TARGET_SUPABASE_SERVICE_ROLE_KEY", TARGET_KEY],
];

for (const [name, value] of REQUIRED_ENV) {
  if (!value) {
    throw new Error(`Missing ${name}. See docs/CMS-PROMOTION.md.`);
  }
}

if (isApply && process.env.CMS_PROMOTION_CONFIRM !== "PROMOTE_TO_PRODUCTION") {
  throw new Error(
    "Apply mode requires CMS_PROMOTION_CONFIRM=PROMOTE_TO_PRODUCTION. Dry run is the default.",
  );
}

const source = createClient(SOURCE_URL, SOURCE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const target = createClient(TARGET_URL, TARGET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fail(label, error) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

async function readMany(client, table, query = (builder) => builder) {
  const { data, error } = await query(client.from(table).select("*"));
  fail(`Read ${table}`, error);
  return data || [];
}

async function readOne(client, table, query = (builder) => builder) {
  const { data, error } = await query(client.from(table).select("*").maybeSingle());
  fail(`Read ${table}`, error);
  return data;
}

function pick(sourceRecord, fields) {
  return Object.fromEntries(fields.map((field) => [field, sourceRecord[field] ?? null]));
}

const SITE_SETTINGS_FIELDS = [
  "id",
  "site_name",
  "positioning_statement",
  "default_seo_title",
  "default_seo_description",
  "default_og_image_path",
  "primary_contact_path",
];

const NAVIGATION_FIELDS = ["label", "href", "navigation_group", "sort_order", "is_visible"];
const PAGE_FIELDS = [
  "title",
  "slug",
  "page_purpose",
  "audience",
  "seo_title",
  "seo_description",
  "og_image_path",
  "content",
  "cta_label",
  "cta_href",
  "status",
  "published_at",
  "last_reviewed_at",
];
const SERVICE_FIELDS = [
  "name",
  "slug",
  "short_description",
  "detailed_description",
  "audience",
  "deliverables",
  "process_summary",
  "card_name",
  "outcome",
  "cta_label",
  "cta_href",
  "status",
  "published_at",
  "last_reviewed_at",
];
const CASE_STUDY_FIELDS = [
  "project_name",
  "slug",
  "client_visibility",
  "project_type",
  "project_category",
  "external_url",
  "is_featured",
  "sort_order",
  "summary",
  "challenge",
  "approach",
  "deliverables",
  "outcomes",
  "featured_image_path",
  "featured_image_alt",
  "supporting_media",
  "media_status",
  "media_reviewed_at",
  "status",
  "published_at",
  "last_reviewed_at",
];
const PAGE_SECTION_FIELDS = ["section_key", "label", "sort_order", "is_visible"];

function validatePublishedPackage({ settings, navigation, pages, services, caseStudies, sections }) {
  const issues = [];
  if (!settings) issues.push("site_settings/default is missing");
  if (!navigation.some((item) => item.navigation_group === "primary" && item.is_visible)) {
    issues.push("no visible primary navigation items are available");
  }
  for (const page of pages) {
    if (page.status !== "published" || !page.published_at) {
      issues.push(`page ${page.slug} is not published`);
    }
  }
  for (const service of services) {
    if (service.status !== "published" || !service.published_at) {
      issues.push(`service ${service.slug} is not published`);
    }
  }
  for (const project of caseStudies) {
    if (project.status !== "published" || !project.published_at) {
      issues.push(`case study ${project.slug} is not published`);
    }
    if (project.media_status === "approved") {
      if (!project.featured_image_path || String(project.featured_image_alt || "").trim().length < 8) {
        issues.push(`case study ${project.slug} has approved media without a valid featured image/alt text`);
      }
      if (project.featured_image_path && !project.featured_image_path.endsWith(".webp")) {
        issues.push(`case study ${project.slug} featured media is not WebP`);
      }
      const supporting = Array.isArray(project.supporting_media) ? project.supporting_media : [];
      for (const item of supporting) {
        if (item.approval !== "approved" || String(item.alt || "").trim().length < 8) {
          issues.push(`case study ${project.slug} has supporting media that is not fully approved`);
        }
        if (item.path && !item.path.endsWith(".webp")) {
          issues.push(`case study ${project.slug} supporting media is not WebP`);
        }
      }
    }
  }
  const pageIds = new Set(pages.map((page) => page.id));
  for (const section of sections) {
    if (!pageIds.has(section.page_id)) issues.push(`page section ${section.section_key} has no published page`);
  }
  if (issues.length) throw new Error(`Promotion preflight failed:\n- ${issues.join("\n- ")}`);
}

async function verifyEnvironment(client, label, bucket) {
  for (const table of [
    "site_settings",
    "navigation_items",
    "pages",
    "services",
    "case_studies",
    "case_study_services",
    "page_sections",
  ]) {
    const { error } = await client.from(table).select("*").limit(1);
    fail(`${label} schema check (${table})`, error);
  }
  const { error: bucketError } = await client.storage.getBucket(bucket);
  fail(`${label} storage check (${bucket})`, bucketError);
}

async function copyMedia(project) {
  const paths = [];
  if (project.featured_image_path) paths.push(project.featured_image_path);
  if (Array.isArray(project.supporting_media)) {
    for (const item of project.supporting_media) {
      if (item.approval === "approved" && item.path) paths.push(item.path);
    }
  }

  for (const path of [...new Set(paths)]) {
    if (isDryRun) {
      console.log(`  media  ${path}`);
      continue;
    }
    const { data, error } = await source.storage.from(SOURCE_BUCKET).download(path);
    fail(`Download ${path}`, error);
    const bytes = Buffer.from(await data.arrayBuffer());
    const { error: uploadError } = await target.storage.from(TARGET_BUCKET).upload(path, bytes, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });
    fail(`Upload ${path}`, uploadError);
    console.log(`  media  ${path} copied`);
  }
}

async function upsertBySlug(table, record, fields) {
  const payload = pick(record, fields);
  const existing = await readOne(target, table, (builder) => builder.eq("slug", record.slug));
  if (!existing) {
    if (!isDryRun) {
      const { error } = await target.from(table).insert(payload);
      fail(`Insert ${table}/${record.slug}`, error);
    }
    console.log(`  add    ${table}/${record.slug}`);
    return;
  }
  if (!isDryRun) {
    const { error } = await target.from(table).update(payload).eq("id", existing.id);
    fail(`Update ${table}/${record.slug}`, error);
  }
  console.log(`  update ${table}/${record.slug}`);
}

async function upsertSiteSettings(record) {
  const payload = pick(record, SITE_SETTINGS_FIELDS);
  const existing = await readOne(target, "site_settings", (builder) => builder.eq("id", "default"));
  if (!isDryRun) {
    const result = existing
      ? await target.from("site_settings").update(payload).eq("id", "default")
      : await target.from("site_settings").insert(payload);
    fail("Write site_settings/default", result.error);
  }
  console.log(`  ${existing ? "update" : "add   "} site_settings/default`);
}

async function upsertNavigation(sourceItems) {
  const targetItems = await readMany(target, "navigation_items");
  for (const item of sourceItems) {
    const existing = targetItems.find((candidate) => (
      candidate.navigation_group === item.navigation_group && candidate.href === item.href
    ));
    const payload = pick(item, NAVIGATION_FIELDS);
    if (!isDryRun) {
      const result = existing
        ? await target.from("navigation_items").update(payload).eq("id", existing.id)
        : await target.from("navigation_items").insert(payload);
      fail(`Write navigation/${item.navigation_group}/${item.href}`, result.error);
    }
    console.log(`  ${existing ? "update" : "add   "} navigation/${item.navigation_group}/${item.href}`);
  }
}

async function upsertPageSections(sourceSections, targetPagesBySlug, sourcePagesById) {
  const targetSections = await readMany(target, "page_sections");
  for (const section of sourceSections) {
    const sourcePage = sourcePagesById.get(section.page_id);
    const targetPage = sourcePage && targetPagesBySlug.get(sourcePage.slug);
    if (!targetPage) throw new Error(`No target page found for section ${section.section_key}`);
    const existing = targetSections.find((candidate) => (
      candidate.page_id === targetPage.id && candidate.section_key === section.section_key
    ));
    const payload = { ...pick(section, PAGE_SECTION_FIELDS), page_id: targetPage.id };
    if (!isDryRun) {
      const result = existing
        ? await target.from("page_sections").update(payload).eq("id", existing.id)
        : await target.from("page_sections").insert(payload);
      fail(`Write page section/${sourcePage.slug}/${section.section_key}`, result.error);
    }
    console.log(`  ${existing ? "update" : "add   "} section/${sourcePage.slug}/${section.section_key}`);
  }
}

async function replaceRelationships(sourceLinks, sourceCaseStudiesById, sourceServicesById, targetCaseStudiesBySlug, targetServicesBySlug) {
  const sourceLinksByCaseStudy = new Map();
  for (const link of sourceLinks) {
    const caseStudy = sourceCaseStudiesById.get(link.case_study_id);
    const service = sourceServicesById.get(link.service_id);
    if (!caseStudy || !service) throw new Error("A case-study relationship references a missing record");
    const list = sourceLinksByCaseStudy.get(caseStudy.slug) || [];
    list.push(service.slug);
    sourceLinksByCaseStudy.set(caseStudy.slug, list);
  }

  for (const [caseStudySlug, serviceSlugs] of sourceLinksByCaseStudy) {
    const targetCaseStudy = targetCaseStudiesBySlug.get(caseStudySlug);
    if (!targetCaseStudy) throw new Error(`No target case study found for relationship ${caseStudySlug}`);
    const targetServiceIds = serviceSlugs.map((slug) => targetServicesBySlug.get(slug)?.id).filter(Boolean);
    if (targetServiceIds.length !== serviceSlugs.length) throw new Error(`A target service is missing for ${caseStudySlug}`);
    const existing = await readMany(target, "case_study_services", (builder) => builder.eq("case_study_id", targetCaseStudy.id));
    if (!isDryRun) {
      const { error: deleteError } = await target.from("case_study_services").delete().eq("case_study_id", targetCaseStudy.id);
      fail(`Clear relationships/${caseStudySlug}`, deleteError);
      if (targetServiceIds.length) {
        const { error: insertError } = await target.from("case_study_services").insert(
          targetServiceIds.map((serviceId) => ({ case_study_id: targetCaseStudy.id, service_id: serviceId })),
        );
        fail(`Write relationships/${caseStudySlug}`, insertError);
      }
    }
    console.log(`  links  ${caseStudySlug}: ${existing.length} -> ${targetServiceIds.length}`);
  }
}

async function main() {
  console.log(`CMS promotion ${isDryRun ? "DRY RUN" : "APPLY"}`);
  console.log(`Source: ${SOURCE_URL}`);
  console.log(`Target: ${TARGET_URL}`);
  console.log("Reading owner-approved published package from source...");

  const settings = await readOne(source, "site_settings", (builder) => builder.eq("id", "default"));
  const navigation = await readMany(source, "navigation_items", (builder) => builder.order("navigation_group").order("sort_order"));
  const pages = await readMany(source, "pages", (builder) => builder.eq("status", "published"));
  const services = await readMany(source, "services", (builder) => builder.eq("status", "published"));
  const caseStudies = await readMany(source, "case_studies", (builder) => builder.eq("status", "published"));
  const links = await readMany(source, "case_study_services");
  const sections = await readMany(source, "page_sections");
  validatePublishedPackage({ settings, navigation, pages, services, caseStudies, sections });

  console.log("Checking source and target CMS boundaries before writing...");
  await verifyEnvironment(source, "Source", SOURCE_BUCKET);
  await verifyEnvironment(target, "Target", TARGET_BUCKET);

  console.log(`Package: ${pages.length} pages, ${services.length} services, ${caseStudies.length} case studies, ${navigation.length} navigation items, ${sections.length} page sections`);
  console.log("Media:");
  for (const project of caseStudies) await copyMedia(project);

  await upsertSiteSettings(settings);
  await upsertNavigation(navigation);
  for (const page of pages) await upsertBySlug("pages", page, PAGE_FIELDS);
  for (const service of services) await upsertBySlug("services", service, SERVICE_FIELDS);
  for (const project of caseStudies) await upsertBySlug("case_studies", project, CASE_STUDY_FIELDS);

  const targetPages = await readMany(target, "pages");
  const targetServices = await readMany(target, "services");
  const targetCaseStudies = await readMany(target, "case_studies");
  await upsertPageSections(
    sections,
    new Map(targetPages.map((page) => [page.slug, page])),
    new Map(pages.map((page) => [page.id, page])),
  );
  await replaceRelationships(
    links,
    new Map(caseStudies.map((project) => [project.id, project])),
    new Map(services.map((service) => [service.id, service])),
    new Map(targetCaseStudies.map((project) => [project.slug, project])),
    new Map(targetServices.map((service) => [service.slug, service])),
  );
  console.log(isDryRun ? "Dry run complete. No Production records or media were changed." : "Promotion complete. Verify the Production public routes and media before declaring release complete.");
}

main().catch((error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exitCode = 1;
});
