"use client";

import { useFormStatus } from "react-dom";

export default function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <button className="admin-signout" type="submit" disabled={pending}>
      {pending ? <><span className="admin-button-spinner" aria-hidden="true" /> Signing out…</> : "Sign out"}
    </button>
  );
}
