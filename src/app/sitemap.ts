import type { MetadataRoute } from "next";
import { getPublishedInsightsArticles } from "@/lib/insights-data";
import { getPublishedServices, getPublishedWorkProjects } from "@/lib/cms-content";
import { getSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

const PLACEHOLDER_SERVICE_SLUGS = new Set([
  "branding",
  "website-design-development",
  "custom-cms",
  "crm-business-tools",
  "custom-web-applications",
]);
const PLACEHOLDER_WORK_SLUGS = new Set(["membership-portal"]);

function routeUrl(origin: URL, path: string) {
  return new URL(path, origin).toString();
}

function lastModified(value: string | undefined) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteOrigin();
  if (!origin) {
    throw new Error("A public site origin is required to generate the sitemap.");
  }
  const [services, projects, articles] = await Promise.all([
    getPublishedServices(),
    getPublishedWorkProjects({ includeRelatedCapabilities: false }),
    getPublishedInsightsArticles(),
  ]);

  const staticRoutes = ["/", "/services", "/work", "/insights", "/about", "/contact"]
    .map((path) => ({ url: routeUrl(origin, path) }));

  const serviceRoutes = services
    .filter((service) => !PLACEHOLDER_SERVICE_SLUGS.has(service.slug))
    .map((service) => ({
      url: routeUrl(origin, `/services/${service.slug}`),
      lastModified: lastModified(service.updatedAt),
    }));

  const workRoutes = projects
    .filter((project) => !PLACEHOLDER_WORK_SLUGS.has(project.slug))
    .map((project) => ({
      url: routeUrl(origin, `/work/${project.slug}`),
      lastModified: lastModified(project.updatedAt),
    }));

  const insightRoutes = articles.map((article) => ({
    url: routeUrl(origin, `/insights/${article.slug}`),
    lastModified: lastModified(article.publishedAt),
  }));

  return [...staticRoutes, ...serviceRoutes, ...workRoutes, ...insightRoutes];
}
