import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCmsMembership } from "@/lib/cms-auth";
import { CMS_ROLES, getAdminMembers, inviteCmsMember, isCmsRole, updateCmsMemberRole, type AdminMember } from "@/lib/admin-members";
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

  if (!user) redirect("/admin/login");

  const membership = await getCmsMembership(user.id);
  if (membership.role !== "owner") redirect("/admin");

  return user;
}

async function inviteMember(formData: FormData) {
  "use server";

  await requireOwner();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "");

  if (!email || !email.includes("@") || !isCmsRole(role)) {
    redirect("/admin/team?error=Enter a valid email and approved role.");
  }

  try {
    await inviteCmsMember(email, role);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The invitation could not be created.";
    redirect(`/admin/team?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/team");
  redirect("/admin/team?saved=invited");
}

async function updateMemberRole(formData: FormData) {
  "use server";

  await requireOwner();
  const userId = String(formData.get("user_id") || "");
  const role = String(formData.get("role") || "");

  if (!userId || !isCmsRole(role)) redirect("/admin/team?error=Choose an approved role.");

  try {
    await updateCmsMemberRole(userId, role);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The role could not be updated.";
    redirect(`/admin/team?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/team");
  redirect("/admin/team?saved=role");
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
            <p className="admin-kicker">Staging CMS / Team &amp; access</p>
          </div>
          <AdminAccountActions email={user.email} role="owner" backHref="/admin" />
        </header>

        <AdminBreadcrumbs section="Team & access" record="Membership" />

        <section className="admin-editor-heading">
          <div>
            <p className="admin-kicker admin-kicker-green">Owner controls</p>
            <h1>Manage CMS access.</h1>
          </div>
          <p className="admin-intro">Invite approved team members and assign the smallest role they need. These controls affect staging access only.</p>
        </section>

        {saved === "invited" ? <AdminToast tone="success" message="Invitation created and CMS role assigned." /> : null}
        {saved === "role" ? <AdminToast tone="success" message="CMS role updated successfully." /> : null}
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
              <p className="admin-team-note">The invitation is sent through the staging Supabase Auth project. The selected role is applied after the invitation is created.</p>
              <form className="admin-form" action={inviteMember}>
                <label>
                  Email address
                  <input className="admin-input" name="email" type="email" placeholder="teammate@example.com" required />
                </label>
                <label>
                  Role
                  <AdminSelect name="role" defaultValue="editor" aria-label="Invite role">
                    {CMS_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
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
                <span>Staging only</span>
              </div>
              <ul className="admin-member-list">
                {members.map((member) => (
                  <li key={member.userId} className="admin-member-row">
                    <div className="admin-member-identity">
                      <strong>{member.email}</strong>
                      <small>Added {formatDate(member.createdAt)}</small>
                    </div>
                    <form className="admin-member-role-form" action={updateMemberRole}>
                      <input type="hidden" name="user_id" value={member.userId} />
                      <AdminSelect name="role" defaultValue={member.role} aria-label={`Role for ${member.email}`}>
                        {CMS_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                      </AdminSelect>
                      <AdminSubmitButton label="Update" pendingLabel="Updating…" variant="secondary" />
                    </form>
                  </li>
                ))}
              </ul>
              <p className="admin-team-footnote">Only owners can access this page. The last owner cannot be downgraded.</p>
            </section>
          </div>
        )}

        <footer className="admin-footer">Staging only · Membership changes are owner-controlled.</footer>
      </div>
    </main>
  );
}
