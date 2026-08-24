import Link from "next/link";
import { notFound } from "next/navigation";
import AdminAccountActions from "@/app/admin/AdminAccountActions";
import AdminBreadcrumbs from "@/app/admin/AdminBreadcrumbs";
import { requireCmsViewer } from "@/app/admin/content/pages/_lib";
import PageDocumentReadOnly, { ReadOnlySeoPanel } from "@/app/admin/content/pages/_components/PageDocumentReadOnly";
import PageDocumentEditor from "@/app/admin/content/pages/_components/PageDocumentEditor";
import { getAdminPageDocumentReadModel, getPageDocumentAdminAdapter } from "@/lib/admin-page-documents";

export const dynamic = "force-dynamic";

type AdminPageDocumentPageProps = {
  params: Promise<{ pageKey: string }>;
};

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function statusClass(status: string) {
  return status === "published" ? "admin-status-ready" : status === "invalid" || status === "unavailable" ? "admin-status-muted" : "admin-status-pending";
}

function ValidationState({ issues }: { issues: string[] }) {
  if (issues.length === 0) {
    return <p className="admin-readonly-valid" role="status">PageDocument passes the shared canonical validator.</p>;
  }

  return (
    <div className="admin-alert" role="alert">
      <strong>PageDocument validation failed.</strong>
      <span>The stored content is not presented as an editable document.</span>
      <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
    </div>
  );
}

export default async function AdminPageDocumentPage({ params }: AdminPageDocumentPageProps) {
  const { pageKey } = await params;
  const adapter = getPageDocumentAdminAdapter(pageKey);
  if (!adapter) notFound();

  const { user, membership } = await requireCmsViewer();
  let model;
  let loadError = "";

  try {
    model = await getAdminPageDocumentReadModel();
  } catch {
    loadError = "The PageDocument record could not be loaded.";
  }

  const page = model?.pages.find((candidate) => candidate.adapter.pageKey === adapter.pageKey);
  const activeDocument = page?.activeRevision?.document ?? null;
  const publishedDocument = page?.published.document ?? null;
  const roleMessage = membership.role === "reviewer"
    ? "Reviewer access is read-only. Mutation controls are not available."
      : "You can edit approved structured content and save a private Draft. Publish, Restore, and Preview remain deferred.";
  const authorityMessage = adapter.pageKey === "services"
    ? "The PageDocument owns the Services page shell. Canonical public.services records remain authoritative for Service names, descriptions, icons, and detail links."
    : adapter.pageKey === "contact"
      ? "The PageDocument owns approved Contact marketing content. The functional ContactForm, validation, inquiry API, service options, and submission behavior remain code-controlled."
      : null;

  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header">
          <div>
            <Link className="admin-brand" href="/crimson-admin-control">OCSCO</Link>
            <p className="admin-kicker">CMS / Pages / {adapter.label}</p>
          </div>
          <AdminAccountActions email={user.email} role={membership.role} backHref="/crimson-admin-control/content/pages" />
        </header>

        <AdminBreadcrumbs section="Content" record={adapter.label} />

        <section className="admin-editor-heading">
          <div>
            <p className="admin-kicker admin-kicker-green">PageDocument foundation</p>
            <h1>{adapter.label}</h1>
            <p className="admin-public-route">Public route: <Link href={adapter.route}>{adapter.route}</Link></p>
          </div>
          <div className="admin-editor-status">
            <span>Current state</span>
            <strong className={statusClass(page?.currentState ?? "unavailable")}>{page?.currentState ?? "unavailable"}</strong>
            <span>Last updated {formatDate(page?.lastUpdatedAt ?? null)}</span>
          </div>
        </section>

        <section className="admin-editor-panel" aria-labelledby="page-document-access-heading">
          <div className="admin-role-alert" role="status">
            <strong id="page-document-access-heading">Your {membership.role} access</strong>
            <span>{roleMessage}</span>
          </div>
        </section>

        {loadError || !page ? (
          <section className="admin-editor-panel">
            <div className="admin-alert" role="alert">
              <strong>PageDocument unavailable.</strong>
              <span>{loadError || "This approved page record is not available in the current CMS read model."}</span>
            </div>
          </section>
        ) : (
          <>
            <section className="admin-editor-panel" aria-labelledby="published-page-heading">
              <div className="admin-panel-heading">
                <div>
                  <p className="admin-kicker">Public boundary</p>
                  <h2 id="published-page-heading">Published version</h2>
                </div>
                <span className={statusClass(page.published.status)}>{page.published.status}</span>
              </div>
              <p className="admin-disclosure-note">This is the version available to the published-only public loader. It is separate from any active editorial revision.</p>
              <p className="admin-editor-note">Published {formatDate(page.publishedAt)} · Last reviewed {formatDate(page.lastReviewedAt)}</p>
              <ValidationState issues={page.published.validationIssues} />
              {!publishedDocument ? null : membership.role === "reviewer" ? <div className="admin-readonly-document-stack"><ReadOnlySeoPanel document={publishedDocument} idSuffix="published" /><PageDocumentReadOnly document={publishedDocument} idSuffix="published" /></div> : <p className="admin-disclosure-note">The authoritative published PageDocument is shown below through the structured editor. Draft changes remain private until a later approved publication workflow.</p>}
            </section>

            <section className="admin-editor-panel" aria-labelledby="active-page-heading">
              <div className="admin-panel-heading">
                <div>
                  <p className="admin-kicker">Editorial boundary</p>
                  <h2 id="active-page-heading">Current editorial revision</h2>
                </div>
                <span className={statusClass(page.activeRevision?.status ?? "unavailable")}>{page.activeRevision?.status ?? "none"}</span>
              </div>
              {page.activeRevision ? (
                <>
                  <p className="admin-disclosure-note">Draft and Review content is private and is never used by the public route.</p>
                  <p className="admin-editor-note">Created {formatDate(page.activeRevision.createdAt)} · Updated {formatDate(page.activeRevision.updatedAt)}</p>
                  <ValidationState issues={page.activeRevision.validationIssues} />
                  {activeDocument && membership.role === "reviewer" ? <div className="admin-readonly-document-stack"><ReadOnlySeoPanel document={activeDocument} idSuffix="active" /><PageDocumentReadOnly document={activeDocument} idSuffix="active" /></div> : null}
                </>
              ) : <p className="admin-empty-state">No active Draft or Review revision exists for this page.</p>}
            </section>

            <section className="admin-editor-panel" aria-labelledby="page-document-editor-heading">
              <div className="admin-panel-heading">
                <div>
                  <p className="admin-kicker">Structured editor</p>
                  <h2 id="page-document-editor-heading">PageDocument content</h2>
                </div>
                <span className={membership.role === "reviewer" ? "admin-status-muted" : "admin-status-ready"}>{membership.role === "reviewer" ? "Read-only" : "Draft only"}</span>
              </div>
              {membership.role === "reviewer" ? (
                <p className="admin-disclosure-note">Reviewer access remains read-only. Owner and editor roles can edit approved fields and save Draft revisions; no publication controls are available in Batch 2.</p>
              ) : (activeDocument ?? publishedDocument) ? (
                <PageDocumentEditor initialDocument={(activeDocument ?? publishedDocument)!} />
              ) : (
                <p className="admin-empty-state">A valid PageDocument is not available for editing.</p>
              )}
            </section>

            <section className="admin-editor-panel" aria-labelledby="legacy-boundary-heading">
              <div className="admin-panel-heading">
                <div>
                  <p className="admin-kicker">Transition boundary</p>
                  <h2 id="legacy-boundary-heading">Legacy controls preserved</h2>
                </div>
                <span className="admin-status-muted">Read-only</span>
              </div>
              <p className="admin-disclosure-note">The existing page-section records and anti-drift guards remain unchanged. PageDocument editing now uses the approved structured editor; Work remains legacy and is excluded.</p>
              {authorityMessage ? <p className="admin-editor-note">{authorityMessage}</p> : null}
            </section>
          </>
        )}

        <footer className="admin-footer">Publish, Restore, and authenticated Preview remain deferred to later approved batches.</footer>
      </div>
    </main>
  );
}
