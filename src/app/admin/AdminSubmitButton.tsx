"use client";

import { useFormStatus } from "react-dom";

type AdminSubmitButtonProps = {
  label?: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
};

export default function AdminSubmitButton({
  label = "Save record",
  pendingLabel = "Saving…",
  variant = "primary",
}: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={`button ${variant === "secondary" ? "admin-button-secondary" : "button-primary"} admin-submit`} type="submit" disabled={pending}>
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
