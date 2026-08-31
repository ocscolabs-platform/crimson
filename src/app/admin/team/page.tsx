import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCmsMembership } from "@/lib/cms-auth";
import { CMS_ROLE_LABELS, CMS_ROLES, getAdminMembers, inviteCmsMember, isAssignableCmsRole, setCmsMemberTemporaryPassword, updateCmsMemberRole, type AdminMember } from "@/lib/admin-members";
import { createClient } from "@/lib/supabase/server";
import AdminBreadcrumbs from "@/app/admin/AdminBreadcrumbs";
import AdminSelect from "@/app/admin/AdminSelect";
import AdminSubmitButton from "@/app/admin/AdminSubmitButton";
import AdminToast from "@/app/admin/AdminToast";
import AdminAccountActions from "@/app/admin/AdminAccountActions";

export const dynamic = "force-dynamic";

type TeamPageProps = {
  searchParams: Promise<{ error?: string; saved?: string }>;
};

async function requireOwner() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/crimson-admin-control/login");

  const membership = await getCmsMembership(user.id);
  if (membership.role !== "owner") redirect("/crimson-admin-control");

  return user;
}

async function inviteMember(formData: FormData) {
  "use server";

  await requireOwner();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "");

  if (!email || !email.includes("@") || !isAssignableCmsRole(role)) {
    redirect("/crimson-admin-control/team?error=Enter a valid email and approved role.");
  }

  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",", 1)[0];
    const origin = host ? `${forwardedProtocol || "https"}://${host}` : "https://www.ocsco.io";
    const redirectTo = `${origin}/crimson-admin-control/invite`;

    await inviteCmsMember(email, role, redirectTo);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The invitation could not be created.";
    redirect(`/crimson-admin-control/team?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/team");
  redirect("/crimson-admin-control/team?saved=invited");
}

async function updateMemberRole(formData: FormData) {
  "use server";

  await requireOwner();
  const userId = String(formData.get("user_id") || "");
  const role = String(formData.get("role") || "");

  if (!userId || !isAssignableCmsRole(role)) redirect("/crimson-admin-control/team?error=Choose an approved role.");

  try {
    await updateCmsMemberRole(userId, role);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The role could not be updated.";
    redirect(`/crimson-admin-control/team?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/team");
  redirect("/crimson-admin-control/team?saved=role");
}

async function setTemporaryPassword(formData: FormData) {
  "use server";

  await requireOwner();
  const userId = String(formData.get("user_id") || "");
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("password_confirmation") || "");

  if (!userId || password.length < 8) {
    redirect("/crimson-admin-control/team?error=Use at least 8 characters for the temporary password.");
  }

  if (password !== confirmation) {
    redirect("/crimson-admin-control/team?error=The temporary passwords do not match.");
  }

  try {
    await setCmsMemberTemporaryPassword(userId, password);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The temporary password could not be set. Try again.";
    redirect(`/crimson-admin-control/team?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/team");
  redirect("/crimson-admin-control/team?saved=password");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminTeamPage({ searchParams }: TeamPageProps) {
  const user = await requireOwner();
  const { error, saved } = await searchParams;
  let members: AdminMember[] = [];
  let loadError = "";

  try {
    members = await getAdminMembers();
  } catch (loadFailure) {
    loadError = loadFailure instanceof Error ? loadFailure.message : "The CMS membership list could not be loaded.";
  }

  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header">
          <div>
            <Link className="admin-brand" href="/">OCSCO</Link>
            <p className="admin-kicker">CMS / Team &amp; access</p>
          </div>
          <AdminAccountActions email={user.email} role="owner" backHref="/crimson-admin-control" />
        </header>

        <AdminBreadcrumbs section="Team & access" record="Membership" />

        <section className="admin-editor-heading">
          <div>
            <p className="admin-kicker admin-kicker-green">Owner controls</p>
            <h1>Manage CMS access.</h1>
          </div>
          <p className="admin-intro">Invite approved team members and assign the smallest role they need. These controls affect CMS access only.</p>
        </section>

        {saved === "invited" ? <AdminToast tone="success" message="Invitation created and CMS role assigned." /> : null}
        {saved === "role" ? <AdminToast tone="success" message="CMS role updated successfully." /> : null}
        {saved === "password" ? <AdminToast tone="success" message="✓ Temporary password updated." /> : null}
        {error ? <AdminToast tone="error" message={error} /> : null}

        {loadError ? (
          <section className="admin-alert" role="alert">
            <strong>Memberships could not be loaded.</strong>
            <span>{loadError}</span>
          </section>
        ) : (
          <div className="admin-team-layout">
            <section className="admin-team-card">
              <p className="admin-kicker">Add member</p>
              <h2>Invite a teammate.</h2>
              <p className="admin-team-note">The invitation is sent through the configured Supabase Auth project. The selected role is applied after the invitation is created.</p>
              <form className="admin-form" action={inviteMember}>
                <label>
                  Email address
                  <input className="admin-input" name="email" type="email" placeholder="teammate@example.com" required />
                </label>
                <label>
                  Role
                  <AdminSelect name="role" defaultValue="editor" aria-label="Invite role">
                    {CMS_ROLES.map((role) => <option key={role} value={role}>{CMS_ROLE_LABELS[role]}</option>)}
                  </AdminSelect>
                </label>
                <AdminSubmitButton label="Send invitation" pendingLabel="Inviting…" />
              </form>
            </section>

            <section className="admin-team-card">
              <div className="admin-panel-heading">
                <div>
                  <p className="admin-kicker">Current access</p>
                  <h2>{members.length} member{members.length === 1 ? "" : "s"}</h2>
                </div>
                <span>Role-controlled</span>
              </div>
              <ul className="admin-member-list">
                {members.map((member) => (
                  <li key={member.userId} className="admin-member-row">
                    <div className="admin-member-identity">
                      <strong>{member.email}</strong>
                      <small>Added {formatDate(member.createdAt)}</small>
                    </div>
                    <div className="admin-member-actions">
                      {member.role === "reviewer" ? (
                        <div className="admin-member-role-legacy" role="status">
                          <span className="admin-role admin-role-reviewer">Reviewer (legacy)</span>
                          <small>Existing access is retained. Choose Owner or Editor to change this role.</small>
                        </div>
                      ) : null}
                      <form className="admin-member-role-form" action={updateMemberRole}>
                        <input type="hidden" name="user_id" value={member.userId} />
                        <AdminSelect name="role" defaultValue={member.role === "reviewer" ? "" : member.role} aria-label={`Role for ${member.email}`} required={member.role === "reviewer"}>
                          {member.role === "reviewer" ? <option value="" disabled>Choose new role</option> : null}
                          {CMS_ROLES.map((role) => <option key={role} value={role}>{CMS_ROLE_LABELS[role]}</option>)}
                        </AdminSelect>
                        <AdminSubmitButton label="Update" pendingLabel="Updating…" variant="secondary" />
                      </form>
                      {member.role !== "owner" ? (
                        <details className="admin-member-password">
                          <summary className="admin-button-secondary">Set temporary password</summary>
                          <form className="admin-member-password-form" action={setTemporaryPassword}>
                            <input type="hidden" name="user_id" value={member.userId} />
                            <label>
                              New temporary password
                              <input className="admin-input" name="password" type="password" autoComplete="new-password" minLength={8} required />
                            </label>
                            <label>
                              Confirm temporary password
                              <input className="admin-input" name="password_confirmation" type="password" autoComplete="new-password" minLength={8} required />
                            </label>
                            <AdminSubmitButton label="Set password" pendingLabel="Setting password…" variant="secondary" />
                          </form>
                        </details>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="admin-team-footnote">Only owners can access this page. The last owner cannot be downgraded.</p>
            </section>
          </div>
        )}

        <footer className="admin-footer">Membership changes are owner-controlled.</footer>
      </div>
    </main>
  );
}
