"use client";

import { useState } from "react";
import AdminSubmitButton from "../AdminSubmitButton";

type DesignSettingsResetControlProps = {
  action: (formData: FormData) => void | Promise<void>;
};

function ResetConfirmationForm({ action, onCancel }: { action: (formData: FormData) => void | Promise<void>; onCancel: () => void }) {
  return (
    <form action={action}>
      <div className="admin-publish-confirmation-actions">
        <AdminSubmitButton label="Confirm Reset to Default" pendingLabel="Resetting…" />
        <button className="button admin-button-secondary" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function DesignSettingsResetControl({ action }: DesignSettingsResetControlProps) {
  const [confirmationOpen, setConfirmationOpen] = useState(false);

  return (
    <div className="admin-design-reset-control">
      <button className="button admin-button-secondary" type="button" onClick={() => setConfirmationOpen(true)}>
        Reset to Default
      </button>
      {confirmationOpen ? (
        <div className="admin-publish-confirmation" role="dialog" aria-modal="true" aria-labelledby="design-settings-reset-heading">
          <h3 id="design-settings-reset-heading">Reset all colors?</h3>
          <p>Return all eight color settings to the immutable OCSCO defaults? The change will remain private until the owner publishes it.</p>
          <ResetConfirmationForm action={action} onCancel={() => setConfirmationOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
