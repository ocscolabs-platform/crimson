import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContent } from "@/lib/admin-content";
import { getCmsMembership, getCmsRoleLabel } from "@/lib/cms-auth";
import { createClient } from "@/lib/supabase/server";
import AdminAccountActions from "@/app/admin/AdminAccountActions";
import AdminPendingLink from "@/app/admin/AdminPendingLink";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/crimson-admin-control/login");
  }

  const membership = await getCmsMembership(user.id);
  if (membership.accessScope === "insights_only") {
    redirect("/crimson-admin-control/insights");
  }
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
            <p className="admin-kicker">CMS / Control room</p>
          </div>
          <AdminAccountActions email={user.email} role={getCmsRoleLabel(membership)} />
        </header>

        <nav className="admin-nav" aria-label="CMS sections">
          <AdminPendingLink href="#overview" pendingLabel="Opening Overview…">Overview</AdminPendingLink>
          {membership.role ? <AdminPendingLink href="/crimson-admin-control/content" pendingLabel="Opening Global content…">Global content</AdminPendingLink> : null}
          {membership.role ? <AdminPendingLink href="/crimson-admin-control/content#design-settings" pendingLabel="Opening Design Settings…">Design Settings</AdminPendingLink> : null}
          {membership.role ? <AdminPendingLink href="/crimson-admin-control/content/pages" pendingLabel="Opening Pages…">Pages</AdminPendingLink> : null}
          {membership.role && (membership.role === "owner" || membership.accessScope === "full_cms" || membership.insightsAccess) ? <AdminPendingLink href="/crimson-admin-control/insights" pendingLabel="Opening Insights…">Insights</AdminPendingLink> : null}
          <AdminPendingLink href="#services-records" pendingLabel="Opening Services…" highlightTargetId="services-records">Services</AdminPendingLink>
          <AdminPendingLink href="#work-records" pendingLabel="Opening Work library…" highlightTargetId="work-records">Work library</AdminPendingLink>
          {membership.role === "owner" ? <AdminPendingLink href="/crimson-admin-control/team" pendingLabel="Opening Team & access…">Team &amp; access</AdminPendingLink> : null}
        </nav>

        <section className="admin-hero" id="overview">
          <div>
            <p className="admin-kicker admin-kicker-green">Content control room</p>
            <h1>Content, in one place.</h1>
          </div>
          <p className="admin-intro">
            A controlled view of the content currently exposed by the public website. Approved members can edit content according to role; publishing and broader controls remain restricted.
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
                <span>This account remains read-only. Assign an approved CMS role in <code>public.cms_members</code> before adding any elevated workflow.</span>
              </section>
            ) : null}
            <section className="admin-section">
              <div className="admin-section-heading">
                <div>
                  <p className="admin-kicker">Published boundary</p>
                  <h2>What this role can read</h2>
                </div>
                <p className="admin-section-note">Authorized members can review records available through the published read boundary. The public website remains governed by published-only RLS policies.</p>
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
              <div className="admin-record-panel" id="services-records">
                <div className="admin-panel-heading">
                  <div>
                    <p className="admin-kicker">Services</p>
                    <h2>Capabilities</h2>
                  </div>
                  <div className="admin-panel-heading-actions">
                    <span>{content.services.length} records</span>
                    <Link className="admin-panel-link" href={`/crimson-admin-control/services/${content.services[0]?.slug ?? "branding"}`}>
                      {membership.role === "owner" || membership.role === "editor" ? "Open editor" : "Review"} ↗
                    </Link>
                  </div>
                </div>
                <ul className="admin-record-list">
                  {content.services.map((service) => (
                    <li key={service.slug}><Link href={`/crimson-admin-control/services/${service.slug}`}>{service.name}</Link><small>{service.slug}</small></li>
                  ))}
                </ul>
              </div>
              <div className="admin-record-panel" id="work-records">
                <div className="admin-panel-heading">
                  <div>
                    <p className="admin-kicker">Work library</p>
                    <h2>Case studies</h2>
                  </div>
                  <div className="admin-panel-heading-actions">
                    <span>{content.caseStudies.length} published</span>
                    {membership.role === "owner" || membership.role === "editor" ? <Link className="button button-light" href="/crimson-admin-control/case-studies/new">+ New Case Study</Link> : null}
                    {content.caseStudies[0] ? (
                      <Link className="admin-panel-link" href={`/crimson-admin-control/case-studies/${content.caseStudies[0].slug}`}>Open review panel ↗</Link>
                    ) : null}
                  </div>
                </div>
                <ul className="admin-record-list">
                  {content.caseStudies.map((caseStudy) => (
                    <li key={caseStudy.slug}><Link href={`/crimson-admin-control/case-studies/${caseStudy.slug}`}>{caseStudy.project_name}</Link><small>{caseStudy.status} · {caseStudy.slug}</small></li>
                  ))}
                </ul>
              </div>
            </section>
          </>
        ) : null}

        <footer className="admin-footer">Content access is controlled by role.</footer>
      </div>
    </main>
  );
}
