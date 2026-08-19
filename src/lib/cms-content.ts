import { createClient } from "@supabase/supabase-js";
import { services as localServices, type Service } from "@/lib/site-content";

type PublishedService = {
  name: string;
  card_name: string | null;
  slug: string;
  short_description: string | null;
  audience: string | null;
  outcome: string | null;
};

function getPublicCmsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getPublishedServices(): Promise<Service[]> {
  const client = getPublicCmsClient();

  if (!client) {
    return localServices;
  }

  const { data, error } = await client
    .from("services")
    .select("name, card_name, slug, short_description, audience, outcome")
    .order("created_at", { ascending: true });

  if (error || !data?.length) {
    return localServices;
  }

  return (data as PublishedService[]).map((service) => ({
    slug: service.slug,
    name: service.name,
    cardName: service.card_name || service.name,
    summary: service.short_description || "",
    audience: service.audience || "",
    outcome: service.outcome || "",
  }));
}
