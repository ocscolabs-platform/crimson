import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest, contentSecurityPolicy?: string, nonce?: string) {
  const createNextResponse = () => {
    if (!contentSecurityPolicy || !nonce) return NextResponse.next({ request });

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
    requestHeaders.set("x-nonce", nonce);
    return NextResponse.next({ request: { headers: requestHeaders } });
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return createNextResponse();
  }

  let response = createNextResponse();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = createNextResponse();
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}
