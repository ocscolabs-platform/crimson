"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { restorePageDocument, type PageDocumentActionState } from "../actions";

const initialState: PageDocumentActionState = { status: "idle", message: "", issues: [] };

export default function PageDocumentRestoreControl({
  pageKey,
  pageLabel,
  sourceRevisionId,
  historicalTimestamp,
  hasActiveEditorialRevision,
}: {
  pageKey: string;
  pageLabel: string;
  sourceRevisionId: string;
  historicalTimestamp: string;
  hasActiveEditorialRevision: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(restorePageDocument, initialState);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const locked = pending || (submitLocked && state.status === "idle");

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
      const resetTimer = window.setTimeout(() => {
        setConfirmationOpen(false);
        setSubmitLocked(false);
        setShowSuccess(true);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    } else if (state.status === "error") {
      const resetTimer = window.setTimeout(() => {
        setSubmitLocked(false);
        setShowSuccess(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
  }, [router, state.status, state.revisionId]);

  return (
    <div className="admin-page-restore-control" aria-live="polite">
      <button
        className="button admin-button-secondary admin-restore-trigger"
        type="button"
        disabled={pending}
        onClick={() => {
          setShowSuccess(false);
          setConfirmationOpen(true);
        }}
      >
        Restore revision
      </button>

      {confirmationOpen ? (
        <div className="admin-restore-confirmation" role="dialog" aria-modal="true" aria-labelledby={`restore-${sourceRevisionId}-heading`}>
          <h3 id={`restore-${sourceRevisionId}-heading`}>Restore historical page version?</h3>
          <p>
            Restore the <strong>{pageLabel}</strong> version from <strong>{historicalTimestamp}</strong> as a new Review.
            The public site will <strong>not</strong> change; a later Publish is required to make this version public.
          </p>
          {hasActiveEditorialRevision ? (
            <p>
              The current editorial revision will be Archived and preserved, including its revision identity and history.
              The restored Review will receive a new revision ID.
            </p>
          ) : null}
          <form
            action={formAction}
            onSubmit={(event) => {
              if (locked) {
                event.preventDefault();
                return;
              }
              setSubmitLocked(true);
            }}
          >
            <input type="hidden" name="page_key" value={pageKey} />
            <input type="hidden" name="source_revision_id" value={sourceRevisionId} />
            <div className="admin-restore-confirmation-actions">
              <button className="button button-primary admin-submit" type="submit" disabled={locked}>
                {locked ? "Restoring…" : "Confirm Restore revision"}
              </button>
              <button className="button admin-button-secondary" type="button" disabled={locked} onClick={() => setConfirmationOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {state.status === "success" && showSuccess ? <p className="admin-readonly-valid" role="status">{state.message}</p> : null}
      {state.status === "error" ? <p className="admin-alert" role="alert">{state.message}</p> : null}
    </div>
  );
}
