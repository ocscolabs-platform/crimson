"use client";

import { useActionState, useState } from "react";
import { publishPageDocument, type PageDocumentActionState } from "../actions";

const initialState: PageDocumentActionState = { status: "idle", message: "", issues: [] };

function PublishConfirmationForm({
  action,
  pending,
  pageKey,
  revisionId,
  expectedUpdatedAt,
  onCancel,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  pageKey: string;
  revisionId: string;
  expectedUpdatedAt: string;
  onCancel: () => void;
}) {
  const [submitLocked, setSubmitLocked] = useState(false);
  const locked = pending || submitLocked;

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (locked) {
          event.preventDefault();
          return;
        }
        setSubmitLocked(true);
      }}
    >
      <input type="hidden" name="page_key" value={pageKey} />
      <input type="hidden" name="revision_id" value={revisionId} />
      <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
      <div className="admin-publish-confirmation-actions">
        <button className="button button-primary admin-submit" type="submit" disabled={locked}>
          {locked ? "Publishing…" : "Confirm Publish changes"}
        </button>
        <button className="button admin-button-secondary" type="button" disabled={locked} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function PageDocumentPublishControl({
  pageKey,
  pageLabel,
  revisionId,
  expectedUpdatedAt,
  canPublish,
}: {
  pageKey: string;
  pageLabel: string;
  revisionId: string;
  expectedUpdatedAt: string;
  canPublish: boolean;
}) {
  const [state, formAction, pending] = useActionState(publishPageDocument, initialState);
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  if (!canPublish) return null;

  return (
    <div className="admin-page-workflow-controls" aria-live="polite">
      <button
        className="button button-primary admin-submit"
        type="button"
        disabled={pending}
        onClick={() => setConfirmationOpen(true)}
      >
        Publish changes <span aria-hidden="true">↗</span>
      </button>

      {confirmationOpen && state.status !== "success" ? (
        <div className="admin-publish-confirmation" role="dialog" aria-modal="true" aria-labelledby="page-document-publish-confirmation-heading">
          <h3 id="page-document-publish-confirmation-heading">Confirm Publish changes</h3>
          <p>
            Publish the <strong>{pageLabel}</strong> revision <code>{revisionId}</code> to the public site?
            This will move the current Review to Published, and the previous Published revision will become Archived.
          </p>
          <PublishConfirmationForm
            key={state.status}
            action={formAction}
            pending={pending}
            pageKey={pageKey}
            revisionId={revisionId}
            expectedUpdatedAt={expectedUpdatedAt}
            onCancel={() => setConfirmationOpen(false)}
          />
        </div>
      ) : null}

      {state.status === "success" ? <p className="admin-readonly-valid" role="status">{state.message}</p> : null}
      {state.status === "error" ? <p className="admin-alert" role="alert">{state.message}</p> : null}
    </div>
  );
}
