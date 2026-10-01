import { createClient } from "@supabase/supabase-js";

const CASE_STUDY_MEDIA_BUCKET = "case-study-media";

function notFound() {
  return new Response("Not found", { status: 404 });
}

type WorkMediaRouteProps = {
  params: Promise<{ path: string[] }>;
};

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: WorkMediaRouteProps) {
  const { path } = await params;
  const objectPath = path.join("/");

  if (
    path.length < 3
    || path[0] !== "case-studies"
    || path.some((segment) => segment === "." || segment === "..")
    || !objectPath.endsWith(".webp")
  ) {
    return notFound();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return notFound();
  }

  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.storage.from(CASE_STUDY_MEDIA_BUCKET).download(objectPath);
  if (error || !data) {
    return notFound();
  }

  return new Response(data, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Type": data.type || "image/webp",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
