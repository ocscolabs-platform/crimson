import type {
  HomeApproachSection,
  HomeCapabilitiesSection,
  HomeContactSection,
  HomeHeroSection,
  HomeIntroSection,
  HomeProofSection,
  PageDocument,
} from "@/lib/page-document";
import {
  createPageDocumentRenderPlan,
  type PageDocumentRenderPlan,
  type PageDocumentRenderPlanItem,
} from "@/lib/page-document-renderer";
import type { Service } from "@/lib/site-content";

export type HomePageBodySection =
  | {
      key: "home_intro";
      order: number;
      rendererId: "home.intro";
      content: HomeIntroSection["content"];
    }
  | {
      key: "home_capabilities";
      order: number;
      rendererId: "home.capabilities";
      content: HomeCapabilitiesSection["content"];
      services: Service[];
    }
  | {
      key: "home_approach";
      order: number;
      rendererId: "home.approach";
      content: HomeApproachSection["content"];
    }
  | {
      key: "home_proof";
      order: number;
      rendererId: "home.proof";
      content: HomeProofSection["content"];
    }
  | {
      key: "home_contact";
      order: number;
      rendererId: "home.contact";
      content: HomeContactSection["content"];
    };

export type HomePageRenderData = {
  hero: HomeHeroSection["content"];
  body: HomePageBodySection[];
  plan: PageDocumentRenderPlan;
};

function assertServiceOrder(content: HomeCapabilitiesSection["content"], services: Service[]) {
  if (content.items.length !== services.length) {
    throw new Error("Home capabilities must resolve every approved Service reference");
  }

  content.items.forEach((item, index) => {
    if (item.service.slug !== services[index]?.slug) {
      throw new Error(`Home Service reference order mismatch at item ${index + 1}`);
    }
  });
}

function toHomeBodySection(
  section: PageDocumentRenderPlanItem,
  services: Service[],
): HomePageBodySection {
  switch (section.key) {
    case "home_intro":
      return {
        key: section.key,
        order: section.order,
        rendererId: "home.intro",
        content: section.content as HomeIntroSection["content"],
      };
    case "home_capabilities": {
      const content = section.content as HomeCapabilitiesSection["content"];
      assertServiceOrder(content, services);
      return {
        key: section.key,
        order: section.order,
        rendererId: "home.capabilities",
        content,
        services,
      };
    }
    case "home_approach":
      return {
        key: section.key,
        order: section.order,
        rendererId: "home.approach",
        content: section.content as HomeApproachSection["content"],
      };
    case "home_proof":
      return {
        key: section.key,
        order: section.order,
        rendererId: "home.proof",
        content: section.content as HomeProofSection["content"],
      };
    case "home_contact":
      return {
        key: section.key,
        order: section.order,
        rendererId: "home.contact",
        content: section.content as HomeContactSection["content"],
      };
    case "home_hero":
      throw new Error("Home hero must be rendered by the route shell");
    default:
      throw new Error(`Unexpected PageDocument section in Home render plan: ${section.key}`);
  }
}

export function createHomePageRenderData(document: PageDocument, services: Service[]): HomePageRenderData {
  if (document.pageKey !== "home") {
    throw new Error(`Home render data requires a Home PageDocument, received ${document.pageKey}`);
  }

  const plan = createPageDocumentRenderPlan(document);
  const hero = plan.sections.find((section) => section.key === "home_hero");
  if (!hero || hero.key !== "home_hero") {
    throw new Error("A published Home PageDocument must contain an enabled hero");
  }

  const body = plan.sections
    .filter((section) => section.key !== "home_hero")
    .map((section) => toHomeBodySection(section, services));

  return {
    hero: hero.content as HomeHeroSection["content"],
    body,
    plan,
  };
}
