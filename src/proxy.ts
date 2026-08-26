import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { updateSession } from "@/lib/supabase/proxy";

const publicAdminPaths = new Set(["/login", "/forgot-password", "/reset-password", "/invite"]);

async function enforceInsightsRouteBoundary(request: NextRequest, response: NextResponse) {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith("/crimson-admin-control") || pathname === "/crimson-admin-control") {
    return response;
  }

  const relativePath = pathname.slice("/crimson-admin-control".length) || "/";
  if (publicAdminPaths.has(relativePath) || relativePath.startsWith("/auth/")) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return response;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => undefined,
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return response;

  const { data: member } = await supabase
    .from("cms_members")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member || member.role === "owner") return response;

  const { data: access, error } = await supabase
    .from("cms_member_access")
    .select("access_scope, insights_access")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return response;

  const insightsOnly = access?.access_scope === "insights_only" && access.insights_access === true;
  if (!insightsOnly) return response;
  if (relativePath === "/" || relativePath === "") {
    return NextResponse.redirect(new URL("/crimson-admin-control/insights", request.url));
  }
  if (!relativePath.startsWith("/insights")) {
    return new NextResponse(null, { status: 404 });
  }
  return response;
}

export async function proxy(request: NextRequest) {
  // The generic admin namespace is intentionally not discoverable. The
  // canonical public entry point is exposed through the rewrite in
  // next.config.ts, while direct /admin requests fail before that rewrite.
  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
    return new NextResponse(null, { status: 404 });
  }

  const response = await updateSession(request);
  const boundaryResponse = await enforceInsightsRouteBoundary(request, response);
  const isInsightsPreview = /^\/crimson-admin-control\/insights\/articles\/[^/]+\/preview\/?$/.test(request.nextUrl.pathname);
  if (isInsightsPreview && boundaryResponse.status < 400) {
    boundaryResponse.headers.set("Cache-Control", "private, no-store");
    boundaryResponse.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return boundaryResponse;
}

export const config = {
  matcher: ["/admin/:path*", "/crimson-admin-control/:path*"],
};
