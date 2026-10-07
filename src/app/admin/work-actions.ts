"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCmsMembership } from "@/lib/cms-auth";
import { createClient } from "@/lib/supabase/server";

const dashboardPath = "/crimson-admin-control";

function redirectWithError(message: string): never {
  redirect(`${dashboardPath}?error=${encodeURIComponent(message)}#work-records`);
}

export async function reorderWork(formData: FormData) {
  const targetId = String(formData.get("target_id") || "");
  const direction = String(formData.get("direction") || "");

  if (!targetId || (direction !== "up" && direction !== "down")) {
    redirectWithError("That Work ordering request was invalid.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/crimson-admin-control/login");
  }

  const membership = await getCmsMembership(user.id);
  if (membership.role !== "owner") {
    redirectWithError("Only the Owner can change the public Work order.");
  }

  const { data, error } = await supabase
    .from("case_studies")
    .select("id, sort_order, created_at, slug")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .order("slug", { ascending: true });

  if (error) {
    console.error("[work-order] authoritative Work Library read failed", { error });
    redirectWithError("The current Work order could not be loaded. Try again.");
  }

  const orderedIds = (data ?? []).map((record) => record.id);
  const targetIndex = orderedIds.indexOf(targetId);
  const adjacentIndex = direction === "up" ? targetIndex - 1 : targetIndex + 1;

  if (targetIndex < 0) {
    redirectWithError("That Work record is no longer available.");
  }

  if (adjacentIndex < 0 || adjacentIndex >= orderedIds.length) {
    redirectWithError("That Work record is already at the requested boundary.");
  }

  [orderedIds[targetIndex], orderedIds[adjacentIndex]] = [orderedIds[adjacentIndex], orderedIds[targetIndex]];

  const { error: reorderError } = await supabase.rpc("cms_reorder_case_studies", {
    p_ordered_case_study_ids: orderedIds,
  });

  if (reorderError) {
    console.error("[work-order] reorder RPC failed", { error: reorderError });
    redirectWithError("The Work order could not be saved. Reload and try again.");
  }

  revalidatePath(dashboardPath);
  revalidatePath("/work");
  redirect(`${dashboardPath}?ordered=1#work-records`);
}
