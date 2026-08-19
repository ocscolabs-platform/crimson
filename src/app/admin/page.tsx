import { redirect } from "next/navigation";
import Link from "next/link";
import { getPublishedAdminContent } from "@/lib/admin-content";
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

  let content;
  let loadError = "";

  try {
    content = await getPublishedAdminContent();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load published CMS content.";
  }

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-header">
          <div>
            <Link className="admin-brand" href="/">OCSCO</Link>
            <p className="admin-kicker">Staging CMS / Read-only</p>
          </div>
          <div className="admin-header-actions">
            <span className="admin-user">{user.email}</span>
            <form action={signOut}>
              <button className="admin-signout" type="submit">Sign out</button>
            </form>
          </div>
        </header>

        <section className="admin-hero">
          <div>
            <p className="admin-kicker admin-kicker-green">Content control room</p>
            <h1>Published content, in one place.</h1>
          </div>
          <p className="admin-intro">
            A safe staging view of the content currently exposed by the public website. Editing and publishing controls will be added only after roles and permissions are approved.
          </p>
        </section>

        {loadError ? (
          <section className="admin-alert" role="alert">
            <strong>Content could not be loaded.</strong>
            <span>{loadError}</span>
          </section>
        ) : content ? (
          <>
            <section className="admin-section">
              <div className="admin-section-heading">
                <div>
                  <p className="admin-kicker">Published boundary</p>
                  <h2>What the public site can read</h2>
                </div>
                <p className="admin-section-note">These records are read through the authenticated session but remain governed by the existing published-only RLS policies.</p>
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
                  <span>{content.services.length} published</span>
                </div>
                <ul className="admin-record-list">
                  {content.services.map((service) => (
                    <li key={service.slug}><span>{service.name}</span><small>{service.slug}</small></li>
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

        <footer className="admin-footer">Staging only · No editing or publishing actions are enabled.</footer>
      </div>
    </main>
  );
}
