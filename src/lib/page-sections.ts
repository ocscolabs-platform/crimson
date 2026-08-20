import { createClient } from "@supabase/supabase-js";

export type PageSectionConfig = {
  sectionKey: string;
  label: string;
  sortOrder: number;
  isVisible: boolean;
};

const defaultPageSections: Record<string, PageSectionConfig[]> = {
  home: [
    { sectionKey: "home_intro", label: "The work", sortOrder: 10, isVisible: true },
    { sectionKey: "home_capabilities", label: "Capabilities", sortOrder: 20, isVisible: true },
    { sectionKey: "home_approach", label: "How we work", sortOrder: 30, isVisible: true },
    { sectionKey: "home_proof", label: "Proof of work", sortOrder: 40, isVisible: true },
    { sectionKey: "home_contact", label: "The next step", sortOrder: 50, isVisible: true },
  ],
  about: [
    { sectionKey: "about_principles", label: "Working principles", sortOrder: 10, isVisible: true },
    { sectionKey: "about_people", label: "The people", sortOrder: 20, isVisible: true },
  ],
  services: [
    { sectionKey: "services_capabilities", label: "Capabilities", sortOrder: 10, isVisible: true },
  ],
  work: [
    { sectionKey: "work_library", label: "Work library", sortOrder: 10, isVisible: true },
  ],
  contact: [
    { sectionKey: "contact_process", label: "What happens next", sortOrder: 10, isVisible: true },
    { sectionKey: "contact_form", label: "Start the conversation", sortOrder: 20, isVisible: true },
  ],
};

function getPublicCmsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;

  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getFallbackSections(pageSlug: string) {
  return defaultPageSections[pageSlug] ?? [];
}

export async function getPublishedPageSections(pageSlug: string): Promise<PageSectionConfig[]> {
  const fallback = getFallbackSections(pageSlug);
  const client = getPublicCmsClient();
  if (!client) return fallback;

  const { data: page, error: pageError } = await client
    .from("pages")
    .select("id")
    .eq("slug", pageSlug)
    .maybeSingle();

  if (pageError || !page) return fallback;

  const { data, error } = await client
    .from("page_sections")
    .select("section_key, label, sort_order, is_visible")
    .eq("page_id", page.id)
    .order("sort_order", { ascending: true });

  if (error || !data?.length) return fallback;

  return data.map((section) => ({
    sectionKey: section.section_key,
    label: section.label,
    sortOrder: section.sort_order,
    isVisible: section.is_visible,
  }));
}

export function orderVisiblePageSections<T>(configs: PageSectionConfig[], blocks: Record<string, T>) {
  return configs
    .filter((config) => config.isVisible && config.sectionKey in blocks)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((config) => blocks[config.sectionKey]);
}

export function getDefaultPageSections(pageSlug: string) {
  return getFallbackSections(pageSlug);
}
