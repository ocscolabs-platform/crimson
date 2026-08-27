import type {
  AboutHeroSection,
  AboutPeopleSection,
  AboutPrinciplesSection,
  PageDocument,
} from "@/lib/page-document";
import {
  createPageDocumentRenderPlan,
  type PageDocumentRenderPlan,
  type PageDocumentRenderPlanItem,
} from "@/lib/page-document-renderer";

export type AboutPageBodySection =
  | {
      key: "about_principles";
      order: number;
      rendererId: "about.principles";
      content: AboutPrinciplesSection["content"];
    }
  | {
      key: "about_people";
      order: number;
      rendererId: "about.people";
      content: AboutPeopleSection["content"];
    };

export type AboutPageRenderData = {
  hero: AboutHeroSection["content"];
  body: AboutPageBodySection[];
  plan: PageDocumentRenderPlan;
};

function toAboutBodySection(section: PageDocumentRenderPlanItem): AboutPageBodySection {
  switch (section.key) {
    case "about_principles":
      return {
        key: section.key,
        order: section.order,
        rendererId: "about.principles",
        content: section.content as AboutPrinciplesSection["content"],
      };
    case "about_people":
      return {
        key: section.key,
        order: section.order,
        rendererId: "about.people",
        content: section.content as AboutPeopleSection["content"],
      };
    case "about_hero":
      throw new Error("About hero must be rendered by the route shell");
    default:
      throw new Error(`Unexpected PageDocument section in About render plan: ${section.key}`);
  }
}

export function createAboutPageRenderData(document: PageDocument): AboutPageRenderData {
  if (document.pageKey !== "about") {
    throw new Error(`About render data requires an About PageDocument, received ${document.pageKey}`);
  }

  const plan = createPageDocumentRenderPlan(document);
  const hero = document.sections.find((section) => section.key === "about_hero" && section.enabled);
  if (!hero || hero.key !== "about_hero") {
    throw new Error("A published About PageDocument must contain an enabled hero");
  }

  const body = plan.sections
    .filter((section) => section.key !== "about_hero")
    .map(toAboutBodySection);

  return {
    hero: hero.content,
    body,
    plan,
  };
}
