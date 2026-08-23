import type { PageKey, PageSectionKey } from "@/lib/page-document";

export type PageSectionPosition = "first" | "after-hero" | "last" | "flexible";

export type PageSectionBlueprint = {
  key: PageSectionKey;
  label: string;
  required: boolean;
  canHide: boolean;
  position: PageSectionPosition;
};

export type PageDefinition = {
  key: PageKey;
  route: "/" | "/services" | "/about" | "/contact";
  label: string;
  allowedSections: readonly PageSectionKey[];
  blueprint: readonly PageSectionBlueprint[];
};

const homeBlueprint = [
  { key: "home_hero", label: "Hero", required: true, canHide: false, position: "first" },
  { key: "home_intro", label: "Introduction", required: true, canHide: false, position: "flexible" },
  { key: "home_capabilities", label: "Capabilities", required: true, canHide: false, position: "flexible" },
  { key: "home_approach", label: "Approach", required: true, canHide: false, position: "flexible" },
  { key: "home_proof", label: "Proof of work", required: false, canHide: true, position: "flexible" },
  { key: "home_contact", label: "Contact call to action", required: true, canHide: false, position: "last" },
] as const satisfies readonly PageSectionBlueprint[];

const servicesBlueprint = [
  { key: "services_hero", label: "Hero", required: true, canHide: false, position: "first" },
  { key: "services_capabilities", label: "Capabilities", required: true, canHide: false, position: "after-hero" },
] as const satisfies readonly PageSectionBlueprint[];

const aboutBlueprint = [
  { key: "about_hero", label: "Hero", required: true, canHide: false, position: "first" },
  { key: "about_principles", label: "Working principles", required: true, canHide: false, position: "after-hero" },
  { key: "about_people", label: "The people", required: false, canHide: true, position: "last" },
] as const satisfies readonly PageSectionBlueprint[];

const contactBlueprint = [
  { key: "contact_hero", label: "Hero", required: true, canHide: false, position: "first" },
  { key: "contact_process", label: "What happens next", required: true, canHide: false, position: "after-hero" },
  { key: "contact_form", label: "Contact form", required: true, canHide: false, position: "last" },
] as const satisfies readonly PageSectionBlueprint[];

export const PAGE_REGISTRY = {
  home: {
    key: "home",
    route: "/",
    label: "Homepage",
    allowedSections: homeBlueprint.map((section) => section.key),
    blueprint: homeBlueprint,
  },
  services: {
    key: "services",
    route: "/services",
    label: "Services",
    allowedSections: servicesBlueprint.map((section) => section.key),
    blueprint: servicesBlueprint,
  },
  about: {
    key: "about",
    route: "/about",
    label: "About",
    allowedSections: aboutBlueprint.map((section) => section.key),
    blueprint: aboutBlueprint,
  },
  contact: {
    key: "contact",
    route: "/contact",
    label: "Contact",
    allowedSections: contactBlueprint.map((section) => section.key),
    blueprint: contactBlueprint,
  },
} as const satisfies Record<PageKey, PageDefinition>;

export const SECTION_REGISTRY = Object.fromEntries(
  Object.values(PAGE_REGISTRY).flatMap((page) => page.blueprint.map((section) => [section.key, section])),
) as Record<PageSectionKey, PageSectionBlueprint>;

export function isPageKey(value: string): value is PageKey {
  return value in PAGE_REGISTRY;
}

export function getPageDefinition(pageKey: PageKey) {
  return PAGE_REGISTRY[pageKey];
}
