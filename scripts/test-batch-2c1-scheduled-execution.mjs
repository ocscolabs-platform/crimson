import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [migration, route, helper, actions, packageJson] = await Promise.all([
  read("supabase/migrations/20260831080000_add_scheduled_execution_claims.sql"),
  read("src/app/api/scheduled-publishing/execute/route.ts"),
  read("src/lib/insights-publication.ts"),
  read("src/app/admin/insights/articles/actions.ts"),
  read("package.json"),
]);

assert.match(migration, /add column if not exists scheduler_claim_token uuid/);
assert.match(migration, /add column if not exists scheduler_claim_expires_at timestamptz/);
assert.match(migration, /status = 'scheduled'/);
assert.match(migration, /scheduled_publish_at <= now\(\)/);
assert.match(migration, /article\.scheduler_claim_expires_at is null or article\.scheduler_claim_expires_at <= now\(\)/);
assert.match(migration, /for update skip locked/);
assert.match(migration, /greatest\(30, least\(coalesce\(p_lease_seconds, 120\), 300\)\)/);
assert.match(migration, /insights_clear_scheduler_claim_on_manual_change/);
assert.match(migration, /new\.scheduler_claim_token := null/);
assert.match(migration, /create or replace function public\.insights_claim_due_scheduled_article/);
assert.match(migration, /create or replace function public\.insights_release_scheduled_claim/);
assert.match(migration, /auth\.role\(\) <> 'service_role'/g);
assert.match(migration, /active_revision_id is distinct from p_expected_revision_id/);
assert.match(migration, /revision\.status <> 'review'/);
assert.match(migration, /create or replace function public\.insights_finalize_article_publication/);
assert.match(migration, /public\.insights_revision_is_publishable\(revision\.id\)/);
assert.match(migration, /insights_public_articles/);
assert.match(migration, /insights_write_audit/);
assert.match(migration, /execution', 'scheduled'/);
assert.match(migration, /create or replace function public\.insights_publish_scheduled_article/);
assert.match(migration, /grant execute on function public\.insights_publish_scheduled_article.*to service_role/s);
assert.match(migration, /grant execute on function public\.insights_publish_article.*to authenticated/s);

assert.match(route, /SCHEDULED_PUBLISHING_SECRET/);
assert.match(route, /timingSafeEqual/);
assert.match(route, /request\.headers\.get\("authorization"\)/);
assert.match(route, /insights_claim_due_scheduled_article/);
assert.match(route, /insights_release_scheduled_claim/);
assert.match(route, /prepareInsightsPublication/);
assert.match(route, /insights_publish_scheduled_article/);
assert.match(route, /p_lease_seconds: LEASE_SECONDS/);
assert.doesNotMatch(route, /setInterval|setTimeout|cron|queue/i);

assert.match(helper, /insights-private-media/);
assert.match(helper, /insights-published-media/);
assert.match(helper, /articles\/\$\{articleId\}\/revisions\/\$\{revision\.id\}\/\$\{mediaId\}\.webp/);
assert.match(actions, /prepareInsightsPublication\(supabase, admin, articleId\)/);
assert.match(actions, /insights_publish_article/);
assert.match(packageJson, /test:batch2c1:execution/);

const clone = (article) => ({ ...article });
function claimDue(article, token, now) {
  const due = article.status === "scheduled" && article.scheduledAt <= now && (!article.claimExpiresAt || article.claimExpiresAt <= now);
  if (!due) return null;
  article.claimToken = token;
  article.claimExpiresAt = now + 120;
  return { articleId: article.id, revisionId: article.revisionId };
}
function invalidateClaimOnManualChange(article, next) {
  Object.assign(article, next);
  if (next.status !== undefined || next.scheduledAt !== undefined) {
    article.claimToken = null;
    article.claimExpiresAt = null;
  }
}
function finalizeScheduled(article, token, revisionId, now) {
  if (article.status !== "scheduled" || article.scheduledAt > now || article.claimToken !== token || article.claimExpiresAt <= now || article.revisionId !== revisionId) return false;
  article.status = "published";
  article.scheduledAt = null;
  article.claimToken = null;
  article.claimExpiresAt = null;
  return true;
}

const due = { id: "due", status: "scheduled", scheduledAt: 100, revisionId: "rev-1", claimToken: null, claimExpiresAt: null };
const future = { id: "future", status: "scheduled", scheduledAt: 200, revisionId: "rev-2", claimToken: null, claimExpiresAt: null };
assert.ok(claimDue(due, "worker-a", 100));
assert.equal(claimDue(due, "worker-b", 100), null, "a second worker cannot claim an active lease");
assert.equal(claimDue(future, "worker-c", 100), null, "future schedules are ignored");
assert.ok(claimDue(due, "worker-d", 221), "an expired lease can be retried");

const stale = clone(due);
stale.claimToken = "worker-stale";
stale.claimExpiresAt = 400;
invalidateClaimOnManualChange(stale, { status: "review" });
assert.equal(finalizeScheduled(stale, "worker-stale", stale.revisionId, 300), false, "manual cancellation invalidates a stale worker");

const rescheduled = clone(due);
rescheduled.claimToken = "worker-stale";
rescheduled.claimExpiresAt = 400;
invalidateClaimOnManualChange(rescheduled, { scheduledAt: 500 });
assert.equal(finalizeScheduled(rescheduled, "worker-stale", rescheduled.revisionId, 500), false, "manual reschedule invalidates a stale worker");

const publishOnce = { id: "once", status: "scheduled", scheduledAt: 100, revisionId: "rev-3", claimToken: "worker", claimExpiresAt: 300 };
assert.equal(finalizeScheduled(publishOnce, "worker", "rev-3", 200), true);
assert.equal(finalizeScheduled(publishOnce, "worker", "rev-3", 201), false, "a completed publication is idempotent");

const failed = { id: "failed", status: "scheduled", scheduledAt: 100, revisionId: "rev-4", claimToken: "worker", claimExpiresAt: 300 };
assert.equal(finalizeScheduled(failed, "wrong-worker", "rev-4", 200), false);
assert.equal(failed.status, "scheduled", "failed execution leaves the article scheduled for retry");

console.log("Batch 2C1 scheduled execution foundation contract: 39/39 passed");
