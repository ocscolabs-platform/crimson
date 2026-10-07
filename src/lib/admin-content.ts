import { createClient } from "@/lib/supabase/server";

export type AdminCollection = {
  label: string;
  count: number;
  description: string;
};

export type AdminContent = {
  collections: AdminCollection[];
  services: Array<{ name: string; slug: string; status: string }>;
  caseStudies: Array<{
    id: string;
    project_name: string;
    slug: string;
    project_type: "case-study" | "prototype" | "upcoming";
    status: string;
    sort_order: number;
  }>;
};

export async function getAdminContent(): Promise<AdminContent> {
  const supabase = await createClient();

  const [settings, navigation, pages, services, caseStudies] = await Promise.all([
    supabase.from("site_settings").select("id", { count: "exact", head: true }),
    supabase.from("navigation_items").select("id", { count: "exact", head: true }),
    supabase.from("pages").select("id", { count: "exact", head: true }),
    supabase
      .from("services")
      .select("name, slug, status")
      .order("created_at", { ascending: true }),
    supabase
      .from("case_studies")
      .select("id, project_name, slug, project_type, status, sort_order, created_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .order("slug", { ascending: true }),
  ]);

  const firstError = [settings, navigation, pages, services, caseStudies].find(
    (result) => result.error,
  )?.error;

  if (firstError) {
    throw new Error(firstError.message);
  }

  return {
    collections: [
      {
        label: "Site settings",
        count: settings.count ?? 0,
        description: "Global positioning, SEO defaults, and contact routing.",
      },
      {
        label: "Navigation",
        count: navigation.count ?? 0,
        description: "Visible primary and footer links.",
      },
      {
        label: "Pages",
        count: pages.count ?? 0,
        description: "Published page records available to the public site.",
      },
      {
        label: "Services",
        count: services.data?.length ?? 0,
        description: "Service records visible to this staging role.",
      },
      {
        label: "Case studies",
        count: caseStudies.data?.length ?? 0,
        description: "Work records visible to this CMS role across Draft, Review, and Published states.",
      },
    ],
    services: (services.data ?? []) as AdminContent["services"],
    caseStudies: (caseStudies.data ?? []) as AdminContent["caseStudies"],
  };
}
