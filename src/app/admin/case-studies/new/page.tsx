import Link from "next/link";
import { redirect } from "next/navigation";
import AdminAccountActions from "@/app/admin/AdminAccountActions";
import AdminSubmitButton from "@/app/admin/AdminSubmitButton";
import { canEditCaseStudies } from "@/lib/admin-case-studies";
import { getCmsMembership, getCmsRoleLabel } from "@/lib/cms-auth";
import { createClient } from "@/lib/supabase/server";

type NewCaseStudyPageProps = {
  searchParams: Promise<{ error?: string }>;
};

async function createCaseStudy(formData: FormData) {
  "use server";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/crimson-admin-control/login");
  }

  const membership = await getCmsMembership(user.id);
  if (!canEditCaseStudies(membership.role)) {
    redirect("/crimson-admin-control");
  }

  const projectName = String(formData.get("project_name") || "").trim();
  if (!projectName) {
    redirect("/crimson-admin-control/case-studies/new?error=Enter a project name to create the Draft.");
  }
  if (projectName.length > 180) {
    redirect("/crimson-admin-control/case-studies/new?error=Project names must be 180 characters or fewer.");
  }

  const { data, error } = await supabase.rpc("cms_create_case_study", {
    p_project_name: projectName,
  });

  if (error) {
    console.error("[case-studies] create Draft RPC failed", { error });
    redirect("/crimson-admin-control/case-studies/new?error=The Draft could not be created. Try again.");
  }

  const created = Array.isArray(data) ? data[0] : data;
  if (!created || typeof created.slug !== "string" || !created.slug) {
    console.error("[case-studies] create Draft RPC returned no Case Study identity");
    redirect("/crimson-admin-control/case-studies/new?error=The Draft could not be created. Try again.");
  }

  redirect(`/crimson-admin-control/case-studies/${created.slug}`);
}

export const dynamic = "force-dynamic";

export default async function NewCaseStudyPage({ searchParams }: NewCaseStudyPageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/crimson-admin-control/login");
  }

  const membership = await getCmsMembership(user.id);
  if (!canEditCaseStudies(membership.role)) {
    redirect("/crimson-admin-control");
  }

  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header">
          <div>
            <Link className="admin-brand" href="/">OCSCO</Link>
            <p className="admin-kicker">CMS / New case study</p>
          </div>
          <AdminAccountActions email={user.email} role={getCmsRoleLabel(membership)} backHref="/crimson-admin-control" />
        </header>

        <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/crimson-admin-control">Dashboard</Link>
          <span aria-hidden="true">/</span>
          <span>Work library</span>
          <span aria-hidden="true">/</span>
          <strong aria-current="page">New case study</strong>
        </nav>

        <section className="admin-editor-heading">
          <div>
            <p className="admin-kicker admin-kicker-green">Create → edit → review</p>
            <h1>Start a case study.</h1>
          </div>
          <div className="admin-editor-status">
            <strong>New Draft</strong>
            <span>Only the Project name is needed to begin.</span>
          </div>
        </section>

        <p className="admin-editor-warning">
          Create a private Draft, then continue in the existing Case Study editor. Content, media, related capabilities, and publication remain governed by the current workflow.
        </p>

        {query.error ? <p className="admin-error" role="alert">{query.error}</p> : null}

        <section className="admin-editor-panel">
          <form className="admin-editor-form" action={createCaseStudy}>
            <label className="admin-field-wide">
              Project name
              <input className="admin-input" name="project_name" maxLength={180} autoFocus required />
              <small>Use the approved project or working title. The Draft slug is generated automatically.</small>
            </label>
            <AdminSubmitButton label="Create Draft" pendingLabel="Creating Draft…" />
          </form>
        </section>

        <footer className="admin-footer">Drafts are private until they move through the existing review and publish workflow.</footer>
      </div>
    </main>
  );
}
