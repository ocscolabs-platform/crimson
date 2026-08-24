"use server";

import { revalidatePath } from "next/cache";
import { getCmsMembership } from "@/lib/cms-auth";
import { getPageDocumentAdminAdapter } from "@/lib/admin-page-documents";
import { validatePageDocument } from "@/lib/page-document";
import { createClient } from "@/lib/supabase/server";

export type PageDocumentActionState = {
  status: "idle" | "success" | "error";
  message: string;
  issues: string[];
};

function errorState(message: string, issues: string[] = []): PageDocumentActionState {
  return { status: "error", message, issues };
}

export async function savePageDocumentDraft(
  previousState: PageDocumentActionState,
  formData: FormData,
): Promise<PageDocumentActionState> {
  void previousState;
  const pageKeyValue = String(formData.get("page_key") || "");
  const adapter = getPageDocumentAdminAdapter(pageKeyValue);
  if (!adapter) return errorState("This page is not part of the approved PageDocument editor.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return errorState("Your CMS session has expired. Sign in again to save a Draft.");

  const membership = await getCmsMembership(user.id);
  if (membership.role !== "owner" && membership.role !== "editor") {
    return errorState("Reviewer access is read-only. Draft changes were not saved.");
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(String(formData.get("page_document") || ""));
  } catch {
    return errorState("The structured page content could not be read. Review the fields and try again.");
  }

  const validation = validatePageDocument(candidate, adapter.pageKey);
  if (!validation.success) {
    return errorState("Review the highlighted PageDocument fields before saving.", validation.issues);
  }

  const { data: page, error: pageError } = await supabase
    .from("pages")
    .select("id, title, page_purpose, audience, slug")
    .eq("slug", adapter.pageKey)
    .maybeSingle();

  if (pageError || !page) {
    return errorState("The approved page record could not be loaded for Draft saving.");
  }

  const { error: revisionError } = await supabase.rpc("cms_save_revision", {
    p_entity_type: "page",
    p_entity_key: page.id,
    p_status: "draft",
    p_payload: {
      title: page.title,
      page_purpose: page.page_purpose,
      audience: page.audience,
      content: validation.value,
    },
  });

  if (revisionError) {
    return errorState("The Draft could not be saved by the canonical PageDocument workflow.");
  }

  for (const path of [
    `/crimson-admin-control/content/pages/${adapter.pageKey}`,
    "/crimson-admin-control/content/pages",
  ]) {
    revalidatePath(path);
  }

  return {
    status: "success",
    message: "Draft saved. Draft changes are private and are not visible on the public site; published content remains unchanged.",
    issues: [],
  };
}
