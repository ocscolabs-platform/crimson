import { createClient } from "@supabase/supabase-js";
import { services as localServices, type Service } from "@/lib/site-content";
import { workProjects as localWorkProjects, type WorkProject } from "@/lib/work-content";

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
  project_type: "case-study" | "prototype" | "upcoming";
  project_category: string | null;
  external_url: string | null;
  is_featured: boolean;
  sort_order: number;
  summary: string | null;
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

export async function getPublishedService(slug: string): Promise<Service | undefined> {
  const services = await getPublishedServices();
  return services.find((service) => service.slug === slug);
}

function mapPublishedCaseStudy(caseStudy: PublishedCaseStudy): WorkProject {
  return {
    slug: caseStudy.slug,
    name: caseStudy.project_name,
    status: caseStudy.project_type === "prototype"
      ? "Prototype"
      : caseStudy.project_type === "upcoming"
        ? "Upcoming"
        : "Case study",
    category: caseStudy.project_category || "Project story",
    description: caseStudy.summary || "Approved project details will be added as the work is published.",
    href: caseStudy.external_url || undefined,
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
    .select("project_name, slug, project_type, project_category, external_url, is_featured, sort_order, summary")
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
