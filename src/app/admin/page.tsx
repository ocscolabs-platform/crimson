import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminContent } from "@/lib/admin-content";
import { getCmsMembership } from "@/lib/cms-auth";
import { createClient } from "@/lib/supabase/server";
import AdminAccountActions from "@/app/admin/AdminAccountActions";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/crimson-admin-control/login");
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
            <p className="admin-kicker">CMS / Control room</p>
          </div>
          <AdminAccountActions email={user.email} role={membership.role} />
        </header>

        <nav className="admin-nav" aria-label="CMS sections">
          <Link href="#overview">Overview</Link>
          {membership.role ? <Link href="/crimson-admin-control/content">Global content</Link> : null}
          <Link href="#services-records">Services</Link>
          <Link href="#work-records">Work library</Link>
          {membership.role === "owner" ? <Link href="/crimson-admin-control/team">Team &amp; access</Link> : null}
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
