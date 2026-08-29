import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prepareInsightsPublication } from "@/lib/insights-publication";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCHEDULER_SECRET_ENV = "SCHEDULED_PUBLISHING_SECRET";
const LEASE_SECONDS = 120;

type ClaimedScheduledArticle = {
  article_id: string;
  revision_id: string;
  scheduled_publish_at: string;
  claim_expires_at: string;
};

function hasValidSchedulerSecret(request: Request, secret: string) {
  const supplied = Buffer.from(request.headers.get("authorization") ?? "", "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

async function releaseClaim(admin: ReturnType<typeof createAdminClient>, articleId: string, claimToken: string) {
  try {
    await admin.rpc("insights_release_scheduled_claim", { p_article_id: articleId, p_claim_token: claimToken });
  } catch (error) {
    console.error("[scheduled-publishing] claim release failed", { articleId, error });
  }
}

export async function POST(request: Request) {
  const secret = process.env[SCHEDULER_SECRET_ENV];
  if (!secret) return NextResponse.json({ error: "Scheduled publishing is not configured." }, { status: 503 });
  if (!hasValidSchedulerSecret(request, secret)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const claimToken = randomUUID();
  let admin: ReturnType<typeof createAdminClient> | null = null;
  let claimed: ClaimedScheduledArticle | null = null;
  let prepared: Awaited<ReturnType<typeof prepareInsightsPublication>> | null = null;

  try {
    admin = createAdminClient();
    const { data, error } = await admin.rpc("insights_claim_due_scheduled_article", { p_claim_token: claimToken, p_lease_seconds: LEASE_SECONDS });
    if (error) {
      console.error("[scheduled-publishing] claim failed", { error });
      return NextResponse.json({ error: "Scheduled publication could not be claimed." }, { status: 500 });
    }

    const rawClaim = (Array.isArray(data) ? data[0] : data) as ClaimedScheduledArticle | null | undefined;
    claimed = rawClaim ?? null;
    if (!claimed?.article_id || !claimed.revision_id) return NextResponse.json({ status: "idle", processed: 0 });

    prepared = await prepareInsightsPublication(admin, admin, claimed.article_id);
    if (!prepared.ok) {
      await releaseClaim(admin, claimed.article_id, claimToken);
      return NextResponse.json({ error: "Scheduled publication could not be prepared." }, { status: 500 });
    }

    const { error: publishError } = await admin.rpc("insights_publish_scheduled_article", {
      p_article_id: claimed.article_id,
      p_claim_token: claimToken,
      p_expected_revision_id: claimed.revision_id,
      p_public_media: prepared.artifacts,
    });
    if (publishError) {
      await prepared.cleanup();
      await releaseClaim(admin, claimed.article_id, claimToken);
      console.error("[scheduled-publishing] publication failed", { articleId: claimed.article_id, error: publishError });
      return NextResponse.json({ error: "Scheduled publication failed; the article remains scheduled." }, { status: 500 });
    }

    return NextResponse.json({ status: "published", processed: 1 });
  } catch (error) {
    if (prepared?.ok) await prepared.cleanup();
    if (admin && claimed?.article_id) await releaseClaim(admin, claimed.article_id, claimToken);
    console.error("[scheduled-publishing] execution failed", { error });
    return NextResponse.json({ error: "Scheduled publication execution failed." }, { status: 500 });
  }
}
