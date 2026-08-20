"use client";

import { useFormStatus } from "react-dom";

type RestoreButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export default function RestoreButton({ action }: RestoreButtonProps) {
  return (
    <form action={action} onSubmit={(event) => {
      if (!window.confirm("Restore this snapshot as Review? It will create a new audit entry and will not publish automatically.")) {
        event.preventDefault();
      }
    }}>
      <RestoreSubmitButton />
    </form>
  );
}

function RestoreSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="admin-audit-restore" type="submit" disabled={pending}>
      {pending ? (
        <>
          <span className="admin-button-spinner" aria-hidden="true" />
          Restoring…
        </>
      ) : "Restore as review"}
    </button>
  );
}
