import Link from "next/link";
import AdminAccountActions from "@/app/admin/AdminAccountActions";
import { requireCmsInsightsEditor } from "@/app/admin/content/pages/_lib";
import { getCmsRoleLabel } from "@/lib/cms-auth";
import { getInsightsTaxonomy } from "@/lib/insights-data";
import InsightsComposer from "../Composer";

export const dynamic = "force-dynamic";

export default async function NewInsightsArticlePage() {
  const { user, membership } = await requireCmsInsightsEditor();
  const taxonomy = await getInsightsTaxonomy();
  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header"><div><Link className="admin-brand" href="/">OCSCO</Link><p className="admin-kicker">Insights / New Article</p></div><AdminAccountActions email={user.email} role={getCmsRoleLabel(membership)} backHref="/crimson-admin-control/insights" /></header>
        <nav className="admin-breadcrumbs" aria-label="Breadcrumb"><Link href="/crimson-admin-control/insights">Insights</Link><span aria-hidden="true">/</span><strong aria-current="page">New Article</strong></nav>
        <section className="admin-editor-heading"><div><p className="admin-kicker admin-kicker-green">Create → write → save Draft</p><h1>Start with the idea.</h1></div><div className="admin-editor-status"><strong>New Draft</strong><span>Nothing is created until Save Draft succeeds.</span></div></section>
        <div className="admin-editor-panel"><p className="admin-editor-warning">This is a writing-first Draft. Title is required for the first save; the slug is generated server-side and can be adjusted later under Advanced.</p><InsightsComposer taxonomy={taxonomy} /></div>
        <footer className="admin-footer">Drafts are private. Submit, Publish, media, and Preview are not part of this batch.</footer>
      </div>
    </main>
  );
}
