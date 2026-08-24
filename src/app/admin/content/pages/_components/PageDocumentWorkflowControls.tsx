"use client";

import { useActionState } from "react";
import AdminSubmitButton from "@/app/admin/AdminSubmitButton";
import {
  returnPageDocumentToDraft,
  submitPageDocumentForReview,
  type PageDocumentActionState,
} from "../actions";

const initialState: PageDocumentActionState = { status: "idle", message: "", issues: [] };

export default function PageDocumentWorkflowControls({
  pageKey,
  revisionId,
  status,
  canMutate,
}: {
  pageKey: string;
  revisionId: string;
  status: "draft" | "review";
  canMutate: boolean;
}) {
  const action = status === "draft" ? submitPageDocumentForReview : returnPageDocumentToDraft;
  const [state, formAction] = useActionState(action, initialState);

  if (!canMutate) return <p className="admin-disclosure-note">Reviewer access is read-only. No workflow transition controls are available.</p>;

  return (
    <div className="admin-page-workflow-controls">
      <form action={formAction}>
        <input type="hidden" name="page_key" value={pageKey} />
        <input type="hidden" name="revision_id" value={revisionId} />
        <AdminSubmitButton
          label={status === "draft" ? "Submit for Review" : "Return to Draft"}
          pendingLabel={status === "draft" ? "Submitting…" : "Returning…"}
        />
      </form>
      {state.status === "success" ? <p className="admin-readonly-valid" role="status">{state.message}</p> : null}
      {state.status === "error" ? <p className="admin-alert" role="alert">{state.message}</p> : null}
    </div>
  );
}
