import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContent } from "@/lib/admin-content";
import { getCmsMembership } from "@/lib/cms-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const membership = await getCmsMembership(user.id);
  let content;
  let loadError = "";

  try {
    content = await getAdminContent();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load published CMS content.";
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <Link className="admin-brand" href="/">OCSCO</Link>
            <p className="admin-kicker">Staging CMS / Control room</p>
          </div>
          <div className="admin-header-actions">
            <span className="admin-user">{user.email}</span>
            <span className={`admin-role admin-role-${membership.role ?? "pending"}`}>
              {membership.role ?? "Role pending"}
            </span>
            <form action={signOut}>
              <button className="admin-signout" type="submit">Sign out</button>
            </form>
          </div>
        </header>

        <section className="admin-hero">
          <div>
            <p className="admin-kicker admin-kicker-green">Content control room</p>
            <h1>Staging content, in one place.</h1>
          </div>
          <p className="admin-intro">
            A safe staging view of the content currently exposed by the public website. Approved members can edit Services according to role; publishing and broader CMS controls remain restricted.
          </p>
        </section>

        {loadError ? (
          <section className="admin-alert" role="alert">
            <strong>Content could not be loaded.</strong>
            <span>{loadError}</span>
          </section>
        ) : content ? (
          <>
            {!membership.role ? (
              <section className="admin-role-alert" role="status">
                <strong>Membership is not assigned yet.</strong>
                <span>This account remains read-only. Assign an approved staging role in <code>public.cms_members</code> before adding any elevated workflow.</span>
              </section>
            ) : null}
            <section className="admin-section">
              <div className="admin-section-heading">
                <div>
                  <p className="admin-kicker">Published boundary</p>
                  <h2>What this role can read</h2>
                </div>
                <p className="admin-section-note">Authorized members can review non-archived service records here. The public website remains governed by the published-only RLS boundary.</p>
              </div>
              <div className="admin-stat-grid">
                {content.collections.map((collection) => (
                  <article className="admin-stat-card" key={collection.label}>
                    <span className="admin-stat-count">{collection.count}</span>
                    <h3>{collection.label}</h3>
                    <p>{collection.description}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="admin-section admin-record-grid">
              <div className="admin-record-panel">
                <div className="admin-panel-heading">
                  <div>
                    <p className="admin-kicker">Services</p>
                    <h2>Capabilities</h2>
                  </div>
                  <div className="admin-panel-heading-actions">
                    <span>{content.services.length} records</span>
                    <Link className="admin-panel-link" href={`/admin/services/${content.services[0]?.slug ?? "branding"}`}>
                      {membership.role === "owner" || membership.role === "editor" ? "Open editor" : "Review"} ↗
                    </Link>
                  </div>
                </div>
                <ul className="admin-record-list">
                  {content.services.map((service) => (
                    <li key={service.slug}><Link href={`/admin/services/${service.slug}`}>{service.name}</Link><small>{service.slug}</small></li>
                  ))}
                </ul>
              </div>
              <div className="admin-record-panel">
                <div className="admin-panel-heading">
                  <div>
                    <p className="admin-kicker">Work library</p>
                    <h2>Case studies</h2>
                  </div>
                  <span>{content.caseStudies.length} published</span>
                </div>
                <ul className="admin-record-list">
                  {content.caseStudies.map((caseStudy) => (
                    <li key={caseStudy.slug}><span>{caseStudy.project_name}</span><small>{caseStudy.slug}</small></li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        ) : null}

        <footer className="admin-footer">Staging only · Services are the first controlled editor slice.</footer>
      </div>
    </main>
  );
}
