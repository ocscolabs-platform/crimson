import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminAccountActions from "@/app/admin/AdminAccountActions";
import { requireCmsInsightsEditor } from "@/app/admin/content/pages/_lib";
import { getCmsRoleLabel } from "@/lib/cms-auth";
import { getInsightsArticlePreviewData } from "@/lib/insights-data";
import ReadOnlyArticleBody from "../../ReadOnlyArticleBody";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

function statusLabel(status: string) {
  return status === "review" ? "Needs Review" : `${status[0].toUpperCase()}${status.slice(1)}`;
}

function submittedLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not submitted";
}

export default async function InsightsArticlePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, membership } = await requireCmsInsightsEditor();
  const { id } = await params;
  const article = await getInsightsArticlePreviewData(id);
  if (!article) notFound();

  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header"><div><Link className="admin-brand" href="/">OCSCO</Link><p className="admin-kicker">Insights / Preview</p></div><AdminAccountActions email={user.email} role={getCmsRoleLabel(membership)} backHref={`/crimson-admin-control/insights/articles/${article.id}`} /></header>
        <aside className="insights-preview-banner" aria-label="Private unpublished preview"><strong>Preview — unpublished content</strong><span>{statusLabel(article.status)} · This private preview does not change the public site.</span><Link href={`/crimson-admin-control/insights/articles/${article.id}`}>Return to article</Link></aside>
        <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link href="/crimson-admin-control/insights">Insights</Link><span aria-hidden="true">/</span><strong aria-current="page">Preview</strong></nav>
        <article className="insights-preview-article">
          <header className="insights-preview-heading"><p className="admin-kicker admin-kicker-green">{statusLabel(article.status)}</p><h1>{article.title || "Untitled article"}</h1><p className="insights-preview-byline">By {article.authorId === user.id ? "You" : article.authorLabel} · {submittedLabel(article.submittedAt)}</p></header>
          <dl className="insights-readonly-summary"><div><dt>Excerpt</dt><dd>{article.excerpt || "No excerpt."}</dd></div><div><dt>Category</dt><dd>{article.categoryName}</dd></div><div><dt>Tags</dt><dd>{article.tagNames.length ? article.tagNames.join(", ") : "No tags."}</dd></div></dl>
          <div className="insights-preview-content"><ReadOnlyArticleBody body={article.body} /></div>
        </article>
        <footer className="admin-footer">Preview is private, read-only, and unpublished.</footer>
      </div>
    </main>
  );
}
