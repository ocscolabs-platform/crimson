"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelScheduledInsightsArticle, publishInsightsArticle, rescheduleInsightsArticle, restoreInsightsRevision, returnInsightsToDraft, scheduleInsightsArticle, unpublishInsightsArticle, withdrawInsightsReview, type InsightsActionState } from "./actions";
import LocalScheduleTime from "../LocalScheduleTime";
import type { InsightsRevisionHistory } from "@/lib/insights-data";
import AdminSubmitButton from "@/app/admin/AdminSubmitButton";

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
  deleteControl?: ReactNode;
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

type ScheduleModalMode = "schedule" | "reschedule";

export default function WorkflowControls(props: WorkflowControlsProps) {
  const router = useRouter();
  const [publishState, publishAction] = useActionState(publishInsightsArticle, initialState);
  const [scheduleState, scheduleAction, schedulePending] = useActionState(scheduleInsightsArticle, initialState);
  const [rescheduleState, rescheduleAction, reschedulePending] = useActionState(rescheduleInsightsArticle, initialState);
  const [cancelState, cancelAction] = useActionState(cancelScheduledInsightsArticle, initialState);
  const [returnState, returnAction] = useActionState(returnInsightsToDraft, initialState);
  const [withdrawState, withdrawAction] = useActionState(withdrawInsightsReview, initialState);
  const [unpublishState, unpublishAction] = useActionState(unpublishInsightsArticle, initialState);
  const [restoreState, restoreAction] = useActionState(restoreInsightsRevision, initialState);
  const [scheduleValue, setScheduleValue] = useState("");
  const [minimumLocalTime, setMinimumLocalTime] = useState("");
  const [timeZoneLabel, setTimeZoneLabel] = useState("Local time");
  const [scheduleModalMode, setScheduleModalMode] = useState<ScheduleModalMode | null>(null);
  const scheduleDialogCloseRef = useRef<HTMLButtonElement>(null);
  const canSchedule = props.status === "review" && props.role === "owner";
  const isScheduled = props.status === "scheduled" && props.role === "owner";
  const canWithdraw = props.status === "review" && props.role === "editor" && props.authorId === props.viewerId;
  const canPublish = (props.status === "review" || props.status === "scheduled") && props.role === "owner";
  const canReturn = props.status === "review" && props.role === "owner";
  const canUnpublish = props.status === "published" && props.role === "owner";
  const canEditPublished = props.status === "published" && props.role === "owner" && props.revisionHistory.length > 0;
  const canRestore = props.status === "unpublished" && props.role === "owner" && props.revisionHistory.length > 0;
  const schedulePendingState = schedulePending || reschedulePending;

  function openScheduleModal(mode: ScheduleModalMode) {
    setMinimumLocalTime(toLocalInput(new Date().toISOString()));
    setScheduleValue(mode === "reschedule" ? toLocalInput(props.scheduledPublishAt) : "");
    setScheduleModalMode(mode);
  }

  function closeScheduleModal() {
    if (!schedulePendingState) setScheduleModalMode(null);
  }

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

  useEffect(() => {
    if (!scheduleModalMode) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => scheduleDialogCloseRef.current?.focus(), 0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !schedulePendingState) {
        event.preventDefault();
        setScheduleModalMode(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [scheduleModalMode, schedulePendingState]);

  if (!canPublish && !canReturn && !canWithdraw && !canUnpublish && !canEditPublished && !canRestore && !canSchedule && !isScheduled && props.status !== "review") return null;
  return (
    <section className="insights-workflow-controls" aria-label="Workflow actions">
      <div className="insights-workflow-links">{props.status === "review" ? <Link className="button button-light" href={`/crimson-admin-control/insights/articles/${props.articleId}/preview`}>Preview ↗</Link> : null}</div>
      {canSchedule ? <button className="button button-primary" type="button" onClick={() => openScheduleModal("schedule")}>Schedule</button> : null}
      {isScheduled ? <>
        <div className="insights-scheduled-summary"><strong>Scheduled for <LocalScheduleTime value={props.scheduledPublishAt ?? ""} /></strong><span className="insights-timezone-note">Displayed in your browser’s local timezone: {timeZoneLabel}</span></div>
        <button className="button button-light" type="button" onClick={() => openScheduleModal("reschedule")}>Reschedule</button>
        <form action={cancelAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-light">Cancel schedule</summary><div className="insights-confirmation"><p>Cancel the scheduled publication and return this article to Review?</p><AdminSubmitButton variant="light" label="Confirm Cancel" pendingLabel="Cancelling…" /></div></details><Feedback state={cancelState} /></form>
      </> : null}
      {canPublish ? <form action={publishAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-primary">{props.status === "scheduled" ? "Publish now" : "Publish"}</summary><div className="insights-confirmation"><p>{props.status === "scheduled" ? "Publish this scheduled article now with its validated Cover, inline media, and stable public artifacts?" : "Publish this reviewed article with its validated Cover, inline media, and stable public artifacts?"}</p><AdminSubmitButton variant="primary" label={props.status === "scheduled" ? "Confirm Publish now" : "Confirm Publish"} pendingLabel="Publishing…" /></div></details><Feedback state={publishState} /></form> : null}
      {canReturn ? <form action={returnAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-light">Return to Draft</summary><div className="insights-confirmation"><p>Return this Review to Draft so it can be edited again?</p><AdminSubmitButton variant="light" label="Confirm Return to Draft" pendingLabel="Returning…" /></div></details><Feedback state={returnState} /></form> : null}
      {canWithdraw ? <form action={withdrawAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-light">Withdraw to Draft</summary><div className="insights-confirmation"><p>Withdraw your Review to Draft for further editing?</p><AdminSubmitButton variant="light" label="Confirm Withdraw to Draft" pendingLabel="Withdrawing…" /></div></details><Feedback state={withdrawState} /></form> : null}
      {canEditPublished ? <form action={restoreAction}><input type="hidden" name="article_id" value={props.articleId} /><input type="hidden" name="source_revision_id" value={props.revisionHistory[0]?.id ?? ""} /><details><summary className="button button-light">Edit Article</summary><div className="insights-confirmation"><p>Create a new private Draft from this Published article? The Published revision will remain immutable and public until the Draft is published.</p><AdminSubmitButton variant="light" label="Create Draft to Edit" pendingLabel="Creating Draft…" /></div></details><Feedback state={restoreState} /></form> : null}
      {canUnpublish ? <form action={unpublishAction}><ActionFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} /><details><summary className="button button-light">Unpublish</summary><div className="insights-confirmation"><p>Remove this article from the staging publication boundary while preserving its history?</p><AdminSubmitButton variant="light" label="Confirm Unpublish" pendingLabel="Unpublishing…" /></div></details><Feedback state={unpublishState} /></form> : null}
      {canRestore ? <form action={restoreAction}><input type="hidden" name="article_id" value={props.articleId} /><details><summary className="button button-light">Restore</summary><div className="insights-confirmation"><label>Historical Published revision<select name="source_revision_id" defaultValue={props.revisionHistory[0]?.id ?? ""}>{props.revisionHistory.map((revision) => <option key={revision.id} value={revision.id}>Revision {revision.revisionNumber} · {revision.status}</option>)}</select></label><p>Restore the selected historical revision as a new private Draft?</p><AdminSubmitButton variant="light" label="Confirm Restore" pendingLabel="Restoring…" /></div></details><Feedback state={restoreState} /></form> : null}
      {props.deleteControl ? <div className="insights-workflow-destructive-action">{props.deleteControl}</div> : null}
      {scheduleModalMode === null && scheduleState.status !== "idle" ? <Feedback state={scheduleState} /> : null}
      {scheduleModalMode === null && rescheduleState.status !== "idle" ? <Feedback state={rescheduleState} /> : null}
      {scheduleModalMode ? <div className="insights-schedule-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeScheduleModal(); }}><div className="insights-schedule-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title" aria-describedby="schedule-dialog-description" onMouseDown={(event) => event.stopPropagation()}><div className="insights-schedule-dialog-heading"><div><p className="admin-kicker admin-kicker-green">Insights workflow</p><h2 id="schedule-dialog-title">{scheduleModalMode === "reschedule" ? "Reschedule publication" : "Schedule publication"}</h2></div><button ref={scheduleDialogCloseRef} className="insights-dialog-close" type="button" aria-label="Close schedule dialog" onClick={closeScheduleModal} disabled={schedulePendingState}>×</button></div><form action={scheduleModalMode === "reschedule" ? rescheduleAction : scheduleAction} className="insights-schedule-dialog-form"><p id="schedule-dialog-description">{scheduleModalMode === "reschedule" ? "Update the publication time for this reviewed article." : "Choose when this reviewed article should become public. The time is entered in your browser’s local timezone."}</p><ScheduleFields articleId={props.articleId} expectedUpdatedAt={props.expectedUpdatedAt} value={scheduleValue} minimum={minimumLocalTime} onChange={setScheduleValue} /><span className="insights-timezone-note">Detected local time: {timeZoneLabel}</span><div className="insights-dialog-actions"><button className="button button-light" type="button" onClick={closeScheduleModal} disabled={schedulePendingState}>Cancel</button><AdminSubmitButton variant={scheduleModalMode === "reschedule" ? "light" : "primary"} label={scheduleModalMode === "reschedule" ? "Reschedule" : "Schedule"} pendingLabel={scheduleModalMode === "reschedule" ? "Rescheduling…" : "Scheduling…"} /></div><Feedback state={scheduleModalMode === "reschedule" ? rescheduleState : scheduleState} /></form></div></div> : null}
    </section>
  );
}
