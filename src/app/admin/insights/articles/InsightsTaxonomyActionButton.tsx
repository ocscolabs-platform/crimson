"use client";

import { useState, type ReactNode } from "react";

type InsightsTaxonomyActionButtonProps = {
  className: string;
  disabled?: boolean;
  idleContent: ReactNode;
  onAction: () => Promise<void>;
  pendingLabel: string;
};

export default function InsightsTaxonomyActionButton({ className, disabled = false, idleContent, onAction, pendingLabel }: InsightsTaxonomyActionButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending || disabled) return;
    setPending(true);
    try {
      await onAction();
    } finally {
      setPending(false);
    }
  }

  return (
    <button className={className} type="button" onClick={handleClick} disabled={pending || disabled} aria-busy={pending || undefined}>
      {pending ? <><span className="admin-button-spinner" aria-hidden="true" />{pendingLabel}</> : idleContent}
    </button>
  );
}
