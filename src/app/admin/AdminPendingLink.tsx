"use client";

import Link, { type LinkProps } from "next/link";
import { type MouseEvent, type ReactNode, useRef, useState } from "react";
import { useEffect } from "react";

type AdminPendingLinkProps = LinkProps & {
  children: ReactNode;
  pendingLabel: ReactNode;
  highlightTargetId?: string;
  className?: string;
};

export default function AdminPendingLink({ children, pendingLabel, highlightTargetId, className, onClick, ...props }: AdminPendingLinkProps) {
  const [pending, setPending] = useState(false);
  const highlightTimeout = useRef<number | null>(null);
  const samePageNavigation = typeof props.href === "string" && props.href.startsWith("#");

  useEffect(() => {
    if (!pending || !samePageNavigation) return;
    const timeout = window.setTimeout(() => setPending(false), 450);
    return () => window.clearTimeout(timeout);
  }, [pending, samePageNavigation]);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (pending) {
      event.preventDefault();
      return;
    }

    setPending(true);
    if (highlightTargetId) {
      const target = document.getElementById(highlightTargetId);
      if (target) {
        if (highlightTimeout.current) window.clearTimeout(highlightTimeout.current);
        target.classList.remove("admin-anchor-highlight");
        void target.offsetWidth;
        target.classList.add("admin-anchor-highlight");
        highlightTimeout.current = window.setTimeout(() => {
          target.classList.remove("admin-anchor-highlight");
          highlightTimeout.current = null;
        }, 1800);
      }
    }
    onClick?.(event);
  }

  return (
    <Link
      {...props}
      className={["admin-pending-link", className].filter(Boolean).join(" ")}
      aria-disabled={pending ? "true" : undefined}
      tabIndex={pending ? -1 : undefined}
      onClick={handleClick}
    >
      {pending ? <><span>{pendingLabel}</span><span className="admin-button-spinner" aria-hidden="true" /></> : children}
    </Link>
  );
}
