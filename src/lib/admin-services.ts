import { createClient } from "@/lib/supabase/server";
import type { CmsRole } from "@/lib/cms-auth";

export type AdminServiceRecord = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  audience: string | null;
  outcome: string | null;
  status: "draft" | "review" | "published" | "archived";
  published_at: string | null;
  last_reviewed_at: string | null;
  revision_id?: string | null;
  revision_status?: "draft" | "review" | "published" | "archived" | null;
};

export type AdminServiceAuditEntry = {
  id: string;
  actor_user_id: string | null;
  action: "created" | "updated" | "status_changed";
  from_status: AdminServiceRecord["status"] | null;
  to_status: AdminServiceRecord["status"] | null;
  created_at: string;
};

export function canEditServices(role: CmsRole | null) {
  return role === "owner" || role === "editor";
}

export async function getAdminService(slug: string): Promise<AdminServiceRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, slug, short_description, audience, outcome, status, published_at, last_reviewed_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const { data: revision, error: revisionError } = await supabase
    .from("cms_revisions")
    .select("id, status, payload")
    .eq("entity_type", "service")
    .eq("entity_key", data.id)
    .in("status", ["draft", "review"])
    .maybeSingle();

  // The revision table is introduced after the existing staging editor. Keep
  // the editor readable while the migration is being rolled out, but surface
  // real query failures once the table exists.
  if (revisionError && !revisionError.message.toLowerCase().includes("does not exist")) {
    throw new Error(revisionError.message);
  }

  if (!revision) {
    return data as AdminServiceRecord;
  }

  const payload = revision.payload && typeof revision.payload === "object" && !Array.isArray(revision.payload)
    ? revision.payload as Partial<AdminServiceRecord>
    : {};

  return {
    ...(data as AdminServiceRecord),
    ...payload,
    id: data.id,
    slug: data.slug,
    revision_id: revision.id,
    revision_status: revision.status as AdminServiceRecord["revision_status"],
  };
}

export type AdminServiceAuditPage = {
  entries: AdminServiceAuditEntry[];
  total: number;
  page: number;
  pageSize: number;
};

export async function getAdminServiceAudit(serviceId: string, page = 1, pageSize = 5): Promise<AdminServiceAuditPage> {
  const supabase = await createClient();
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const { data, error, count } = await supabase
    .from("cms_audit_log")
    .select("id, actor_user_id, action, from_status, to_status, created_at", { count: "exact" })
    .eq("entity_type", "service")
    .eq("entity_id", serviceId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) {
    throw new Error(error.message);
  }

  return {
    entries: (data ?? []) as AdminServiceAuditEntry[],
    total: count ?? 0,
    page: safePage,
    pageSize,
  };
}
