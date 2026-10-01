import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/site-origin";

const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "PerplexityBot"];

export default function robots(): MetadataRoute.Robots {
  const origin = getSiteOrigin();
  if (!origin) {
    throw new Error("A public site origin is required to generate robots.txt.");
  }

  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: AI_CRAWLERS, allow: "/" },
    ],
    sitemap: new URL("/sitemap.xml", origin).toString(),
    host: origin.toString(),
  };
}
