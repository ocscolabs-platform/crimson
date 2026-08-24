import Link from "next/link";
import AdminAccountActions from "@/app/admin/AdminAccountActions";
import AdminBreadcrumbs from "@/app/admin/AdminBreadcrumbs";
import { requireCmsViewer } from "@/app/admin/content/pages/_lib";
import { getAdminPageDocumentReadModel } from "@/lib/admin-page-documents";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function statusClass(status: string) {
  return status === "published" ? "admin-status-ready" : status === "invalid" || status === "unavailable" ? "admin-status-muted" : "admin-status-pending";
}

export default async function AdminPagesIndex() {
  const { user, membership } = await requireCmsViewer();
  let model;
  let loadError = "";

  try {
    model = await getAdminPageDocumentReadModel();
  } catch {
    loadError = "The PageDocument management surface could not be loaded.";
  }

  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header">
          <div>
            <Link className="admin-brand" href="/crimson-admin-control">OCSCO</Link>
            <p className="admin-kicker">CMS / Pages</p>
          </div>
          <AdminAccountActions email={user.email} role={membership.role} backHref="/crimson-admin-control" />
        </header>

        <AdminBreadcrumbs section="Content" record="Pages" />

        <section className="admin-editor-heading">
          <div>
            <p className="admin-kicker admin-kicker-green">PageDocument foundation</p>
            <h1>Four pages, one controlled system.</h1>
          </div>
          <p className="admin-intro">Review the authoritative PageDocument state for the approved Phase 5 pages. Editing and publication actions will be introduced only in a later approved batch.</p>
        </section>

        <section className="admin-editor-panel" aria-labelledby="pages-list-heading">
          <div className="admin-panel-heading">
            <div>
              <p className="admin-kicker">Approved PageDocuments</p>
              <h2 id="pages-list-heading">Pages</h2>
            </div>
            <span className="admin-status-muted">Read-only foundation</span>
          </div>

          {loadError ? (
            <div className="admin-alert admin-page-foundation-alert" role="alert">
              <strong>Pages could not be loaded.</strong>
              <span>{loadError}</span>
            </div>
          ) : (
            <div className="admin-page-document-grid">
              {model?.pages.map((page) => (
                <article className="admin-page-document-card" key={page.adapter.pageKey}>
                  <div className="admin-page-document-card-heading">
                    <div>
                      <p className="admin-kicker">{page.adapter.pageKey}</p>
                      <h3>{page.adapter.label}</h3>
                    </div>
                    <span className={statusClass(page.currentState)}>{page.currentState}</span>
                  </div>
                  <dl className="admin-page-document-summary">
                    <div><dt>Public route</dt><dd><Link href={page.adapter.route}>{page.adapter.route}</Link></dd></div>
                    <div><dt>Published</dt><dd>{page.published.status === "published" ? "Available" : page.published.status}</dd></div>
                    <div><dt>Editorial revision</dt><dd>{page.activeRevision?.status ?? "None"}</dd></div>
                    <div><dt>Last updated</dt><dd>{formatDate(page.lastUpdatedAt)}</dd></div>
                  </dl>
                  <div className="admin-page-document-card-actions">
                    <Link className="admin-panel-link" href={`/crimson-admin-control/content/pages/${page.adapter.pageKey}`}>Open read-only foundation ↗</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="admin-page-document-lower">
          <p className="admin-editor-note admin-page-document-legacy-note">Work remains a legacy page and is intentionally excluded from this PageDocument management surface. Legacy page-section controls and anti-drift guards remain unchanged.</p>
          <footer className="admin-footer">PageDocument content is read-only in Batch 1.</footer>
        </div>
      </div>
    </main>
  );
}
