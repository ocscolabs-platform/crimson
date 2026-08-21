import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Keep the old path as a compatibility redirect while making the less
  // obvious path canonical. Authentication and role checks still happen in
  // the protected server pages.
  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = `/crimson-admin-control${request.nextUrl.pathname.slice("/admin".length)}`;
    return NextResponse.redirect(canonicalUrl);
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*", "/crimson-admin-control/:path*"],
};
