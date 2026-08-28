/* eslint-disable @next/next/no-img-element -- private media URLs are runtime-resolved. */
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminAccountActions from "@/app/admin/AdminAccountActions";
import { requireCmsInsightsEditor } from "@/app/admin/content/pages/_lib";
import { getCmsRoleLabel } from "@/lib/cms-auth";
import { getInsightsArticleEditorData, getInsightsRevisionHistory, getInsightsTaxonomy } from "@/lib/insights-data";
import InsightsComposer from "../Composer";
import ReadOnlyArticleBody from "../ReadOnlyArticleBody";
import WorkflowControls from "../WorkflowControls";
import ArticleDeleteControl from "../ArticleDeleteControl";

export const dynamic = "force-dynamic";

function statusLabel(status: string) {
  return status === "review" ? "Needs Review" : `${status[0].toUpperCase()}${status.slice(1)}`;
}

function submittedLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not submitted";
}

export default async function InsightsArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { user, membership } = await requireCmsInsightsEditor();
  const { id } = await params;
  const article = await getInsightsArticleEditorData(id);
  if (!article) notFound();
  const taxonomy = await getInsightsTaxonomy();
  const revisionHistory = article.status === "unpublished" || article.status === "published" ? await getInsightsRevisionHistory(article.id) : [];
  const editorialRole = membership.role === "owner" ? "owner" : "editor";
  const isDraft = article.status === "draft";
  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header"><div><Link className="admin-brand" href="/">OCSCO</Link><p className="admin-kicker">Insights / Article</p></div><AdminAccountActions email={user.email} role={getCmsRoleLabel(membership)} backHref="/crimson-admin-control/insights" /></header>
        <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link href="/crimson-admin-control/insights">Insights</Link><span aria-hidden="true">/</span><strong aria-current="page">{article.title || "Untitled Draft"}</strong></nav>
        <section className="admin-editor-heading"><div><p className="admin-kicker admin-kicker-green">{isDraft ? "Edit Draft" : "Read-only article state"}</p><h1>{article.title || "Untitled Draft"}</h1></div><div className="admin-editor-status"><strong>{statusLabel(article.status)}</strong><span>{isDraft ? "Explicit Save Draft" : "This revision is immutable."}</span></div></section>
        {isDraft ? <><div className="admin-editor-panel"><InsightsComposer taxonomy={taxonomy} role={editorialRole} canPublishInsights={membership.canPublishInsights} article={{ ...article, status: "draft" }} /></div>{membership.role === "owner" ? <ArticleDeleteControl articleId={article.id} expectedUpdatedAt={article.updatedAt} canDelete={!article.publishedRevisionId} /> : null}</> : <><section className="admin-editor-panel insights-readonly-article" aria-labelledby="readonly-article-title"><div className="insights-readonly-banner"><strong>{statusLabel(article.status)} is read-only.</strong><span>Review and Published revisions are not silently converted into editable forms.</span></div><dl className="insights-readonly-summary"><div><dt>Slug</dt><dd>{article.slug}</dd></div><div><dt>Author</dt><dd>{article.authorId === user.id ? "You" : article.authorLabel}</dd></div><div><dt>Submitted</dt><dd>{submittedLabel(article.submittedAt)}</dd></div><div><dt>Excerpt</dt><dd>{article.excerpt || "No excerpt."}</dd></div><div><dt>Category</dt><dd>{article.categoryName}</dd></div><div><dt>Tags</dt><dd>{article.tagNames.length ? article.tagNames.join(", ") : "No tags."}</dd></div></dl><div className="insights-readonly-content-section"><article className="insights-readonly-content"><h2 id="readonly-article-title">{article.title || "Untitled article"}</h2>{article.coverMedia?.previewUrl ? <figure className="insights-preview-cover"><img src={article.coverMedia.previewUrl} alt={article.coverMedia.altText} /></figure> : null}<ReadOnlyArticleBody body={article.body} /></article></div>{article.status === "review" || article.status === "published" || article.status === "unpublished" ? <WorkflowControls articleId={article.id} expectedUpdatedAt={article.updatedAt} status={article.status} authorId={article.authorId} viewerId={user.id} role={editorialRole} canPublishInsights={membership.canPublishInsights} revisionHistory={revisionHistory} /> : null}</section>{membership.role === "owner" ? <ArticleDeleteControl articleId={article.id} expectedUpdatedAt={article.updatedAt} canDelete={!article.publishedRevisionId} /> : null}</>}
        <footer className="admin-footer">{isDraft ? "Draft changes remain private until a later workflow action." : "This article remains protected by the current Insights workflow state."}</footer>
      </div>
    </main>
  );
}
