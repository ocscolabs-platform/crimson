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
  revisionId?: string;
};

function errorState(message: string, issues: string[] = []): PageDocumentActionState {
  return { status: "error", message, issues };
}

function successState(message: string, revisionId?: string): PageDocumentActionState {
  return { status: "success", message, issues: [], revisionId };
}

async function getAuthorizedPageAction(pageKeyValue: string) {
  const adapter = getPageDocumentAdminAdapter(pageKeyValue);
  if (!adapter) return { error: errorState("This page is not part of the approved PageDocument workflow.") };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: errorState("Your CMS session has expired. Sign in again to continue.") };

  const membership = await getCmsMembership(user.id);
  if (membership.role !== "owner" && membership.role !== "editor") {
    return { error: errorState("Reviewer access is read-only. This workflow action was not performed.") };
  }

  return { adapter, supabase, role: membership.role };
}

async function getAuthorizedOwnerPageAction(pageKeyValue: string) {
  const authorized = await getAuthorizedPageAction(pageKeyValue);
  if (authorized.error) return authorized;
  if (authorized.role !== "owner") {
    return { error: errorState("Only an Owner can publish PageDocuments. This workflow action was not performed.") };
  }

  return authorized;
}

function revalidatePageDocument(pageKey: string) {
  for (const path of [
    `/crimson-admin-control/content/pages/${pageKey}`,
    "/crimson-admin-control/content/pages",
  ]) {
    revalidatePath(path);
  }
}

export async function savePageDocumentDraft(
  previousState: PageDocumentActionState,
  formData: FormData,
): Promise<PageDocumentActionState> {
  void previousState;
  const pageKeyValue = String(formData.get("page_key") || "");
  const authorized = await getAuthorizedPageAction(pageKeyValue);
  if (authorized.error) return authorized.error;
  const { adapter, supabase } = authorized;

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

  const { data: revisionId, error: revisionError } = await supabase.rpc("cms_page_document_save_draft", {
    p_page_key: adapter.pageKey,
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

  revalidatePageDocument(adapter.pageKey);

  return successState("Draft saved. Draft changes are private and are not visible on the public site; Published content remains unchanged.", revisionId ?? undefined);
}

export async function submitPageDocumentForReview(
  previousState: PageDocumentActionState,
  formData: FormData,
): Promise<PageDocumentActionState> {
  void previousState;
  const pageKey = String(formData.get("page_key") || "");
  const revisionId = String(formData.get("revision_id") || "");
  const authorized = await getAuthorizedPageAction(pageKey);
  if (authorized.error) return authorized.error;
  if (!revisionId) return errorState("The active Draft identity is missing. Reload the page and try again.");

  const { data: submittedRevisionId, error } = await authorized.supabase.rpc("cms_page_document_submit_for_review", {
    p_page_key: authorized.adapter.pageKey,
    p_revision_id: revisionId,
  });
  if (error || !submittedRevisionId) return errorState("The Draft could not be submitted for Review. Reload and try again.");

  revalidatePageDocument(authorized.adapter.pageKey);
  return successState("Submitted for Review. Review content is now immutable until an owner or editor returns it to Draft.", submittedRevisionId);
}

export async function returnPageDocumentToDraft(
  previousState: PageDocumentActionState,
  formData: FormData,
): Promise<PageDocumentActionState> {
  void previousState;
  const pageKey = String(formData.get("page_key") || "");
  const revisionId = String(formData.get("revision_id") || "");
  const authorized = await getAuthorizedPageAction(pageKey);
  if (authorized.error) return authorized.error;
  if (!revisionId) return errorState("The active Review identity is missing. Reload the page and try again.");

  const { data: returnedRevisionId, error } = await authorized.supabase.rpc("cms_page_document_return_to_draft", {
    p_page_key: authorized.adapter.pageKey,
    p_revision_id: revisionId,
  });
  if (error || !returnedRevisionId) return errorState("The Review could not be returned to Draft. Reload and try again.");

  revalidatePageDocument(authorized.adapter.pageKey);
  return successState("Returned to Draft. The content can be edited again and remains private.", returnedRevisionId);
}

function publishFailureMessage(message: string | undefined) {
  const normalized = message?.toLowerCase() ?? "";
  if (normalized.includes("changed") || normalized.includes("reload before publishing")) {
    return "This Review changed. Reload before publishing.";
  }
  if (normalized.includes("active review") || normalized.includes("page is not an approved") || normalized.includes("does not belong")) {
    return "This Review is no longer available for publishing. Reload the page and try again.";
  }
  return "Publish could not be completed. Reload the page and try again.";
}

export async function publishPageDocument(
  previousState: PageDocumentActionState,
  formData: FormData,
): Promise<PageDocumentActionState> {
  void previousState;
  const pageKey = String(formData.get("page_key") || "");
  const revisionId = String(formData.get("revision_id") || "");
  const expectedUpdatedAt = String(formData.get("expected_updated_at") || "");
  const authorized = await getAuthorizedOwnerPageAction(pageKey);
  if (authorized.error) return authorized.error;
  if (!revisionId || !expectedUpdatedAt) {
    return errorState("The active Review identity is missing. Reload the page and try again.");
  }

  const { data: publishedRevisionId, error } = await authorized.supabase.rpc("cms_page_document_publish", {
    p_page_key: authorized.adapter.pageKey,
    p_revision_id: revisionId,
    p_expected_updated_at: expectedUpdatedAt,
  });

  if (error || !publishedRevisionId) return errorState(publishFailureMessage(error?.message));

  revalidatePageDocument(authorized.adapter.pageKey);
  revalidatePath(authorized.adapter.route);
  return successState("Published. The new revision is now public and the previous Published revision is archived.", publishedRevisionId);
}
