import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [migration, correction, route] = await Promise.all([
  read("supabase/migrations/20260831080000_add_scheduled_execution_claims.sql"),
  read("supabase/migrations/20260831090000_fix_scheduled_claim_idle_ambiguity.sql"),
  read("src/app/api/scheduled-publishing/execute/route.ts"),
]);

// The output column scheduled_publish_at is also a PL/pgSQL variable. Every
// table reference in the due-row selector must therefore be qualified.
assert.match(migration, /from public\.insights_articles as article/);
assert.match(migration, /article\.status = 'scheduled'/);
assert.match(migration, /article\.scheduled_publish_at <= now\(\)/);
assert.match(migration, /article\.scheduler_claim_expires_at is null or article\.scheduler_claim_expires_at <= now\(\)/);
assert.match(migration, /order by article\.scheduled_publish_at, article\.updated_at, article\.id/);
assert.match(correction, /create or replace function public\.insights_claim_due_scheduled_article/);
assert.match(correction, /from public\.insights_articles as article/);
assert.match(correction, /article\.scheduled_publish_at <= now\(\)/);
assert.match(correction, /order by article\.scheduled_publish_at, article\.updated_at, article\.id/);

// The route must preserve the distinction between a valid empty claim and an
// actual RPC failure.
assert.match(route, /if \(error\) \{/);
assert.match(route, /Scheduled publication could not be claimed/);
assert.match(route, /status: "idle", processed: 0/);

const clone = (value) => structuredClone(value);
function claimDue(article, now, token) {
  const eligible = article.status === "scheduled"
    && article.scheduledAt !== null
    && article.scheduledAt <= now
    && (article.claimExpiresAt === null || article.claimExpiresAt <= now);
  if (!eligible) return null;
  article.claimToken = token;
  article.claimExpiresAt = now + 120;
  return { articleId: article.id, revisionId: article.revisionId };
}

function routeClaimResult({ data, error }) {
  if (error) return { httpStatus: 500, body: { error: "Scheduled publication could not be claimed." } };
  const claimed = Array.isArray(data) ? data[0] : data;
  if (!claimed?.article_id || !claimed?.revision_id) return { httpStatus: 200, body: { status: "idle", processed: 0 } };
  return { httpStatus: 200, body: { status: "claimed", processed: 1 } };
}

const future = {
  id: "future",
  status: "scheduled",
  scheduledAt: 200,
  revisionId: "reviewed-revision",
  claimToken: null,
  claimExpiresAt: null,
  publicProjectionRows: 0,
};
const beforeIdle = clone(future);
assert.deepEqual(routeClaimResult({ data: null, error: null }), {
  httpStatus: 200,
  body: { status: "idle", processed: 0 },
});
assert.equal(claimDue(future, 100, "worker-idle"), null, "future schedules are idle");
assert.deepEqual(future, beforeIdle, "idle execution must not write claim or projection state");

assert.deepEqual(routeClaimResult({ data: null, error: { code: "42702" } }), {
  httpStatus: 500,
  body: { error: "Scheduled publication could not be claimed." },
}, "claim/database errors must remain errors");

const due = {
  id: "due",
  status: "scheduled",
  scheduledAt: 100,
  revisionId: "reviewed-revision",
  claimToken: null,
  claimExpiresAt: null,
  publicProjectionRows: 0,
};
assert.deepEqual(claimDue(due, 100, "worker-due"), {
  articleId: "due",
  revisionId: "reviewed-revision",
});
assert.equal(due.claimToken, "worker-due", "due articles remain claimable");
assert.equal(due.claimExpiresAt, 220, "due claim lease remains bounded");
assert.equal(due.publicProjectionRows, 0, "claiming does not create a projection");

console.log("Batch 2C2A-1 idle-path contract: focused assertions passed");
