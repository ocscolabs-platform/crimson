import { createClient } from "@/lib/supabase/server";
import type { CmsRole } from "@/lib/cms-auth";

export type AdminServiceRecord = {
  name: string;
  slug: string;
  short_description: string | null;
  audience: string | null;
  outcome: string | null;
  status: "draft" | "review" | "published" | "archived";
  published_at: string | null;
};

export function canEditServices(role: CmsRole | null) {
  return role === "owner" || role === "editor";
}

export async function getAdminService(slug: string): Promise<AdminServiceRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select("name, slug, short_description, audience, outcome, status, published_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AdminServiceRecord | null;
}
