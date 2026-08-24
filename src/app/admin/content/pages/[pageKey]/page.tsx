import Link from "next/link";
import { notFound } from "next/navigation";
import AdminAccountActions from "@/app/admin/AdminAccountActions";
import AdminBreadcrumbs from "@/app/admin/AdminBreadcrumbs";
import { requireCmsViewer } from "@/app/admin/content/pages/_lib";
import PageDocumentReadOnly, { ReadOnlySeoPanel } from "@/app/admin/content/pages/_components/PageDocumentReadOnly";
import PageDocumentEditor from "@/app/admin/content/pages/_components/PageDocumentEditor";
import PageDocumentWorkflowControls from "@/app/admin/content/pages/_components/PageDocumentWorkflowControls";
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

function actionLabel(action: string) {
  return action.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}

function PageDocumentHistory({
  history,
  audit,
}: {
  history: NonNullable<Awaited<ReturnType<typeof getAdminPageDocumentReadModel>>>["pages"][number]["revisionHistory"];
  audit: NonNullable<Awaited<ReturnType<typeof getAdminPageDocumentReadModel>>>["pages"][number]["auditHistory"];
}) {
  return (
    <section className="admin-editor-panel" aria-labelledby="page-document-history-heading">
      <div className="admin-panel-heading">
        <div>
          <p className="admin-kicker">Immutable record</p>
          <h2 id="page-document-history-heading">Revision and workflow history</h2>
        </div>
        <span className="admin-status-muted">Read-only</span>
      </div>
      <div className="admin-page-history-grid">
        <div>
          <h3>Revisions</h3>
          {history.length === 0 ? <p className="admin-empty-state">No revisions are recorded.</p> : (
            <ol className="admin-page-history-list">
              {history.map((revision) => (
                <li key={revision.id}>
                  <div>
                    <strong>{revision.isPublished ? "Published pointer" : revision.status}</strong>
                    <span>{revision.id}</span>
                  </div>
                  <small>Updated {formatDate(revision.updatedAt)}{revision.publishedAt ? ` · Published ${formatDate(revision.publishedAt)}` : ""}</small>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div>
          <h3>Audit events</h3>
          {audit.length === 0 ? <p className="admin-empty-state">No workflow events are recorded.</p> : (
            <ol className="admin-page-history-list">
              {audit.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{actionLabel(entry.action)}</strong>
                    <span>{entry.fromStatus ?? "new"} → {entry.toStatus} · revision {entry.revisionId}</span>
                  </div>
                  <small>{formatDate(entry.createdAt)}</small>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
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
  const canMutate = membership.role === "owner" || membership.role === "editor";
  const roleMessage = membership.role === "reviewer"
    ? "Reviewer access is read-only. Review content and immutable workflow history without mutation controls."
      : "Owner and editor access can save Drafts, submit Drafts for Review, and return Reviews to Draft.";
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
              <p className="admin-disclosure-note">The Published pointer identifies the version available to the published-only public loader. This panel is immutable and separate from editorial revisions.</p>
              <p className="admin-editor-note">Published {formatDate(page.publishedAt)} · Last reviewed {formatDate(page.lastReviewedAt)}</p>
              <ValidationState issues={page.published.validationIssues} />
              {!publishedDocument ? null : <div className="admin-readonly-document-stack"><ReadOnlySeoPanel document={publishedDocument} idSuffix="published" /><PageDocumentReadOnly document={publishedDocument} idSuffix="published" /></div>}
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
                  {activeDocument && page.activeRevision.status === "review" ? (
                    <>
                      <div className="admin-readonly-document-stack"><ReadOnlySeoPanel document={activeDocument} idSuffix="review" /><PageDocumentReadOnly document={activeDocument} idSuffix="review" /></div>
                      <PageDocumentWorkflowControls pageKey={adapter.pageKey} revisionId={page.activeRevision.id} status="review" canMutate={canMutate} />
                    </>
                  ) : null}
                </>
              ) : <p className="admin-empty-state">No active Draft or Review revision exists for this page.</p>}
            </section>

            <section className="admin-editor-panel" aria-labelledby="page-document-editor-heading">
              <div className="admin-panel-heading">
                <div>
                  <p className="admin-kicker">Structured editor</p>
                  <h2 id="page-document-editor-heading">PageDocument content</h2>
                </div>
                <span className={membership.role === "reviewer" || page.activeRevision?.status === "review" ? "admin-status-muted" : "admin-status-ready"}>{membership.role === "reviewer" || page.activeRevision?.status === "review" ? "Read-only" : "Draft only"}</span>
              </div>
              {membership.role === "reviewer" ? (
                <p className="admin-disclosure-note">Reviewer access remains read-only. Review the Published and active Review panels above; workflow history is shown below.</p>
              ) : page.activeRevision?.status === "review" ? (
                <p className="admin-disclosure-note">Review is immutable. Return it to Draft before editing. No publication or restoration controls are available in this batch.</p>
              ) : (activeDocument ?? publishedDocument) ? (
                <>
                  <PageDocumentEditor initialDocument={(activeDocument ?? publishedDocument)!} />
                  {page.activeRevision?.status === "draft" ? <PageDocumentWorkflowControls pageKey={adapter.pageKey} revisionId={page.activeRevision.id} status="draft" canMutate={canMutate} /> : null}
                </>
              ) : (
                <p className="admin-empty-state">A valid PageDocument is not available for editing.</p>
              )}
            </section>

            <PageDocumentHistory history={page.revisionHistory} audit={page.auditHistory} />

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

        <footer className="admin-footer">Publication, restoration, and authenticated Preview are intentionally unavailable in this Batch 3A application workflow.</footer>
      </div>
    </main>
  );
}
