import { getPageDefinition, isPageKey, SECTION_REGISTRY, type PageSectionBlueprint } from "@/lib/page-registry";

export type PageKey = "home" | "services" | "about" | "contact";

export type PageRoute = "/" | "/services" | "/about" | "/contact";

export type ApprovedOgImageRef = {
  kind: "generated";
  key: "default";
};

export type PageSeo = {
  title: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageRef?: ApprovedOgImageRef;
};

export type SafeRoute = "/" | "/services" | "/about" | "/contact";
export type SafeAnchor = "#contact" | "#contact-form";

export type SafeCta =
  | { kind: "route"; label: string; href: SafeRoute }
  | { kind: "anchor"; label: string; href: SafeAnchor };

export type ServiceSlug =
  | "branding"
  | "website-design-development"
  | "custom-cms"
  | "crm-business-tools"
  | "custom-web-applications";

export type ServiceReference = {
  kind: "service";
  slug: ServiceSlug;
};

export type PageSectionKey =
  | "home_hero"
  | "home_intro"
  | "home_capabilities"
  | "home_approach"
  | "home_proof"
  | "home_contact"
  | "services_hero"
  | "services_capabilities"
  | "about_hero"
  | "about_principles"
  | "about_people"
  | "contact_hero"
  | "contact_process"
  | "contact_form";

type TextField = string;

export type HomeHeroSection = PageSection<"home_hero", {
  eyebrow: TextField;
  title: TextField;
  intro: TextField;
  ctas: SafeCta[];
}>;

export type HomeIntroSection = PageSection<"home_intro", {
  eyebrow: TextField;
  heading: TextField;
  body: TextField;
}>;

export type HomeCapabilitiesSection = PageSection<"home_capabilities", {
  eyebrow: TextField;
  heading: TextField;
  note: TextField;
  items: Array<{
    service: ServiceReference;
    ctaLabel: TextField;
  }>;
}>;

export type HomeApproachSection = PageSection<"home_approach", {
  eyebrow: TextField;
  heading: TextField;
  items: Array<{ title: TextField; body: TextField }>;
}>;

export type HomeProofSection = PageSection<"home_proof", {
  eyebrow: TextField;
  heading: TextField;
  body: TextField;
}>;

export type HomeContactSection = PageSection<"home_contact", {
  eyebrow: TextField;
  heading: TextField;
  body: TextField;
  cta: SafeCta;
}>;

export type ServicesHeroSection = PageSection<"services_hero", {
  eyebrow: TextField;
  title: TextField;
  intro: TextField;
}>;

export type ServicesCapabilitiesSection = PageSection<"services_capabilities", {
  eyebrow?: TextField;
  heading?: TextField;
  note?: TextField;
}>;

export type AboutHeroSection = PageSection<"about_hero", {
  eyebrow: TextField;
  title: TextField;
  intro: TextField;
}>;

export type AboutPrinciplesSection = PageSection<"about_principles", {
  eyebrow: TextField;
  heading: TextField;
  items: Array<{ title: TextField; body: TextField }>;
}>;

export type AboutPeopleSection = PageSection<"about_people", {
  eyebrow: TextField;
  heading: TextField;
  cta: SafeCta;
}>;

export type ContactHeroSection = PageSection<"contact_hero", {
  eyebrow: TextField;
  title: TextField;
  intro: TextField;
}>;

export type ContactProcessSection = PageSection<"contact_process", {
  eyebrow: TextField;
  heading: TextField;
  items: Array<{ title: TextField; body: TextField }>;
  cta: SafeCta;
}>;

export type ContactFormSection = PageSection<"contact_form", {
  eyebrow: TextField;
  heading: TextField;
  intro: TextField;
}>;

type PageSection<K extends PageSectionKey, C> = {
  key: K;
  enabled: boolean;
  order: number;
  content: C;
};

export type PageSectionDocument =
  | HomeHeroSection
  | HomeIntroSection
  | HomeCapabilitiesSection
  | HomeApproachSection
  | HomeProofSection
  | HomeContactSection
  | ServicesHeroSection
  | ServicesCapabilitiesSection
  | AboutHeroSection
  | AboutPrinciplesSection
  | AboutPeopleSection
  | ContactHeroSection
  | ContactProcessSection
  | ContactFormSection;

export type PageDocument = {
  schemaVersion: 1;
  pageKey: PageKey;
  seo: PageSeo;
  sections: PageSectionDocument[];
};

export type PageDocumentValidationResult =
  | { success: true; value: PageDocument }
  | { success: false; issues: string[] };

export type PageContentReadResult =
  | { kind: "legacy"; content: unknown[] }
  | { kind: "page-document"; document: PageDocument }
  | { kind: "invalid"; issues: string[] };

const SERVICE_SLUGS = new Set<ServiceSlug>([
  "branding",
  "website-design-development",
  "custom-cms",
  "crm-business-tools",
  "custom-web-applications",
]);

const PAGE_ROUTES = new Set<SafeRoute>(["/", "/services", "/about", "/contact"]);
const SAFE_ANCHORS = new Set<SafeAnchor>(["#contact", "#contact-form"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, issues: string[]) {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      issues.push(`${path}.${key}: unknown field`);
    }
  }
}

function requiredString(value: unknown, path: string, issues: string[], max = 2000): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push(`${path}: required non-empty string`);
    return "";
  }

  const trimmed = value.trim();
  if (trimmed.length > max) {
    issues.push(`${path}: exceeds ${max} characters`);
  }
  if (/[<>]/.test(trimmed)) {
    issues.push(`${path}: HTML-like markup is not allowed`);
  }
  return trimmed;
}

function optionalString(value: unknown, path: string, issues: string[], max = 2000): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return requiredString(value, path, issues, max);
}

function parseCta(value: unknown, path: string, issues: string[]): SafeCta {
  if (!isRecord(value)) {
    issues.push(`${path}: expected CTA object`);
    return { kind: "route", label: "", href: "/" };
  }

  exactKeys(value, ["kind", "label", "href"], path, issues);
  const label = requiredString(value.label, `${path}.label`, issues, 80);
  if (value.kind === "route" && typeof value.href === "string" && PAGE_ROUTES.has(value.href as SafeRoute)) {
    return { kind: "route", label, href: value.href as SafeRoute };
  }
  if (value.kind === "anchor" && typeof value.href === "string" && SAFE_ANCHORS.has(value.href as SafeAnchor)) {
    return { kind: "anchor", label, href: value.href as SafeAnchor };
  }

  issues.push(`${path}: CTA destination or kind is not allowed`);
  return { kind: "route", label, href: "/" };
}

function parseServiceReference(value: unknown, path: string, issues: string[]): ServiceReference {
  if (!isRecord(value)) {
    issues.push(`${path}: expected Service reference object`);
    return { kind: "service", slug: "branding" };
  }

  exactKeys(value, ["kind", "slug"], path, issues);
  if (value.kind !== "service" || typeof value.slug !== "string" || !SERVICE_SLUGS.has(value.slug as ServiceSlug)) {
    issues.push(`${path}: unknown Service reference`);
    return { kind: "service", slug: "branding" };
  }
  return { kind: "service", slug: value.slug as ServiceSlug };
}

function parseTextItems(value: unknown, path: string, issues: string[], expectedLength: number) {
  if (!Array.isArray(value)) {
    issues.push(`${path}: expected an array of exactly ${expectedLength} items`);
    return [] as Array<{ title: string; body: string }>;
  }
  if (value.length !== expectedLength) {
    issues.push(`${path}: expected exactly ${expectedLength} items`);
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      issues.push(`${path}[${index}]: expected item object`);
      return { title: "", body: "" };
    }
    exactKeys(item, ["title", "body"], `${path}[${index}]`, issues);
    return {
      title: requiredString(item.title, `${path}[${index}].title`, issues, 180),
      body: requiredString(item.body, `${path}[${index}].body`, issues),
    };
  });
}

function parseSectionContent(key: PageSectionKey, value: unknown, path: string, issues: string[]): PageSectionDocument["content"] {
  if (!isRecord(value)) {
    issues.push(`${path}: expected content object`);
    return {} as PageSectionDocument["content"];
  }

  switch (key) {
    case "home_hero": {
      exactKeys(value, ["eyebrow", "title", "intro", "ctas"], path, issues);
      const ctas = Array.isArray(value.ctas)
        ? value.ctas.map((cta, index) => parseCta(cta, `${path}.ctas[${index}]`, issues))
        : [];
      if (!Array.isArray(value.ctas) || ctas.length > 2) {
        issues.push(`${path}.ctas: expected at most two CTAs`);
      }
      return {
        eyebrow: requiredString(value.eyebrow, `${path}.eyebrow`, issues, 80),
        title: requiredString(value.title, `${path}.title`, issues, 180),
        intro: requiredString(value.intro, `${path}.intro`, issues),
        ctas,
      };
    }
    case "home_intro":
    case "home_proof":
    case "services_hero":
    case "about_hero":
    case "contact_hero": {
      const isHero = key.endsWith("hero");
      const fields = isHero ? ["eyebrow", "title", "intro"] : ["eyebrow", "heading", "body"];
      exactKeys(value, fields, path, issues);
      if (isHero) {
        return {
          eyebrow: requiredString(value.eyebrow, `${path}.eyebrow`, issues, 80),
          title: requiredString(value.title, `${path}.title`, issues, 180),
          intro: requiredString(value.intro, `${path}.intro`, issues),
        };
      }
      return {
        eyebrow: requiredString(value.eyebrow, `${path}.eyebrow`, issues, 80),
        heading: requiredString(value.heading, `${path}.heading`, issues, 180),
        body: requiredString(value.body, `${path}.body`, issues),
      };
    }
    case "home_capabilities": {
      exactKeys(value, ["eyebrow", "heading", "note", "items"], path, issues);
      if (!Array.isArray(value.items)) {
        issues.push(`${path}.items: expected exactly five items`);
      }
      const items = Array.isArray(value.items)
        ? value.items.map((item, index) => {
          if (!isRecord(item)) {
            issues.push(`${path}.items[${index}]: expected item object`);
            return { service: { kind: "service" as const, slug: "branding" as ServiceSlug }, ctaLabel: "" };
          }
          exactKeys(item, ["service", "ctaLabel"], `${path}.items[${index}]`, issues);
          return {
            service: parseServiceReference(item.service, `${path}.items[${index}].service`, issues),
            ctaLabel: requiredString(item.ctaLabel, `${path}.items[${index}].ctaLabel`, issues, 80),
          };
        })
        : [];
      if (items.length !== 5) {
        issues.push(`${path}.items: expected exactly five items`);
      }
      return {
        eyebrow: requiredString(value.eyebrow, `${path}.eyebrow`, issues, 80),
        heading: requiredString(value.heading, `${path}.heading`, issues, 180),
        note: requiredString(value.note, `${path}.note`, issues),
        items,
      };
    }
    case "home_approach":
    case "about_principles":
    case "contact_process": {
      const hasCta = key === "contact_process";
      exactKeys(value, hasCta ? ["eyebrow", "heading", "items", "cta"] : ["eyebrow", "heading", "items"], path, issues);
      const result = {
        eyebrow: requiredString(value.eyebrow, `${path}.eyebrow`, issues, 80),
        heading: requiredString(value.heading, `${path}.heading`, issues, 180),
        items: parseTextItems(value.items, `${path}.items`, issues, 3),
      };
      if (hasCta) {
        return { ...result, cta: parseCta(value.cta, `${path}.cta`, issues) };
      }
      return result;
    }
    case "home_contact":
    case "about_people": {
      exactKeys(value, ["eyebrow", "heading", "body", "cta"], path, issues);
      const body = optionalString(value.body, `${path}.body`, issues);
      if (body === undefined) {
        issues.push(`${path}.body: required non-empty string`);
      }
      return {
        eyebrow: requiredString(value.eyebrow, `${path}.eyebrow`, issues, 80),
        heading: requiredString(value.heading, `${path}.heading`, issues, 180),
        body: body || "",
        cta: parseCta(value.cta, `${path}.cta`, issues),
      };
    }
    case "services_capabilities": {
      exactKeys(value, ["eyebrow", "heading", "note"], path, issues);
      return {
        eyebrow: optionalString(value.eyebrow, `${path}.eyebrow`, issues, 80),
        heading: optionalString(value.heading, `${path}.heading`, issues, 180),
        note: optionalString(value.note, `${path}.note`, issues),
      };
    }
    case "contact_form":
      exactKeys(value, ["eyebrow", "heading", "intro"], path, issues);
      return {
        eyebrow: requiredString(value.eyebrow, `${path}.eyebrow`, issues, 80),
        heading: requiredString(value.heading, `${path}.heading`, issues, 180),
        intro: requiredString(value.intro, `${path}.intro`, issues),
      };
  }
}

function validateSection(value: unknown, index: number, pageKey: PageKey, issues: string[]): PageSectionDocument | null {
  const path = `sections[${index}]`;
  if (!isRecord(value)) {
    issues.push(`${path}: expected section object`);
    return null;
  }
  exactKeys(value, ["key", "enabled", "order", "content"], path, issues);

  if (typeof value.key !== "string" || !(value.key in SECTION_REGISTRY)) {
    issues.push(`${path}.key: unknown section key`);
    return null;
  }

  const key = value.key as PageSectionKey;
  const page = getPageDefinition(pageKey);
  if (!page.allowedSections.some((allowedKey) => allowedKey === key)) {
    issues.push(`${path}.key: section is not allowed on ${pageKey}`);
  }
  if (typeof value.enabled !== "boolean") {
    issues.push(`${path}.enabled: expected boolean`);
  }
  if (typeof value.order !== "number" || !Number.isInteger(value.order) || value.order < 0) {
    issues.push(`${path}.order: expected non-negative integer`);
  }

  const content = parseSectionContent(key, value.content, `${path}.content`, issues);
  return { key, enabled: value.enabled === true, order: typeof value.order === "number" ? value.order : 0, content } as PageSectionDocument;
}

function validateBlueprint(sections: PageSectionDocument[], pageKey: PageKey, issues: string[]) {
  const page = getPageDefinition(pageKey);
  const byKey = new Map(sections.map((section) => [section.key, section]));
  const orders = new Set<number>();

  for (const section of sections) {
    if (orders.has(section.order)) {
      issues.push(`sections.${section.key}.order: duplicate order`);
    }
    orders.add(section.order);
  }

  for (const blueprint of page.blueprint) {
    const section = byKey.get(blueprint.key);
    if (!section) {
      if (blueprint.required) {
        issues.push(`sections.${blueprint.key}: required section is missing`);
      }
      continue;
    }
    if (blueprint.required && !section.enabled) {
      issues.push(`sections.${blueprint.key}.enabled: required section cannot be disabled`);
    }
    if (!blueprint.canHide && !section.enabled) {
      issues.push(`sections.${blueprint.key}.enabled: section cannot be hidden`);
    }
  }

  const enabled = sections.filter((section) => section.enabled).sort((a, b) => a.order - b.order);
  const first = enabled[0];
  const last = enabled.at(-1);
  const firstBlueprint = page.blueprint.find((section) => section.position === "first");
  const lastBlueprint = page.blueprint.find((section) => section.position === "last");
  if (firstBlueprint && first?.key !== firstBlueprint.key) {
    issues.push(`sections.${firstBlueprint.key}: must be first and enabled`);
  }
  const lastSection = lastBlueprint ? byKey.get(lastBlueprint.key) : undefined;
  if (lastBlueprint && lastSection?.enabled && last?.key !== lastBlueprint.key) {
    issues.push(`sections.${lastBlueprint.key}: must be last when enabled`);
  }
  const hero = firstBlueprint ? byKey.get(firstBlueprint.key) : undefined;
  for (const blueprint of page.blueprint.filter((section) => section.position === "after-hero")) {
    const section = byKey.get(blueprint.key);
    if (section && hero && section.order <= hero.order) {
      issues.push(`sections.${blueprint.key}: must follow the hero`);
    }
  }
}

export function validatePageDocument(input: unknown, expectedPageKey?: PageKey): PageDocumentValidationResult {
  const issues: string[] = [];
  if (!isRecord(input)) {
    return { success: false, issues: ["PageDocument must be an object"] };
  }

  exactKeys(input, ["schemaVersion", "pageKey", "seo", "sections"], "document", issues);
  if (input.schemaVersion !== 1) {
    issues.push("schemaVersion: expected 1");
  }
  if (typeof input.pageKey !== "string" || !isPageKey(input.pageKey)) {
    issues.push("pageKey: unknown page key");
  }
  const candidatePageKey = typeof input.pageKey === "string" && isPageKey(input.pageKey)
    ? input.pageKey
    : null;
  const pageKey: PageKey = candidatePageKey ?? "home";
  if (expectedPageKey && pageKey !== expectedPageKey) {
    issues.push(`pageKey: expected ${expectedPageKey}`);
  }

  const seoValue = input.seo;
  let seo: PageSeo = { title: "", description: "" };
  if (!isRecord(seoValue)) {
    issues.push("seo: expected object");
  } else {
    exactKeys(seoValue, ["title", "description", "ogTitle", "ogDescription", "ogImageRef"], "seo", issues);
    seo = {
      title: requiredString(seoValue.title, "seo.title", issues, 70),
      description: requiredString(seoValue.description, "seo.description", issues, 160),
      ogTitle: optionalString(seoValue.ogTitle, "seo.ogTitle", issues, 70),
      ogDescription: optionalString(seoValue.ogDescription, "seo.ogDescription", issues, 160),
    };
    if (seoValue.ogImageRef !== undefined) {
      if (!isRecord(seoValue.ogImageRef)) {
        issues.push("seo.ogImageRef: expected generated default reference");
      } else {
        exactKeys(seoValue.ogImageRef, ["kind", "key"], "seo.ogImageRef", issues);
        if (seoValue.ogImageRef.kind !== "generated" || seoValue.ogImageRef.key !== "default") {
          issues.push("seo.ogImageRef: only generated/default is allowed");
        } else {
          seo.ogImageRef = { kind: "generated", key: "default" };
        }
      }
    }
  }

  const sections = Array.isArray(input.sections)
    ? input.sections.map((section, index) => validateSection(section, index, pageKey, issues)).filter((section): section is PageSectionDocument => section !== null)
    : [];
  if (!Array.isArray(input.sections)) {
    issues.push("sections: expected array");
  }
  const keys = new Set<PageSectionKey>();
  for (const section of sections) {
    if (keys.has(section.key)) {
      issues.push(`sections.${section.key}: duplicate section key`);
    }
    keys.add(section.key);
  }
  validateBlueprint(sections, pageKey, issues);

  return issues.length > 0
    ? { success: false, issues }
    : { success: true, value: { schemaVersion: 1, pageKey, seo, sections } };
}

export function readPageContent(input: unknown, expectedPageKey?: PageKey): PageContentReadResult {
  if (Array.isArray(input)) {
    return { kind: "legacy", content: input };
  }
  if (!isRecord(input)) {
    return { kind: "invalid", issues: ["Page content must be a legacy array or a PageDocument object"] };
  }
  const result = validatePageDocument(input, expectedPageKey);
  return result.success
    ? { kind: "page-document", document: result.value }
    : { kind: "invalid", issues: result.issues };
}

export function getPageDocumentHero(document: PageDocument) {
  const hero = document.sections.find((section) => section.key.endsWith("_hero"));
  if (!hero || !hero.enabled) {
    return {};
  }
  const content = hero.content;
  if ("title" in content && "intro" in content) {
    return { eyebrow: content.eyebrow, title: content.title, intro: content.intro };
  }
  return {};
}

export function getSectionBlueprint(key: PageSectionKey): PageSectionBlueprint {
  return SECTION_REGISTRY[key];
}
