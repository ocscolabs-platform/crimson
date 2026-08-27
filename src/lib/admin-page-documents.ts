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

export type AdminPageDocumentRevisionHistoryEntry = {
  id: string;
  status: "draft" | "review" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  isPublished: boolean;
  document: PageDocument | null;
  validationIssues: string[];
};

export type AdminPageDocumentAuditEntry = {
  id: string;
  revisionId: string;
  actorLabel: string | null;
  sourceRevisionId: string | null;
  relatedRevisionId: string | null;
  action:
    | "draft_saved"
    | "submitted_for_review"
    | "returned_to_draft"
    | "publish_archived_previous"
    | "published"
    | "restore_archived_active"
    | "restored_to_review";
  fromStatus: "draft" | "review" | "published" | "archived" | null;
  toStatus: "draft" | "review" | "published" | "archived";
  createdAt: string;
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
    revisionId: string | null;
    document: PageDocument | null;
    validationIssues: string[];
  };
  activeRevision: AdminPageDocumentRevision | null;
  revisionHistory: AdminPageDocumentRevisionHistoryEntry[];
  auditHistory: AdminPageDocumentAuditEntry[];
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
  published_revision_id: string | null;
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

type AuditRow = {
  id: string;
  revision_id: string;
  actor_user_id: string | null;
  source_revision_id: string | null;
  related_revision_id: string | null;
  action: AdminPageDocumentAuditEntry["action"];
  from_status: AdminPageDocumentAuditEntry["fromStatus"];
  to_status: AdminPageDocumentAuditEntry["toStatus"];
  created_at: string;
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
  auditHistory: AuditRow[],
  actorLabels: ReadonlyMap<string, string>,
): AdminPageDocumentSummary {
  const pageStatus = page && isWorkflowStatus(page.status) ? page.status : "unavailable";
  const publishedRevision = page?.published_revision_id
    ? revisions.find((revision) => revision.id === page.published_revision_id)
    : undefined;
  const publishedValidation = publishedRevision
    ? validateDocument(getPageDocumentCandidate(publishedRevision.payload), adapter.pageKey)
    : { document: null, validationIssues: page ? ["The authoritative Published revision pointer is unavailable."] : ["The page record is unavailable."] };
  const published = page && publishedRevision?.status === "published"
    ? {
      status: publishedValidation.document ? "published" as const : "invalid" as const,
      revisionId: publishedRevision.id,
      document: publishedValidation.document,
      validationIssues: publishedValidation.validationIssues,
    }
    : {
      status: "unavailable" as const,
      revisionId: page?.published_revision_id ?? null,
      document: null,
      validationIssues: publishedValidation.validationIssues,
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

  const revisionHistory = revisions
    .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at))
    .map((revision) => {
      const validation = validateDocument(getPageDocumentCandidate(revision.payload), adapter.pageKey);
      return {
        id: revision.id,
        status: revision.status as AdminPageDocumentRevisionHistoryEntry["status"],
        createdAt: revision.created_at,
        updatedAt: revision.updated_at,
        publishedAt: revision.published_at,
        isPublished: revision.id === page?.published_revision_id,
        document: validation.document,
        validationIssues: validation.validationIssues,
      };
    });

  const currentState = activeRevision?.status
    ?? (published.status === "published" ? "published" : published.status === "invalid" ? "invalid" : pageStatus === "archived" ? "archived" : "unavailable");
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
    revisionHistory,
    auditHistory: auditHistory.map((entry) => ({
      id: entry.id,
      revisionId: entry.revision_id,
      actorLabel: entry.actor_user_id ? actorLabels.get(entry.actor_user_id) ?? "CMS member" : null,
      sourceRevisionId: entry.source_revision_id,
      relatedRevisionId: entry.related_revision_id,
      action: entry.action,
      fromStatus: entry.from_status,
      toStatus: entry.to_status,
      createdAt: entry.created_at,
    })),
    currentState,
  };
}

export async function getAdminPageDocumentReadModel(): Promise<AdminPageDocumentReadModel> {
  const supabase = await createClient();
  const pageKeys = PAGE_DOCUMENT_ADMIN_ADAPTERS.map((adapter) => adapter.pageKey);
  const { data: pageData, error: pageError } = await supabase
    .from("pages")
    .select("id, title, slug, status, published_at, last_reviewed_at, updated_at, published_revision_id, content")
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
      .in("status", ["draft", "review", "published", "archived"]);

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

  const auditByPage = new Map<string, AuditRow[]>();
  if (pageIds.length > 0) {
    const { data: auditData, error: auditError } = await supabase
      .from("cms_workflow_audit_log")
      .select("id, page_id, revision_id, actor_user_id, source_revision_id, related_revision_id, action, from_status, to_status, created_at")
      .in("page_id", pageIds)
      .order("created_at", { ascending: false })
      .limit(100);

    if (auditError) {
      throw new Error("The PageDocument workflow history could not be loaded.");
    }

    for (const entry of (auditData ?? []) as Array<AuditRow & { page_id: string }>) {
      const pageAudit = auditByPage.get(entry.page_id) ?? [];
      pageAudit.push(entry);
      auditByPage.set(entry.page_id, pageAudit);
    }
  }

  const actorIds = [...new Set([...auditByPage.values()].flat().map((entry) => entry.actor_user_id).filter((value): value is string => Boolean(value)))];
  const actorLabels = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: members } = await supabase
      .from("cms_members")
      .select("user_id, role")
      .in("user_id", actorIds);
    for (const member of members ?? []) {
      if (["owner", "editor", "reviewer"].includes(member.role)) {
        actorLabels.set(member.user_id, `${member.role[0].toUpperCase()}${member.role.slice(1)}`);
      }
    }
  }

  return {
    pages: PAGE_DOCUMENT_ADMIN_ADAPTERS.map((adapter) => {
      const page = pagesBySlug.get(adapter.pageKey);
      return buildSummary(adapter, page, page ? revisionsByPage.get(page.id) ?? [] : [], page ? auditByPage.get(page.id) ?? [] : [], actorLabels);
    }),
  };
}
