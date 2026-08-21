import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // The generic admin namespace is intentionally not discoverable. The
  // canonical public entry point is exposed through the rewrite in
  // next.config.ts, while direct /admin requests fail before that rewrite.
  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
    return new NextResponse(null, { status: 404 });
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/crimson-admin-control/:path*"],
};
