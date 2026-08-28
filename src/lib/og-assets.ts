import type { PageKey } from "@/lib/page-document";

export const DEFAULT_OG_IMAGE_PATH = "/og/ocsco-home.png";
export const INSIGHTS_OG_IMAGE_PATH = "/og/ocsco-insights.png";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export const PAGE_OG_IMAGE_PATHS: Record<PageKey, string> = {
  home: DEFAULT_OG_IMAGE_PATH,
  services: "/og/ocsco-services.png",
  about: "/og/ocsco-about.png",
  contact: "/og/ocsco-contact.png",
};
