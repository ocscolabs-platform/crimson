"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteInsightsArticle, type InsightsDeleteActionState } from "./actions";

const initialState: InsightsDeleteActionState = { status: "idle", message: "" };

export default function ArticleDeleteControl({ articleId, expectedUpdatedAt, canDelete }: { articleId: string; expectedUpdatedAt: string; canDelete: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(deleteInsightsArticle, initialState);

  useEffect(() => {
    if (state.status === "saved") router.replace("/crimson-admin-control/insights?deleted=1");
  }, [router, state.status]);

  if (!canDelete) {
    return <p className="insights-delete-blocked" role="status">Unpublish this article before deleting it.</p>;
  }

  return <form className="insights-delete-control" action={action} onSubmit={(event) => { if (!window.confirm("Delete this article? This cannot be undone.")) event.preventDefault(); }}>
    <input type="hidden" name="article_id" value={articleId} />
    <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
    <button className="button insights-delete-button" type="submit" disabled={pending}><span aria-hidden="true">⌫</span>{pending ? "Deleting…" : "Delete article"}</button>
    {state.status === "error" ? <p className="insights-error" role="alert">{state.message}</p> : null}
  </form>;
}
