"use client";

import { useFormStatus } from "react-dom";

type AdminSubmitButtonProps = {
  label?: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "light";
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
  const variantClass = variant === "primary" ? "button-primary" : variant === "secondary" ? "admin-button-secondary" : "button-light";

  return (
    <button className={`button ${variantClass} admin-submit${standalone ? " admin-submit-standalone" : ""}`} type="submit" disabled={locked}>
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
