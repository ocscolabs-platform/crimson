import { createClient } from "@supabase/supabase-js";
import { getLocalPage, type PageHero, type PublicPage } from "@/lib/page-content";
import { defaultPrimaryNavigation, type NavigationItem } from "@/lib/site-navigation";
import { services as localServices, type Service } from "@/lib/site-content";
import { workProjects as localWorkProjects, type WorkProject } from "@/lib/work-content";

export type SiteSettings = {
  siteName: string;
  positioningStatement: string;
  defaultSeoTitle: string;
  defaultSeoDescription: string;
  defaultOgImagePath: string;
  primaryContactPath: string;
};

const localSiteSettings: SiteSettings = {
  siteName: "OCSCO",
  positioningStatement: "Strategy, design, and technology for brands ready to move with precision.",
  defaultSeoTitle: "OCSCO — Strategy, design, and technology",
  defaultSeoDescription: "Strategy, design, and technology for brands ready to move with precision.",
  defaultOgImagePath: "/opengraph-image",
  primaryContactPath: "/contact",
};

type PublishedService = {
  name: string;
  card_name: string | null;
  slug: string;
  short_description: string | null;
  audience: string | null;
  outcome: string | null;
};

type PublishedCaseStudy = {
  project_name: string;
  slug: string;
  client_visibility: "hidden" | "approved";
  project_type: "case-study" | "prototype" | "upcoming";
  project_category: string | null;
  external_url: string | null;
  is_featured: boolean;
  sort_order: number;
  summary: string | null;
};

type PublishedPage = {
  title: string;
  slug: string;
  seo_title: string | null;
  seo_description: string | null;
  content: unknown;
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

function getPageHero(content: unknown): Partial<PageHero> {
  if (!Array.isArray(content)) {
    return {};
  }

  const hero = content.find((block) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      return false;
    }

    return "eyebrow" in block || "title" in block || "intro" in block;
  });

  if (!hero || typeof hero !== "object" || Array.isArray(hero)) {
    return {};
  }

  const block = hero as Record<string, unknown>;
  return {
    eyebrow: typeof block.eyebrow === "string" ? block.eyebrow : undefined,
    title: typeof block.title === "string" ? block.title : undefined,
    intro: typeof block.intro === "string" ? block.intro : undefined,
  };
}

export async function getPublishedSiteSettings(): Promise<SiteSettings> {
  const client = getPublicCmsClient();

  if (!client) {
    return localSiteSettings;
  }

  const { data, error } = await client
    .from("site_settings")
    .select("site_name, positioning_statement, default_seo_title, default_seo_description, default_og_image_path, primary_contact_path")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) {
    return localSiteSettings;
  }

  return {
    siteName: data.site_name || localSiteSettings.siteName,
    positioningStatement: data.positioning_statement || localSiteSettings.positioningStatement,
    defaultSeoTitle: data.default_seo_title || localSiteSettings.defaultSeoTitle,
    defaultSeoDescription: data.default_seo_description || localSiteSettings.defaultSeoDescription,
    defaultOgImagePath: data.default_og_image_path || localSiteSettings.defaultOgImagePath,
    primaryContactPath: data.primary_contact_path || localSiteSettings.primaryContactPath,
  };
}

export async function getPublishedNavigation(group: "primary" | "footer"): Promise<NavigationItem[]> {
  const fallback = group === "primary" ? defaultPrimaryNavigation : [];
  const client = getPublicCmsClient();

  if (!client) {
    return fallback;
  }

  const { data, error } = await client
    .from("navigation_items")
    .select("label, href")
    .eq("navigation_group", group)
    .eq("is_visible", true)
    .order("sort_order", { ascending: true });

  if (error || !data?.length) {
    return fallback;
  }

  return data as NavigationItem[];
}

export async function getPublishedSiteChrome() {
  const [settings, primaryNavigation, footerNavigation] = await Promise.all([
    getPublishedSiteSettings(),
    getPublishedNavigation("primary"),
    getPublishedNavigation("footer"),
  ]);

  return { settings, primaryNavigation, footerNavigation };
}

export async function getPublishedPage(slug: string): Promise<PublicPage | undefined> {
  const fallback = getLocalPage(slug);
  const client = getPublicCmsClient();

  if (!client) {
    return fallback;
  }

  const { data: rawData, error } = await client
    .from("pages")
    .select("title, slug, seo_title, seo_description, content")
    .eq("slug", slug)
    .maybeSingle();
  const data = rawData as PublishedPage | null;

  if (error || !data) {
    return fallback;
  }

  const localHero = fallback?.hero;
  const cmsHero = getPageHero(data.content);

  return {
    slug: data.slug,
    seoTitle: data.seo_title || fallback?.seoTitle || data.title,
    seoDescription: data.seo_description || fallback?.seoDescription || "",
    hero: {
      eyebrow: cmsHero.eyebrow || localHero?.eyebrow || "",
      title: cmsHero.title || localHero?.title || data.title,
      intro: cmsHero.intro || localHero?.intro || "",
    },
  };
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

export async function getPublishedService(slug: string): Promise<Service | undefined> {
  const services = await getPublishedServices();
  return services.find((service) => service.slug === slug);
}

function mapPublishedCaseStudy(caseStudy: PublishedCaseStudy): WorkProject {
  const isApproved = caseStudy.client_visibility === "approved";
  const safeName = caseStudy.project_type === "prototype"
    ? "Selected prototype"
    : caseStudy.project_type === "upcoming"
      ? "Upcoming project"
      : "Selected case study";
  const safeDescription = caseStudy.project_type === "prototype"
    ? "A prototype in the OCSCO work library. Approved project details will be added as publication permissions are confirmed."
    : caseStudy.project_type === "upcoming"
      ? "An upcoming OCSCO project. Approved project details will be added as the story is ready to publish."
      : "A selected OCSCO case study. Approved project details will be added as the story is ready to publish.";

  return {
    slug: caseStudy.slug,
    name: isApproved ? caseStudy.project_name : safeName,
    clientVisibility: caseStudy.client_visibility,
    status: caseStudy.project_type === "prototype"
      ? "Prototype"
      : caseStudy.project_type === "upcoming"
        ? "Upcoming"
        : "Case study",
    category: caseStudy.project_category || "Project story",
    description: isApproved
      ? caseStudy.summary || "Approved project details will be added as the work is published."
      : safeDescription,
    href: isApproved ? caseStudy.external_url || undefined : undefined,
    featured: caseStudy.is_featured,
  };
}

export async function getPublishedWorkProjects(): Promise<WorkProject[]> {
  const client = getPublicCmsClient();

  if (!client) {
    return localWorkProjects;
  }

  const { data, error } = await client
    .from("case_studies")
    .select("project_name, slug, client_visibility, project_type, project_category, external_url, is_featured, sort_order, summary")
    .order("is_featured", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error || !data?.length) {
    return localWorkProjects;
  }

  return (data as PublishedCaseStudy[]).map(mapPublishedCaseStudy);
}

export async function getPublishedWorkProject(slug: string): Promise<WorkProject | undefined> {
  const projects = await getPublishedWorkProjects();
  return projects.find((project) => project.slug === slug);
}
