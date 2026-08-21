import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_NEXT_PATH = "/crimson-admin-control/reset-password";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_NEXT_PATH;
  }

  return value;
}

function redirectWithError(request: NextRequest, message: string, nextPath: string) {
  const url = new URL(nextPath, request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return redirectWithError(
      request,
      "This password reset link is missing its verification code. Request a new link and try again.",
      nextPath,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectWithError(
      request,
      "This password reset link is invalid or has expired. Request a new link and try again.",
      nextPath,
    );
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}
