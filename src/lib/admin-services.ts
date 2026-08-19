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

  return data as AdminServiceRecord | null;
}

export async function getAdminServiceAudit(serviceId: string): Promise<AdminServiceAuditEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cms_audit_log")
    .select("id, actor_user_id, action, from_status, to_status, created_at")
    .eq("entity_type", "service")
    .eq("entity_id", serviceId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AdminServiceAuditEntry[];
}
