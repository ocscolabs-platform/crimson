import { createClient } from "@/lib/supabase/server";

export type CmsRole = "owner" | "editor" | "reviewer";

export type CmsMembership = {
  role: CmsRole | null;
  isConfigured: boolean;
};

export async function getCmsMembership(userId: string): Promise<CmsMembership> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cms_members")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || !["owner", "editor", "reviewer"].includes(data.role)) {
    return { role: null, isConfigured: !error };
  }

  return { role: data.role as CmsRole, isConfigured: true };
}
