"use client";

import { useFormStatus } from "react-dom";

type AdminSubmitButtonProps = {
  label?: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  standalone?: boolean;
};

export default function AdminSubmitButton({
  label = "Save record",
  pendingLabel = "Saving…",
  variant = "primary",
  disabled = false,
  standalone = false,
}: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();
  const locked = pending || disabled;

  return (
    <button className={`button ${variant === "secondary" ? "admin-button-secondary" : "button-primary"} admin-submit${standalone ? " admin-submit-standalone" : ""}`} type="submit" disabled={locked}>
      {locked ? (
        <>
          <span className="admin-button-spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}
