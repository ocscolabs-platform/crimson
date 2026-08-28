"use client";

import Link, { type LinkProps } from "next/link";
import { type MouseEvent, type ReactNode, useState } from "react";
import { useEffect } from "react";

type AdminPendingLinkProps = LinkProps & {
  children: ReactNode;
  pendingLabel: ReactNode;
  className?: string;
};

export default function AdminPendingLink({ children, pendingLabel, className, onClick, ...props }: AdminPendingLinkProps) {
  const [pending, setPending] = useState(false);
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
