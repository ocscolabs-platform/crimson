import Link from "next/link";
import AdminAccountActions from "@/app/admin/AdminAccountActions";
import { requireCmsInsightsEditor } from "@/app/admin/content/pages/_lib";
import { getInsightsDashboard } from "@/lib/insights-data";
import { getCmsRoleLabel } from "@/lib/cms-auth";

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

export default async function InsightsLandingPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const { user, membership } = await requireCmsInsightsEditor();
  const requestedView = (await searchParams)?.view;
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
          {views.map((item) => <Link key={item.key} className={view === item.key ? "is-active" : ""} href={item.key === "all" ? "/crimson-admin-control/insights" : `/crimson-admin-control/insights?view=${item.key}`} aria-current={view === item.key ? "page" : undefined}>{item.label}{item.key === "review" && data.reviewCount > 0 ? <span className="insights-count">{data.reviewCount}</span> : null}</Link>)}
        </nav>

        <section className="admin-section insights-list-section" aria-labelledby="article-list-title">
          <div className="admin-section-heading"><div><p className="admin-kicker">{view === "all" ? "Article library" : views.find((item) => item.key === view)?.label}</p><h2 id="article-list-title">{data.articles.length} {data.articles.length === 1 ? "article" : "articles"}</h2></div><p className="admin-section-note">Titles and statuses come from the protected article boundary. Open an item to continue a Draft or read its current workflow state.</p></div>
          {data.articles.length ? <div className="insights-article-list">{data.articles.map((article) => <article className="insights-article-row" key={article.id}><div className="insights-article-main"><span className={`insights-status insights-status-${article.status}`}>{statusLabel(article.status)}</span><h3>{article.title}</h3><p>{article.excerpt || "No excerpt yet."}</p></div><div className="insights-article-meta"><span>{article.authorLabel}</span><time dateTime={article.updatedAt}>{updatedLabel(article.updatedAt)}</time><Link className="admin-panel-link" href={`/crimson-admin-control/insights/articles/${article.id}`}>{article.status === "draft" ? "Open Draft" : "Open article"} ↗</Link></div></article>)}</div> : <div className="insights-empty"><h3>Nothing here yet.</h3><p>Start with a Draft and keep the first save explicit. Opening New Article never creates an empty record.</p><Link className="button button-light" href="/crimson-admin-control/insights/articles/new">Start a Draft <span aria-hidden="true">↗</span></Link></div>}
        </section>

        <section className="insights-guidance" aria-label="Draft guidance"><div><p className="admin-kicker admin-kicker-green">B6B1 boundary</p><h2>Write → Save Draft.</h2></div><p>Submit, Publish, media, Preview, and public Insights remain outside this authoring foundation. Your local writing stays in the browser until an explicit save succeeds.</p></section>
        <footer className="admin-footer">Insights access is controlled by role and article ownership.</footer>
      </div>
    </main>
  );
}
