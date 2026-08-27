import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import type { PageDocument, PageKey, ServiceSlug } from "@/lib/page-document";
import { validatePageDocument } from "@/lib/page-document";
import type { Service } from "@/lib/site-content";

export type PublishedPageDocumentRow = {
  slug: string;
  status: string;
  published_at: string | null;
  content: unknown;
};

export type PageDocumentUnavailableReason =
  | "cms-not-configured"
  | "cms-read-failed"
  | "missing-or-unpublished";

export type PublishedPageDocumentResult =
  | { kind: "document"; document: PageDocument }
  | { kind: "unavailable"; reason: PageDocumentUnavailableReason; message: string }
  | { kind: "invalid"; issues: string[] };

export type PublishedServiceRow = {
  name: string;
  card_name: string | null;
  slug: string;
  short_description: string | null;
  audience: string | null;
  outcome: string | null;
  status: string;
  published_at: string | null;
};

export type PageDocumentServiceResult =
  | { kind: "resolved"; services: Service[] }
  | { kind: "unavailable"; reason: "cms-not-configured" | "cms-read-failed"; message: string }
  | { kind: "invalid"; issues: string[] };

const SERVICES_PAGE_SLUGS: readonly ServiceSlug[] = [
  "branding",
  "website-design-development",
  "custom-cms",
  "crm-business-tools",
  "custom-web-applications",
];

function getPublicCmsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isPublishedAtOrBeforeNow(value: string | null, now: Date) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

function toPublishedService(row: PublishedServiceRow): Service {
  return {
    slug: row.slug,
    name: row.name,
    cardName: row.card_name || row.name,
    summary: row.short_description || "",
    audience: row.audience || "",
    outcome: row.outcome || "",
  };
}

/**
 * Converts a row already returned by the published query into a strict result.
 * This is exported so the availability/invalid-content boundary can be tested
 * without connecting to Supabase.
 */
export function resolvePublishedPageDocumentRow(
  pageKey: PageKey,
  row: PublishedPageDocumentRow | null,
  now = new Date(),
): PublishedPageDocumentResult {
  if (!row || row.status !== "published" || !isPublishedAtOrBeforeNow(row.published_at, now)) {
    return {
      kind: "unavailable",
      reason: "missing-or-unpublished",
      message: `No published PageDocument is available for ${pageKey}.`,
    };
  }

  if (row.slug !== pageKey) {
    return {
      kind: "invalid",
      issues: [`pages.slug: expected ${pageKey}`],
    };
  }

  const result = validatePageDocument(row.content, pageKey);
  return result.success
    ? { kind: "document", document: result.value }
    : { kind: "invalid", issues: result.issues };
}

/**
 * Reads only explicitly published, currently effective rows. RLS remains a
 * second boundary, but publication intent is visible in this query as well.
 */
export const getPublishedPageDocument = cache(async function getPublishedPageDocument(pageKey: PageKey): Promise<PublishedPageDocumentResult> {
  const client = getPublicCmsClient();
  if (!client) {
    return {
      kind: "unavailable",
      reason: "cms-not-configured",
      message: "The published CMS read boundary is not configured.",
    };
  }

  const now = new Date();
  const { data, error } = await client
    .from("pages")
    .select("slug, status, published_at, content")
    .eq("slug", pageKey)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", now.toISOString())
    .maybeSingle();

  if (error) {
    return {
      kind: "unavailable",
      reason: "cms-read-failed",
      message: "The published CMS content could not be read.",
    };
  }

  return resolvePublishedPageDocumentRow(pageKey, data as PublishedPageDocumentRow | null, now);
});

function getHomeServiceSlugs(document: PageDocument): ServiceSlug[] {
  if (document.pageKey !== "home") return [];

  const section = document.sections.find((candidate) => candidate.key === "home_capabilities");
  if (!section || section.key !== "home_capabilities") return [];
  return section.content.items.map((item) => item.service.slug);
}

export function resolvePublishedServiceRows(
  document: PageDocument,
  rows: readonly PublishedServiceRow[],
  now = new Date(),
): PageDocumentServiceResult {
  const slugs = getHomeServiceSlugs(document);
  if (slugs.length === 0) {
    return { kind: "resolved", services: [] };
  }

  const duplicateSlugs = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);
  if (duplicateSlugs.length > 0) {
    return {
      kind: "invalid",
      issues: [`home_capabilities.items: duplicate Service reference ${duplicateSlugs[0]}`],
    };
  }

  const rowsBySlug = new Map(rows.map((row) => [row.slug, row]));
  const services: Service[] = [];
  const issues: string[] = [];

  for (const slug of slugs) {
    const row = rowsBySlug.get(slug);
    if (!row) {
      issues.push(`home_capabilities.items: Service ${slug} is missing`);
      continue;
    }
    if (row.status !== "published" || !isPublishedAtOrBeforeNow(row.published_at, now)) {
      issues.push(`home_capabilities.items: Service ${slug} is not published`);
      continue;
    }
    services.push(toPublishedService(row));
  }

  return issues.length > 0 ? { kind: "invalid", issues } : { kind: "resolved", services };
}

/**
 * Resolves the complete Services page list from canonical published Service
 * rows. The Services PageDocument owns the page shell and section plan; the
 * Service records remain the sole authority for cards and detail links.
 */
export function resolvePublishedServiceList(
  rows: readonly PublishedServiceRow[],
  now = new Date(),
): PageDocumentServiceResult {
  const rowsBySlug = new Map<string, PublishedServiceRow>();
  const issues: string[] = [];

  for (const row of rows) {
    if (rowsBySlug.has(row.slug)) {
      issues.push(`services: duplicate Service slug ${row.slug}`);
      continue;
    }
    rowsBySlug.set(row.slug, row);
  }

  for (const slug of SERVICES_PAGE_SLUGS) {
    const row = rowsBySlug.get(slug);
    if (!row) {
      issues.push(`services: Service ${slug} is missing`);
      continue;
    }
    if (row.status !== "published" || !isPublishedAtOrBeforeNow(row.published_at, now)) {
      issues.push(`services: Service ${slug} is not published`);
    }
  }

  for (const row of rows) {
    if (!SERVICES_PAGE_SLUGS.includes(row.slug as ServiceSlug)) {
      issues.push(`services: unexpected Service slug ${row.slug}`);
    }
  }

  if (issues.length > 0) {
    return { kind: "invalid", issues: [...new Set(issues)] };
  }

  return {
    kind: "resolved",
    // The query's created_at order is the existing canonical card order. The
    // PageDocument supplies the page shell, not a duplicate card ordering.
    services: rows.map(toPublishedService),
  };
}

export async function getPublishedPageServices(): Promise<PageDocumentServiceResult> {
  const client = getPublicCmsClient();
  if (!client) {
    return {
      kind: "unavailable",
      reason: "cms-not-configured",
      message: "The published Service read boundary is not configured.",
    };
  }

  const now = new Date();
  const { data, error } = await client
    .from("services")
    .select("name, card_name, slug, short_description, audience, outcome, status, published_at")
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", now.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    return {
      kind: "unavailable",
      reason: "cms-read-failed",
      message: "The published Service content could not be read.",
    };
  }

  return resolvePublishedServiceList((data ?? []) as PublishedServiceRow[], now);
}

export async function resolvePublishedPageServices(document: PageDocument): Promise<PageDocumentServiceResult> {
  const slugs = getHomeServiceSlugs(document);
  if (slugs.length === 0) {
    return { kind: "resolved", services: [] };
  }

  const client = getPublicCmsClient();
  if (!client) {
    return {
      kind: "unavailable",
      reason: "cms-not-configured",
      message: "The published Service read boundary is not configured.",
    };
  }

  const now = new Date();
  const { data, error } = await client
    .from("services")
    .select("name, card_name, slug, short_description, audience, outcome, status, published_at")
    .in("slug", slugs)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", now.toISOString());

  if (error) {
    return {
      kind: "unavailable",
      reason: "cms-read-failed",
      message: "The published Service content could not be read.",
    };
  }

  return resolvePublishedServiceRows(document, (data ?? []) as PublishedServiceRow[], now);
}
