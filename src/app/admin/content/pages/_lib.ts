import { redirect } from "next/navigation";
import { getCmsMembership } from "@/lib/cms-auth";
import { createClient } from "@/lib/supabase/server";

export async function requireCmsViewer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/crimson-admin-control/login");

  const membership = await getCmsMembership(user.id);
  if (!membership.role) redirect("/crimson-admin-control");

  return { user, membership };
}

export async function requireCmsInsightsEditor() {
  const result = await requireCmsViewer();
  if (!result.membership.insightsAccess && result.membership.accessScope !== "full_cms" && result.membership.role !== "owner") {
    redirect("/crimson-admin-control");
  }
  if (result.membership.role !== "owner" && result.membership.role !== "editor") {
    redirect("/crimson-admin-control");
  }
  return result;
}
