"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";

type AdminDeleteButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  label: string;
  confirmation: string;
};

export default function AdminDeleteButton({ action, label, confirmation }: AdminDeleteButtonProps) {
  return (
    <form action={action} onSubmit={(event) => {
      if (!window.confirm(confirmation)) {
        event.preventDefault();
      }
    }}>
      <DeleteSubmitButton label={label} />
    </form>
  );
}

function DeleteSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="admin-media-remove" type="submit" disabled={pending} aria-label={label} title={label}>
      {pending ? <span className="admin-button-spinner" aria-hidden="true" /> : <Trash2 aria-hidden="true" size={15} strokeWidth={1.8} />}
      <span className="sr-only">{label}</span>
    </button>
  );
}
