import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase administrator invitations are accepted in a different browser
 * context from the one that created the invitation. They therefore use the
 * implicit callback session returned in the URL fragment, while the normal
 * CMS client remains PKCE-based.
 */
export function createInviteClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase browser configuration is missing.");
  }

  return createBrowserClient(url, publishableKey, {
    auth: {
      flowType: "implicit",
      detectSessionInUrl: false,
    },
  });
}
