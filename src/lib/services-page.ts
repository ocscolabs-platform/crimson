import type {
  ServicesCapabilitiesSection,
  ServicesHeroSection,
  PageDocument,
} from "@/lib/page-document";
import {
  createPageDocumentRenderPlan,
  type PageDocumentRenderPlan,
  type PageDocumentRenderPlanItem,
} from "@/lib/page-document-renderer";

export type ServicesPageRenderData = {
  hero: ServicesHeroSection["content"];
  capabilities: ServicesCapabilitiesSection["content"];
  plan: PageDocumentRenderPlan;
};

function getCapabilitiesSection(section: PageDocumentRenderPlanItem): ServicesCapabilitiesSection["content"] {
  if (section.key !== "services_capabilities") {
    throw new Error(`Unexpected PageDocument section in Services render plan: ${section.key}`);
  }
  return section.content as ServicesCapabilitiesSection["content"];
}

export function createServicesPageRenderData(document: PageDocument): ServicesPageRenderData {
  if (document.pageKey !== "services") {
    throw new Error(`Services render data requires a Services PageDocument, received ${document.pageKey}`);
  }

  const plan = createPageDocumentRenderPlan(document);
  const hero = plan.sections.find((section) => section.key === "services_hero");
  if (!hero || hero.key !== "services_hero") {
    throw new Error("A published Services PageDocument must contain an enabled hero");
  }

  const capabilities = plan.sections.find((section) => section.key === "services_capabilities");
  if (!capabilities) {
    throw new Error("A published Services PageDocument must contain enabled capabilities");
  }

  return {
    hero: hero.content as ServicesHeroSection["content"],
    capabilities: getCapabilitiesSection(capabilities),
    plan,
  };
}
