import Link from "next/link";
import AdminToast from "@/app/admin/AdminToast";
import AdminAccountActions from "@/app/admin/AdminAccountActions";
import { requireCmsInsightsEditor } from "@/app/admin/content/pages/_lib";
import { getInsightsDashboard } from "@/lib/insights-data";
import { getCmsRoleLabel } from "@/lib/cms-auth";
import LocalScheduleTime from "./LocalScheduleTime";

export const dynamic = "force-dynamic";

const views = [
  { key: "all", label: "All articles" },
  { key: "my-drafts", label: "My drafts" },
  { key: "review", label: "Review" },
  { key: "published", label: "Published" },
];

function statusLabel(status: string) {
  return status === "review" ? "Needs Review" : `${status[0].toUpperCase()}${status.slice(1)}`;
}

function updatedLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function submittedLabel(value: string | null) {
  return value ? updatedLabel(value) : "Not submitted";
}

export default async function InsightsLandingPage({ searchParams }: { searchParams?: Promise<{ view?: string; deleted?: string }> }) {
  const { user, membership } = await requireCmsInsightsEditor();
  const params = await searchParams;
  const requestedView = params?.view;
  const view = views.some((item) => item.key === requestedView) ? requestedView : "all";
  const data = await getInsightsDashboard(view);

  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header">
          <div><Link className="admin-brand" href="/">OCSCO</Link><p className="admin-kicker">Insights / Articles</p></div>
          <AdminAccountActions email={user.email} role={getCmsRoleLabel(membership)} backHref="/crimson-admin-control" />
        </header>

        <section className="admin-hero insights-hero">
          <div><p className="admin-kicker admin-kicker-green">Writing workspace</p><h1>Make the thinking useful.</h1></div>
          <div><p className="admin-intro">A focused space for writing, saving, and preparing Insights Drafts. Review and publishing stay protected behind the existing workflow.</p><Link className="button button-primary insights-new-button" href="/crimson-admin-control/insights/articles/new">New Article <span aria-hidden="true">↗</span></Link></div>
        </section>

        <nav className="insights-view-nav" aria-label="Article views">
          {views.map((item) => <Link key={item.key} className={view === item.key ? "is-active" : ""} href={item.key === "all" ? "/crimson-admin-control/insights" : `/crimson-admin-control/insights?view=${item.key}`} aria-current={view === item.key ? "page" : undefined}>{item.label}{item.key === "review" && data.reviewCount > 0 ? <span className="insights-count" aria-label={`${data.reviewCount} articles need review`}>{data.reviewCount}</span> : null}</Link>)}
        </nav>

        {params?.deleted === "1" ? <AdminToast tone="success" message="✓ Article deleted" /> : null}

        {membership.role === "owner" ? <section className="insights-review-queue" aria-labelledby="needs-review-heading"><div className="admin-section-heading"><div><p className="admin-kicker admin-kicker-green">Owner attention</p><h2 id="needs-review-heading">Needs Review <span className="insights-count" aria-label={`${data.reviewCount} articles need review`}>{data.reviewCount}</span></h2></div><p className="admin-section-note">Submitted articles are shown oldest first. Review is read-only until you choose a workflow action.</p></div>{data.reviewQueue.length ? <div className="insights-review-list">{data.reviewQueue.map((article) => <article className="insights-review-row" key={article.id}><div><span className="insights-status insights-status-review">Needs Review</span><h3>{article.title}</h3></div><dl><div><dt>Author</dt><dd>{article.authorLabel}</dd></div><div><dt>Submitted</dt><dd>{submittedLabel(article.submittedAt)}</dd></div><div><dt>Category</dt><dd>{article.categoryName}</dd></div></dl><Link className="button button-light" href={`/crimson-admin-control/insights/articles/${article.id}`}>Review ↗</Link></article>)}</div> : <p className="insights-empty-copy">No articles are waiting for review.</p>}</section> : null}

        <section className="admin-section insights-list-section" aria-labelledby="article-list-title">
          <div className="admin-section-heading"><div><p className="admin-kicker">{view === "all" ? "Article library" : views.find((item) => item.key === view)?.label}</p><h2 id="article-list-title">{data.articles.length} {data.articles.length === 1 ? "article" : "articles"}</h2></div><p className="admin-section-note">Titles and statuses come from the protected article boundary. Open an item to continue a Draft or read its current workflow state.</p></div>
          {data.articles.length ? <div className="insights-article-list">{data.articles.map((article) => <article className="insights-article-row" key={article.id}><div className="insights-article-main"><div className="insights-status-line"><span className={`insights-status insights-status-${article.status}`}>{article.status === "draft" && article.hasLivePublishedVersion ? "Draft changes" : statusLabel(article.status)}</span>{article.status === "draft" && article.hasLivePublishedVersion ? <span className="insights-live-status-note">Live version published</span> : null}</div><h3>{article.title}</h3><p>{article.excerpt || "No excerpt yet."}</p>{article.scheduledPublishAt ? <p className="insights-scheduled-time">Scheduled for <LocalScheduleTime value={article.scheduledPublishAt} /></p> : null}</div><div className="insights-article-meta"><span>{article.authorLabel}</span><time dateTime={article.updatedAt}>{updatedLabel(article.updatedAt)}</time><Link className="admin-panel-link" href={`/crimson-admin-control/insights/articles/${article.id}`}>{article.status === "draft" ? "Open Draft" : "Open article"} ↗</Link></div></article>)}</div> : <div className="insights-empty"><h3>Nothing here yet.</h3><p>Start with a Draft and keep the first save explicit. Opening New Article never creates an empty record.</p><Link className="button button-light" href="/crimson-admin-control/insights/articles/new">Start a Draft <span aria-hidden="true">↗</span></Link></div>}
        </section>

        <section className="insights-guidance" aria-label="Draft guidance"><div><p className="admin-kicker admin-kicker-green">Insights workflow</p><h2>Write → Review → Publish.</h2></div><p>Draft autosave, private media, authenticated Preview, and the protected publication boundary keep the editorial loop explicit. Public Insights remain limited to the exact Published revision.</p></section>
        <footer className="admin-footer">Insights access is controlled by role and article ownership.</footer>
      </div>
    </main>
  );
}
