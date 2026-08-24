import { createClient } from "@/lib/supabase/server";
import { validatePageDocument, type PageDocument, type PageKey, type PageSectionKey } from "@/lib/page-document";

export type PageDocumentAdminAdapter = {
  pageKey: PageKey;
  label: string;
  route: "/" | "/services" | "/about" | "/contact";
  sectionKeys: readonly PageSectionKey[];
};

export const PAGE_DOCUMENT_ADMIN_ADAPTERS = [
  {
    pageKey: "home",
    label: "Homepage",
    route: "/",
    sectionKeys: ["home_hero", "home_intro", "home_capabilities", "home_approach", "home_proof", "home_contact"],
  },
  {
    pageKey: "services",
    label: "Services",
    route: "/services",
    sectionKeys: ["services_hero", "services_capabilities"],
  },
  {
    pageKey: "about",
    label: "About",
    route: "/about",
    sectionKeys: ["about_hero", "about_principles", "about_people"],
  },
  {
    pageKey: "contact",
    label: "Contact",
    route: "/contact",
    sectionKeys: ["contact_hero", "contact_process", "contact_form"],
  },
] as const satisfies readonly PageDocumentAdminAdapter[];

const PAGE_DOCUMENT_ADMIN_ADAPTER_MAP = new Map(
  PAGE_DOCUMENT_ADMIN_ADAPTERS.map((adapter) => [adapter.pageKey, adapter]),
);

export type AdminPageDocumentRevision = {
  id: string;
  status: "draft" | "review";
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  document: PageDocument | null;
  validationIssues: string[];
};

export type AdminPageDocumentSummary = {
  pageId: string | null;
  adapter: PageDocumentAdminAdapter;
  pageStatus: "draft" | "review" | "published" | "archived" | "unavailable";
  publishedAt: string | null;
  lastReviewedAt: string | null;
  lastUpdatedAt: string | null;
  published: {
    status: "published" | "unavailable" | "invalid";
    document: PageDocument | null;
    validationIssues: string[];
  };
  activeRevision: AdminPageDocumentRevision | null;
  currentState: "draft" | "review" | "published" | "archived" | "invalid" | "unavailable";
};

export type AdminPageDocumentReadModel = {
  pages: AdminPageDocumentSummary[];
};

type PageRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  published_at: string | null;
  last_reviewed_at: string | null;
  updated_at: string | null;
  content: unknown;
};

type RevisionRow = {
  id: string;
  entity_key: string;
  status: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  payload: unknown;
};

function getPageDocumentCandidate(payload: unknown): unknown {
  if (payload && typeof payload === "object" && !Array.isArray(payload) && "content" in payload) {
    return (payload as Record<string, unknown>).content;
  }

  return payload;
}

function validateDocument(content: unknown, pageKey: PageKey) {
  const result = validatePageDocument(content, pageKey);
  return result.success
    ? { document: result.value, validationIssues: [] as string[] }
    : { document: null, validationIssues: result.issues };
}

function isWorkflowStatus(value: string): value is "draft" | "review" | "published" | "archived" {
  return ["draft", "review", "published", "archived"].includes(value);
}

export function getPageDocumentAdminAdapter(value: string): PageDocumentAdminAdapter | null {
  return PAGE_DOCUMENT_ADMIN_ADAPTER_MAP.get(value as PageKey) ?? null;
}

function buildSummary(
  adapter: PageDocumentAdminAdapter,
  page: PageRow | undefined,
  revisions: RevisionRow[],
): AdminPageDocumentSummary {
  const pageStatus = page && isWorkflowStatus(page.status) ? page.status : "unavailable";
  const publishedValidation = page ? validateDocument(page.content, adapter.pageKey) : { document: null, validationIssues: ["The page record is unavailable."] };
  const published = page && page.status === "published"
    ? {
      status: publishedValidation.document ? "published" as const : "invalid" as const,
      document: publishedValidation.document,
      validationIssues: publishedValidation.validationIssues,
    }
    : {
      status: "unavailable" as const,
      document: null,
      validationIssues: [],
    };

  const revisionRow = revisions
    .filter((revision) => revision.status === "draft" || revision.status === "review")
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))[0];
  const activeValidation = revisionRow
    ? validateDocument(getPageDocumentCandidate(revisionRow.payload), adapter.pageKey)
    : null;
  const activeRevision = revisionRow
    ? {
      id: revisionRow.id,
      status: revisionRow.status as "draft" | "review",
      createdAt: revisionRow.created_at,
      updatedAt: revisionRow.updated_at,
      publishedAt: revisionRow.published_at,
      document: activeValidation?.document ?? null,
      validationIssues: activeValidation?.validationIssues ?? [],
    }
    : null;

  const currentState = activeRevision?.status
    ?? (published.status === "published" ? "published" : published.status === "invalid" ? "invalid" : pageStatus);
  const timestamps = [page?.updated_at, activeRevision?.updatedAt].filter((value): value is string => Boolean(value));

  return {
    pageId: page?.id ?? null,
    adapter,
    pageStatus,
    publishedAt: page?.published_at ?? null,
    lastReviewedAt: page?.last_reviewed_at ?? null,
    lastUpdatedAt: timestamps.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null,
    published,
    activeRevision,
    currentState,
  };
}

export async function getAdminPageDocumentReadModel(): Promise<AdminPageDocumentReadModel> {
  const supabase = await createClient();
  const pageKeys = PAGE_DOCUMENT_ADMIN_ADAPTERS.map((adapter) => adapter.pageKey);
  const { data: pageData, error: pageError } = await supabase
    .from("pages")
    .select("id, title, slug, status, published_at, last_reviewed_at, updated_at, content")
    .in("slug", pageKeys);

  if (pageError) {
    throw new Error("The PageDocument records could not be loaded.");
  }

  const pages = (pageData ?? []) as PageRow[];
  const pageIds = pages.map((page) => page.id);
  let revisions: RevisionRow[] = [];

  if (pageIds.length > 0) {
    const { data: revisionData, error: revisionError } = await supabase
      .from("cms_revisions")
      .select("id, entity_key, status, created_at, updated_at, published_at, payload")
      .eq("entity_type", "page")
      .in("entity_key", pageIds)
      .in("status", ["draft", "review"]);

    if (revisionError) {
      throw new Error("The current PageDocument workflow state could not be loaded.");
    }

    revisions = (revisionData ?? []) as RevisionRow[];
  }

  const pagesBySlug = new Map(pages.map((page) => [page.slug, page]));
  const revisionsByPage = new Map<string, RevisionRow[]>();
  for (const revision of revisions) {
    const pageRevisions = revisionsByPage.get(revision.entity_key) ?? [];
    pageRevisions.push(revision);
    revisionsByPage.set(revision.entity_key, pageRevisions);
  }

  return {
    pages: PAGE_DOCUMENT_ADMIN_ADAPTERS.map((adapter) => {
      const page = pagesBySlug.get(adapter.pageKey);
      return buildSummary(adapter, page, page ? revisionsByPage.get(page.id) ?? [] : []);
    }),
  };
}
