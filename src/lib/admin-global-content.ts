import { createClient } from "@/lib/supabase/server";
import type { CmsRole } from "@/lib/cms-auth";

export type AdminSiteSettings = {
  id: string;
  site_name: string;
  positioning_statement: string | null;
  default_seo_title: string | null;
  default_seo_description: string | null;
  default_og_image_path: string | null;
  primary_contact_path: string;
};

export type AdminNavigationItem = {
  id: string;
  label: string;
  href: string;
  navigation_group: "primary" | "footer";
  sort_order: number;
  is_visible: boolean;
};

export type AdminPageMetadata = {
  id: string;
  title: string;
  slug: string;
  page_purpose: string | null;
  audience: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image_path: string | null;
  cta_label: string | null;
  cta_href: string | null;
  status: "draft" | "review" | "published" | "archived";
  published_at: string | null;
  last_reviewed_at: string | null;
};

export type AdminPageSection = {
  id: string;
  page_id: string;
  section_key: string;
  label: string;
  sort_order: number;
  is_visible: boolean;
};

export type AdminGlobalContent = {
  settings: AdminSiteSettings | null;
  navigation: AdminNavigationItem[];
  pages: AdminPageMetadata[];
  sections: Record<string, AdminPageSection[]>;
};

export function canEditGlobalContent(role: CmsRole | null) {
  return role === "owner" || role === "editor";
}

export function canPublishPages(role: CmsRole | null) {
  return role === "owner";
}

export async function getAdminGlobalContent(): Promise<AdminGlobalContent> {
  const supabase = await createClient();
  const [settings, navigation, pages, sections] = await Promise.all([
    supabase
      .from("site_settings")
      .select("id, site_name, positioning_statement, default_seo_title, default_seo_description, default_og_image_path, primary_contact_path")
      .eq("id", "default")
      .maybeSingle(),
    supabase
      .from("navigation_items")
      .select("id, label, href, navigation_group, sort_order, is_visible")
      .order("navigation_group", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase
      .from("pages")
      .select("id, title, slug, page_purpose, audience, seo_title, seo_description, og_image_path, cta_label, cta_href, status, published_at, last_reviewed_at")
      .order("title", { ascending: true }),
    supabase
      .from("page_sections")
      .select("id, page_id, section_key, label, sort_order, is_visible")
      .order("page_id", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  const firstError = [settings, navigation, pages, sections].find((result) => result.error)?.error;
  if (firstError) {
    throw new Error(firstError.message);
  }

  const sectionMap: Record<string, AdminPageSection[]> = {};
  for (const section of (sections.data ?? []) as AdminPageSection[]) {
    const pageSections = sectionMap[section.page_id] ?? [];
    pageSections.push(section);
    sectionMap[section.page_id] = pageSections;
  }

  return {
    settings: settings.data as AdminSiteSettings | null,
    navigation: (navigation.data ?? []) as AdminNavigationItem[],
    pages: (pages.data ?? []) as AdminPageMetadata[],
    sections: sectionMap,
  };
}
