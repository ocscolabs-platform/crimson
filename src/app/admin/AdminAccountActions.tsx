import Link from "next/link";
import { signOut } from "@/app/admin/actions";
import SignOutButton from "@/app/admin/SignOutButton";

type AdminAccountActionsProps = {
  email?: string | null;
  role?: string | null;
  backHref?: string;
};

export default function AdminAccountActions({ email, role, backHref }: AdminAccountActionsProps) {
  return (
    <div className="admin-header-actions-wrap">
      {backHref ? (
        <Link className="admin-header-back" href={backHref}>
          Back to dashboard
        </Link>
      ) : null}
      <div className="admin-header-actions">
        <div className="admin-account-identity">
          <span className="admin-account-label">Signed in as</span>
          <span className="admin-user">{email || "Unknown account"}</span>
        </div>
        <span className={`admin-role admin-role-${role ?? "pending"}`}>
          {role ?? "Role pending"}
        </span>
        <form action={signOut}>
          <SignOutButton />
        </form>
      </div>
    </div>
  );
}
