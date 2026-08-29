"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelScheduledInsightsArticle, publishInsightsArticle, rescheduleInsightsArticle, restoreInsightsRevision, returnInsightsToDraft, scheduleInsightsArticle, unpublishInsightsArticle, withdrawInsightsReview, type InsightsActionState } from "./actions";
import LocalScheduleTime from "../LocalScheduleTime";
import type { InsightsRevisionHistory } from "@/lib/insights-data";

const initialState: InsightsActionState = { status: "idle", message: "", issues: [] };

type WorkflowControlsProps = {
  articleId: string;
  expectedUpdatedAt: string;
  status: "review" | "scheduled" | "published" | "unpublished";
  scheduledPublishAt: string | null;
  authorId: string;
  viewerId: string;
  role: "owner" | "editor" | "reviewer";
  canPublishInsights: boolean;
  revisionHistory: InsightsRevisionHistory[];
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const localDate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), 0, 0);
  return Number.isNaN(localDate.getTime()) ? "" : localDate.toISOString();
}

function localTimeZoneLabel() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "browser local time";
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  return `${zone} · UTC${sign}${pad(Math.floor(absoluteMinutes / 60))}:${pad(absoluteMinutes % 60)}`;
}

function Feedback({ state }: { state: InsightsActionState }) {
  if (state.status === "idle") return null;
  return <p className={state.status === "saved" ? "insights-success" : "insights-error"} role={state.status === "saved" ? "status" : "alert"}>{state.status === "conflict" ? "This article changed elsewhere. Reload latest saved version." : state.message}</p>;
}

function ActionFields({ articleId, expectedUpdatedAt }: Pick<WorkflowControlsProps, "articleId" | "expectedUpdatedAt">) {
  return <><input type="hidden" name="article_id" value={articleId} /><input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} /></>;
}

function ScheduleFields({ articleId, expectedUpdatedAt, value, minimum, onChange }: Pick<WorkflowControlsProps, "articleId" | "expectedUpdatedAt"> & { value: string; minimum: string; onChange: (value: string) => void }) {
  return <>
    <ActionFields articleId={articleId} expectedUpdatedAt={expectedUpdatedAt} />
    <label className="insights-field">Publication time (your local time)
      <input type="datetime-local" name="scheduled_local_time" value={value} min={minimum} onInput={(event) => onChange(event.currentTarget.value)} onChange={(event) => onChange(event.currentTarget.value)} required />
    </label>
    <input type="hidden" name="scheduled_publish_at" value={localInputToIso(value)} />
  </>;
}

export default function WorkflowControls(props: WorkflowControlsProps) {
  const router = useRouter();
  const [publishState, publishAction, publishPending] = useActionState(publishInsightsArticle, initialState);
  const [scheduleState, scheduleAction, schedulePending] = useActionState(scheduleInsightsArticle, initialState);
  const [rescheduleState, rescheduleAction, reschedulePending] = useActionState(rescheduleInsightsArticle, initialState);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelScheduledInsightsArticle, initialState);
  const [returnState, returnAction, returnPending] = useActionState(returnInsightsToDraft, initialState);
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(withdrawInsightsReview, initialState);
  const [unpublishState, unpublishAction, unpublishPending] = useActionState(unpublishInsightsArticle, initialState);
  const [restoreState, restoreAction, restorePending] = useActionState(restoreInsightsRevision, initialState);
  const [scheduleValue, setScheduleValue] = useState("");
  const [minimumLocalTime, setMinimumLocalTime] = useState("");
  const [timeZoneLabel, setTimeZoneLabel] = useState("Local time");
  const canSchedule = props.status === "review" && props.role === "owner";
  const isScheduled = props.status === "scheduled" && props.role === "owner";
  const canWithdraw = props.status === "review" && props.role === "editor" && props.authorId === props.viewerId;
  const canPublish = (props.status === "review" || props.status === "scheduled") && props.role === "owner";
  const canReturn = props.status === "review" && props.role === "owner";
  const canUnpublish = props.status === "published" && props.role === "owner";
  const canEditPublished = props.status === "published" && props.role === "owner" && props.revisionHistory.length > 0;
  const canRestore = props.status === "unpublished" && props.role === "owner" && props.revisionHistory.length > 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMinimumLocalTime(toLocalInput(new Date().toISOString()));
      setTimeZoneLabel(localTimeZoneLabel());
      setScheduleValue(toLocalInput(props.scheduledPublishAt));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [props.scheduledPublishAt]);

  useEffect(() => {
    if (publishState.status === "saved" || scheduleState.status === "saved" || rescheduleState.status === "saved" || cancelState.status === "saved" || returnState.status === "saved" || withdrawState.status === "saved" || unpublishState.status === "saved" || restoreState.status === "saved") router.refresh();
  }, [cancelState.status, publishState.status, rescheduleState.status, restoreState.status, returnState.status, router, scheduleState.status, unpublishState.status, withdrawState.status]);

  if (!canPublish && !canReturn && !canWithdraw && !canUnpublish && !canEditPublished && !canRestore && !canSchedule && !isScheduled && props.status !== "review") return null;
  return (
    <section className="insights-workflow-controls" aria-label="Workflow actions">
      <div className="insights-workflow-links">{props.status === "review" ? <Link className="button button-light" href={`/crimson-admin-control/insights/articles/${props.articleId}/preview`}>Preview ↗</Link> : null}</div>
      {canSchedule ? <form action={scheduleAction}><details><summary className="button button-primary">Schedule</summary><div className="insights-confirmation"><p>Choose when this reviewed article should become public. The time is entered in your browser’s local timezone.</p><ScheduleFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} value={scheduleValue} minimum={minimumLocalTime} onChange={setScheduleValue} /><span className="insights-timezone-note">Detected local time: {timeZoneLabel}</span><button className="button button-primary" type="submit" disabled={schedulePending}>{schedulePending ? "Scheduling…" : "Confirm Schedule"}</button></div></details><Feedback state={scheduleState} /></form> : null}
      {isScheduled ? <>
        <div className="insights-scheduled-summary"><strong>Scheduled for <LocalScheduleTime value={props.scheduledPublishAt ?? ""} /></strong><span className="insights-timezone-note">Displayed in your browser’s local timezone: {timeZoneLabel}</span></div>
        <form action={rescheduleAction}><details><summary className="button button-light">Reschedule</summary><div className="insights-confirmation"><p>Update the publication time for this reviewed article.</p><ScheduleFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} value={scheduleValue} minimum={minimumLocalTime} onChange={setScheduleValue} /><span className="insights-timezone-note">Detected local time: {timeZoneLabel}</span><button className="button button-light" type="submit" disabled={reschedulePending}>{reschedulePending ? "Rescheduling…" : "Confirm Reschedule"}</button></div></details><Feedback state={rescheduleState} /></form>
        <form action={cancelAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-light">Cancel schedule</summary><div className="insights-confirmation"><p>Cancel the scheduled publication and return this article to Review?</p><button className="button button-light" type="submit" disabled={cancelPending}>{cancelPending ? "Cancelling…" : "Confirm Cancel"}</button></div></details><Feedback state={cancelState} /></form>
      </> : null}
      {canPublish ? <form action={publishAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-primary">{props.status === "scheduled" ? "Publish now" : "Publish"}</summary><div className="insights-confirmation"><p>{props.status === "scheduled" ? "Publish this scheduled article now with its validated Cover, inline media, and stable public artifacts?" : "Publish this reviewed article with its validated Cover, inline media, and stable public artifacts?"}</p><button className="button button-primary" type="submit" disabled={publishPending}>{publishPending ? "Publishing…" : props.status === "scheduled" ? "Confirm Publish now" : "Confirm Publish"}</button></div></details><Feedback state={publishState} /></form> : null}
      {canReturn ? <form action={returnAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-light">Return to Draft</summary><div className="insights-confirmation"><p>Return this Review to Draft so it can be edited again?</p><button className="button button-light" type="submit" disabled={returnPending}>{returnPending ? "Returning…" : "Confirm Return to Draft"}</button></div></details><Feedback state={returnState} /></form> : null}
      {canWithdraw ? <form action={withdrawAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-light">Withdraw to Draft</summary><div className="insights-confirmation"><p>Withdraw your Review to Draft for further editing?</p><button className="button button-light" type="submit" disabled={withdrawPending}>{withdrawPending ? "Withdrawing…" : "Confirm Withdraw to Draft"}</button></div></details><Feedback state={withdrawState} /></form> : null}
      {canEditPublished ? <form action={restoreAction}><input type="hidden" name="article_id" value={props.articleId} /><input type="hidden" name="source_revision_id" value={props.revisionHistory[0]?.id ?? ""} /><details><summary className="button button-light">Edit Article</summary><div className="insights-confirmation"><p>Create a new private Draft from this Published article? The Published revision will remain immutable and public until the Draft is published.</p><button className="button button-light" type="submit" disabled={restorePending}>{restorePending ? "Creating Draft…" : "Create Draft to Edit"}</button></div></details><Feedback state={restoreState} /></form> : null}
      {canUnpublish ? <form action={unpublishAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-light">Unpublish</summary><div className="insights-confirmation"><p>Remove this article from the staging publication boundary while preserving its history?</p><button className="button button-light" type="submit" disabled={unpublishPending}>{unpublishPending ? "Unpublishing…" : "Confirm Unpublish"}</button></div></details><Feedback state={unpublishState} /></form> : null}
      {canRestore ? <form action={restoreAction}><input type="hidden" name="article_id" value={props.articleId} /><details><summary className="button button-light">Restore</summary><div className="insights-confirmation"><label>Historical Published revision<select name="source_revision_id" defaultValue={props.revisionHistory[0]?.id ?? ""}>{props.revisionHistory.map((revision) => <option key={revision.id} value={revision.id}>Revision {revision.revisionNumber} · {revision.status}</option>)}</select></label><p>Restore the selected historical revision as a new private Draft?</p><button className="button button-light" type="submit" disabled={restorePending}>{restorePending ? "Restoring…" : "Confirm Restore"}</button></div></details><Feedback state={restoreState} /></form> : null}
    </section>
  );
}
