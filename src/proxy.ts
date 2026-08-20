import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Production /admin is the canonical CMS entry point. Authentication and
  // role checks happen in the protected server pages; the proxy only refreshes
  // the Supabase session cookie for both Preview and Production.
  return updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*"],
};
