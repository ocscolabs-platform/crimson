import { createClient } from "@/lib/supabase/server";

export type CmsRole = "owner" | "editor" | "reviewer";
export type CmsAccessScope = "full_cms" | "insights_only";

export type CmsMembership = {
  role: CmsRole | null;
  accessScope: CmsAccessScope | null;
  insightsAccess: boolean;
  canPublishInsights: boolean;
  publicDisplayName: string | null;
  isConfigured: boolean;
};

export function getCmsRoleLabel(membership: CmsMembership): string {
  if (membership.role === "owner") return "Owner";
  if (membership.role === "editor") return "Editor";
  if (membership.role === "reviewer") return "Reviewer";
  return "Role pending";
}

export async function getCmsMembership(userId: string): Promise<CmsMembership> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cms_members")
    .select("role, public_display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || !["owner", "editor", "reviewer"].includes(data.role)) {
    return {
      role: null,
      accessScope: null,
      insightsAccess: false,
      canPublishInsights: false,
      publicDisplayName: null,
      isConfigured: !error,
    };
  }

  const { data: access, error: accessError } = await supabase
    .from("cms_member_access")
    .select("access_scope, insights_access, can_publish_insights")
    .eq("user_id", userId)
    .maybeSingle();

  if (accessError) {
    return {
      role: data.role as CmsRole,
      accessScope: null,
      insightsAccess: false,
      canPublishInsights: false,
      publicDisplayName: data.public_display_name,
      isConfigured: false,
    };
  }

  return {
    role: data.role as CmsRole,
    accessScope: (access?.access_scope as CmsAccessScope | undefined) ?? "full_cms",
    insightsAccess: Boolean(access?.insights_access),
    canPublishInsights: Boolean(access?.can_publish_insights),
    publicDisplayName: data.public_display_name,
    isConfigured: true,
  };
}
