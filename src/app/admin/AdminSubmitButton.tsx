"use client";

import { useFormStatus } from "react-dom";

type AdminSubmitButtonProps = {
  label?: string;
  pendingLabel?: string;
};

export default function AdminSubmitButton({
  label = "Save staging record",
  pendingLabel = "Saving…",
}: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className="button button-primary admin-submit" type="submit" disabled={pending}>
      {pending ? (
        <>
          <span className="admin-button-spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        <>
          {label} <span aria-hidden="true">↗</span>
        </>
      )}
    </button>
  );
}
