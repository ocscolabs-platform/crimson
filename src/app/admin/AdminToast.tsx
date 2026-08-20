"use client";

import { useEffect, useState } from "react";

type AdminToastProps = {
  tone: "success" | "error";
  message: string;
};

export default function AdminToast({ tone, message }: AdminToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (tone !== "success") {
      return;
    }

    const timeout = window.setTimeout(() => setVisible(false), 6000);
    return () => window.clearTimeout(timeout);
  }, [tone]);

  if (!visible) {
    return null;
  }

  return (
    <div className={"admin-toast admin-toast-" + tone} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      <span>{message}</span>
      <button className="admin-toast-close" type="button" onClick={() => setVisible(false)} aria-label="Dismiss notification">×</button>
    </div>
  );
}
