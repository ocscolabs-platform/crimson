"use client";

import { useActionState, useRef, useState } from "react";
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
  const [state, formAction, pending] = useActionState(action, initialState);
  const [submitLocked, setSubmitLocked] = useState(false);
  const submitLockRef = useRef(false);
  const locked = pending || (submitLocked && state.status === "idle");

  if (!canMutate) return <p className="admin-disclosure-note">Reviewer access is read-only. No workflow transition controls are available.</p>;

  return (
    <div className="admin-page-workflow-controls">
      <form action={formAction} onSubmit={(event) => {
        if (state.status !== "idle") {
          submitLockRef.current = false;
          setSubmitLocked(false);
        }
        if (pending || submitLockRef.current) {
          event.preventDefault();
          return;
        }
        submitLockRef.current = true;
        setSubmitLocked(true);
      }}>
        <input type="hidden" name="page_key" value={pageKey} />
        <input type="hidden" name="revision_id" value={revisionId} />
        <AdminSubmitButton
          label={status === "draft" ? "Submit for Review" : "Return to Draft"}
          pendingLabel={status === "draft" ? "Submitting…" : "Returning…"}
          disabled={locked}
        />
      </form>
      {state.status === "success" ? <p className="admin-readonly-valid" role="status">{state.message}</p> : null}
      {state.status === "error" ? <p className="admin-alert" role="alert">{state.message}</p> : null}
    </div>
  );
}
