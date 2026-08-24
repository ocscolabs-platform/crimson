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
