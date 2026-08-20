import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.redirect(new URL("/?cms=staging-only", request.url));
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*"],
};
