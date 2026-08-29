import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFile(resolve(root, path), "utf8");

test("manual scheduling actions use the existing Owner-only RPC contract", async () => {
  const source = await read("src/app/admin/insights/articles/actions.ts");
  assert.match(source, /insights_schedule_article/);
  assert.match(source, /insights_reschedule_article/);
  assert.match(source, /insights_cancel_scheduled_article/);
  assert.match(source, /authorized\.membership\.role !== "owner"/);
  assert.match(source, /p_scheduled_publish_at: parsedPublishAt\.toISOString\(\)/);
  assert.match(source, /T\.\*\(\?:Z\|\[\+\-\]\\d\{2\}:\\d\{2\}\)\$/);
  assert.match(source, /parsedPublishAt\.getTime\(\) <= Date\.now\(\)/);
});

test("the UI converts browser-local datetime input and exposes Scheduled controls", async () => {
  const controls = await read("src/app/admin/insights/articles/WorkflowControls.tsx");
  const localTime = await read("src/app/admin/insights/LocalScheduleTime.tsx");
  assert.match(controls, /status: "review" \| "scheduled"/);
  assert.match(controls, /type="datetime-local"/);
  assert.match(controls, /name="scheduled_publish_at"/);
  assert.match(controls, /localDate\.toISOString\(\)/);
  assert.match(controls, /resolvedOptions\(\)\.timeZone/);
  assert.match(controls, /Schedule/);
  assert.match(controls, /Reschedule/);
  assert.match(controls, /Cancel schedule/);
  assert.match(controls, /Publish now/);
  assert.match(localTime, /Intl\.DateTimeFormat/);
  assert.doesNotMatch(`${controls}\n${localTime}`, /Asia\/Shanghai/);
});

test("article data, list state, and detail routing carry scheduled_publish_at", async () => {
  const data = await read("src/lib/insights-data.ts");
  const list = await read("src/app/admin/insights/page.tsx");
  const detail = await read("src/app/admin/insights/articles/[id]/page.tsx");
  assert.match(data, /scheduled_publish_at/);
  assert.match(data, /scheduledPublishAt/);
  assert.match(list, /article\.scheduledPublishAt/);
  assert.match(detail, /article\.status === "scheduled"/);
  assert.match(detail, /scheduledPublishAt=\{article\.scheduledPublishAt\}/);
});

test("the independent Editor publishing capability remains in the Composer", async () => {
  const composer = await read("src/app/admin/insights/articles/Composer.tsx");
  assert.match(composer, /canPublishInsights/);
  assert.match(composer, /canPublishInsights/);
});
