import Link from "next/link";
import AdminAccountActions from "@/app/admin/AdminAccountActions";
import { requireCmsInsightsEditor } from "@/app/admin/content/pages/_lib";
import { getCmsRoleLabel } from "@/lib/cms-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InsightsFoundationPage() {
  const { user, membership } = await requireCmsInsightsEditor();
  const supabase = await createClient();
  const { count: reviewCount } = await supabase
    .from("insights_articles")
    .select("id", { count: "exact", head: true })
    .eq("status", "review");

  return (
    <main className="admin-page">
      <div className="admin-shell admin-editor-shell">
        <header className="admin-header">
          <div>
            <Link className="admin-brand" href="/">OCSCO</Link>
            <p className="admin-kicker">Insights / Foundation</p>
          </div>
          <AdminAccountActions email={user.email} role={getCmsRoleLabel(membership)} backHref="/crimson-admin-control/insights" />
        </header>

        <section className="admin-editor-heading">
          <div>
            <p className="admin-kicker admin-kicker-green">Phase 6 foundation</p>
            <h1>Insights publishing space.</h1>
          </div>
          <p className="admin-intro">The secure article, revision, review, and publishing foundation is in place. Authoring, autosave, media, and public Insights arrive in later batches.</p>
        </section>

        <section className="admin-section admin-record-grid" aria-label="Insights foundation status">
          <article className="admin-record-panel">
            <p className="admin-kicker">Review queue foundation</p>
            <h2>{reviewCount ?? 0} awaiting review</h2>
            <p className="admin-section-note">The authoritative review count is backed by the Insights article boundary and is limited by the signed-in member’s access scope.</p>
          </article>
          <article className="admin-record-panel">
            <p className="admin-kicker">Current capability</p>
            <h2>{membership.canPublishInsights ? "Trusted Publisher" : "Editor"}</h2>
            <p className="admin-section-note">This surface does not grant Pages, Global Content, Services, Work, Team, CRM, or other broad Crimson administration.</p>
          </article>
        </section>

        <footer className="admin-footer">Batch 6A foundation only. The Insights composer and public routes are not implemented.</footer>
      </div>
    </main>
  );
}
