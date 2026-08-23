import type { PageDocument, PageKey, PageSectionDocument, PageSectionKey } from "@/lib/page-document";

export type PageDocumentSectionRendererId =
  | "home.hero"
  | "home.intro"
  | "home.capabilities"
  | "home.approach"
  | "home.proof"
  | "home.contact"
  | "services.hero"
  | "services.capabilities"
  | "about.hero"
  | "about.principles"
  | "about.people"
  | "contact.hero"
  | "contact.process"
  | "contact.form";

export type PageDocumentSectionRendererDefinition = {
  pageKey: PageKey;
  rendererId: PageDocumentSectionRendererId;
};

export const PAGE_DOCUMENT_SECTION_RENDERERS = {
  home_hero: { pageKey: "home", rendererId: "home.hero" },
  home_intro: { pageKey: "home", rendererId: "home.intro" },
  home_capabilities: { pageKey: "home", rendererId: "home.capabilities" },
  home_approach: { pageKey: "home", rendererId: "home.approach" },
  home_proof: { pageKey: "home", rendererId: "home.proof" },
  home_contact: { pageKey: "home", rendererId: "home.contact" },
  services_hero: { pageKey: "services", rendererId: "services.hero" },
  services_capabilities: { pageKey: "services", rendererId: "services.capabilities" },
  about_hero: { pageKey: "about", rendererId: "about.hero" },
  about_principles: { pageKey: "about", rendererId: "about.principles" },
  about_people: { pageKey: "about", rendererId: "about.people" },
  contact_hero: { pageKey: "contact", rendererId: "contact.hero" },
  contact_process: { pageKey: "contact", rendererId: "contact.process" },
  contact_form: { pageKey: "contact", rendererId: "contact.form" },
} as const satisfies Record<PageSectionKey, PageDocumentSectionRendererDefinition>;

const PAGE_DOCUMENT_PAGE_KEYS = new Set<PageKey>(["home", "services", "about", "contact"]);

export type PageDocumentRenderPlanItem = {
  key: PageSectionKey;
  order: number;
  rendererId: PageDocumentSectionRendererId;
  content: PageSectionDocument["content"];
};

export type PageDocumentRenderPlan = {
  pageKey: PageKey;
  sections: PageDocumentRenderPlanItem[];
};

/**
 * Produces a deterministic plan only. Slice 4A deliberately does not connect
 * this registry to any live public route or React component.
 */
export function createPageDocumentRenderPlan(document: PageDocument): PageDocumentRenderPlan {
  if (!PAGE_DOCUMENT_PAGE_KEYS.has(document.pageKey)) {
    throw new Error(`PageDocument rendering does not support ${String(document.pageKey)}`);
  }

  const sections = document.sections
    .filter((section) => section.enabled)
    .map((section) => {
      const renderer = PAGE_DOCUMENT_SECTION_RENDERERS[section.key];
      if (!renderer) {
        throw new Error(`No approved PageDocument renderer exists for ${section.key}`);
      }
      if (renderer.pageKey !== document.pageKey) {
        throw new Error(`${section.key} is not approved for ${document.pageKey}`);
      }
      return {
        key: section.key,
        order: section.order,
        rendererId: renderer.rendererId,
        content: section.content,
      };
    })
    .sort((left, right) => left.order - right.order);

  return { pageKey: document.pageKey, sections };
}
