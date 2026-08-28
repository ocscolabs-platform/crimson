"use client";

import Link, { type LinkProps } from "next/link";
import { type MouseEvent, type ReactNode, useState } from "react";

type AdminPendingLinkProps = LinkProps & {
  children: ReactNode;
  pendingLabel: ReactNode;
  className?: string;
};

export default function AdminPendingLink({ children, pendingLabel, className, onClick, ...props }: AdminPendingLinkProps) {
  const [pending, setPending] = useState(false);

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
      className={className}
      aria-disabled={pending ? "true" : undefined}
      tabIndex={pending ? -1 : undefined}
      onClick={handleClick}
    >
      {pending ? pendingLabel : children}
    </Link>
  );
}
