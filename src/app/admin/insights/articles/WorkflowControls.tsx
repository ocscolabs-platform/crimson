"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { publishInsightsArticle, restoreInsightsRevision, returnInsightsToDraft, unpublishInsightsArticle, withdrawInsightsReview, type InsightsActionState } from "./actions";
import type { InsightsRevisionHistory } from "@/lib/insights-data";

const initialState: InsightsActionState = { status: "idle", message: "", issues: [] };

type WorkflowControlsProps = {
  articleId: string;
  expectedUpdatedAt: string;
  status: "review" | "published" | "unpublished";
  authorId: string;
  viewerId: string;
  role: "owner" | "editor" | "reviewer";
  canPublishInsights: boolean;
  revisionHistory: InsightsRevisionHistory[];
};

function Feedback({ state }: { state: InsightsActionState }) {
  if (state.status === "idle") return null;
  return <p className={state.status === "saved" ? "insights-success" : "insights-error"} role={state.status === "saved" ? "status" : "alert"}>{state.status === "conflict" ? "This article changed elsewhere. Reload latest saved version." : state.message}</p>;
}

function ActionFields({ articleId, expectedUpdatedAt }: Pick<WorkflowControlsProps, "articleId" | "expectedUpdatedAt">) {
  return <><input type="hidden" name="article_id" value={articleId} /><input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} /></>;
}

export default function WorkflowControls(props: WorkflowControlsProps) {
  const router = useRouter();
  const [publishState, publishAction, publishPending] = useActionState(publishInsightsArticle, initialState);
  const [returnState, returnAction, returnPending] = useActionState(returnInsightsToDraft, initialState);
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(withdrawInsightsReview, initialState);
  const [unpublishState, unpublishAction, unpublishPending] = useActionState(unpublishInsightsArticle, initialState);
  const [restoreState, restoreAction, restorePending] = useActionState(restoreInsightsRevision, initialState);
  const canWithdraw = props.status === "review" && props.role === "editor" && props.authorId === props.viewerId;
  const canPublish = props.status === "review" && (props.role === "owner" || (props.role === "editor" && props.canPublishInsights && props.authorId === props.viewerId));
  const canReturn = props.status === "review" && props.role === "owner";
  const canUnpublish = props.status === "published" && props.role === "owner";
  const canRestore = props.status === "unpublished" && props.role === "owner" && props.revisionHistory.length > 0;

  useEffect(() => {
    if (publishState.status === "saved" || returnState.status === "saved" || withdrawState.status === "saved" || unpublishState.status === "saved" || restoreState.status === "saved") router.refresh();
  }, [publishState.status, returnState.status, restoreState.status, router, unpublishState.status, withdrawState.status]);

  if (!canPublish && !canReturn && !canWithdraw && !canUnpublish && !canRestore && props.status !== "review") return null;
  return (
    <section className="insights-workflow-controls" aria-label="Workflow actions">
      <div className="insights-workflow-links">{props.status === "review" ? <Link className="button button-light" href={`/crimson-admin-control/insights/articles/${props.articleId}/preview`}>Preview ↗</Link> : null}</div>
      {canPublish ? <form action={publishAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-primary">Publish</summary><div className="insights-confirmation"><p>Publish this reviewed article with its validated Cover, inline media, and stable public artifacts?</p><button className="button button-primary" type="submit" disabled={publishPending}>{publishPending ? "Publishing…" : "Confirm Publish"}</button></div></details><Feedback state={publishState} /></form> : null}
      {canReturn ? <form action={returnAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-light">Return to Draft</summary><div className="insights-confirmation"><p>Return this Review to Draft so it can be edited again?</p><button className="button button-light" type="submit" disabled={returnPending}>{returnPending ? "Returning…" : "Confirm Return to Draft"}</button></div></details><Feedback state={returnState} /></form> : null}
      {canWithdraw ? <form action={withdrawAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-light">Withdraw to Draft</summary><div className="insights-confirmation"><p>Withdraw your Review to Draft for further editing?</p><button className="button button-light" type="submit" disabled={withdrawPending}>{withdrawPending ? "Withdrawing…" : "Confirm Withdraw to Draft"}</button></div></details><Feedback state={withdrawState} /></form> : null}
      {canUnpublish ? <form action={unpublishAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-light">Unpublish</summary><div className="insights-confirmation"><p>Remove this article from the staging publication boundary while preserving its history?</p><button className="button button-light" type="submit" disabled={unpublishPending}>{unpublishPending ? "Unpublishing…" : "Confirm Unpublish"}</button></div></details><Feedback state={unpublishState} /></form> : null}
      {canRestore ? <form action={restoreAction}><input type="hidden" name="article_id" value={props.articleId} /><details><summary className="button button-light">Restore</summary><div className="insights-confirmation"><label>Historical Published revision<select name="source_revision_id" defaultValue={props.revisionHistory[0]?.id ?? ""}>{props.revisionHistory.map((revision) => <option key={revision.id} value={revision.id}>Revision {revision.revisionNumber} · {revision.status}</option>)}</select></label><p>Restore the selected historical revision as a new private Draft?</p><button className="button button-light" type="submit" disabled={restorePending}>{restorePending ? "Restoring…" : "Confirm Restore"}</button></div></details><Feedback state={restoreState} /></form> : null}
    </section>
  );
}
