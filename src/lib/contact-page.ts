import type {
  ContactFormSection,
  ContactHeroSection,
  ContactProcessSection,
  PageDocument,
} from "@/lib/page-document";
import {
  createPageDocumentRenderPlan,
  type PageDocumentRenderPlan,
  type PageDocumentRenderPlanItem,
} from "@/lib/page-document-renderer";

export type ContactPageBodySection =
  | {
      key: "contact_process";
      order: number;
      rendererId: "contact.process";
      content: ContactProcessSection["content"];
    }
  | {
      key: "contact_form";
      order: number;
      rendererId: "contact.form";
      content: ContactFormSection["content"];
    };

export type ContactPageRenderData = {
  hero: ContactHeroSection["content"];
  body: ContactPageBodySection[];
  plan: PageDocumentRenderPlan;
};

function toContactBodySection(section: PageDocumentRenderPlanItem): ContactPageBodySection {
  switch (section.key) {
    case "contact_process":
      return {
        key: section.key,
        order: section.order,
        rendererId: "contact.process",
        content: section.content as ContactProcessSection["content"],
      };
    case "contact_form":
      return {
        key: section.key,
        order: section.order,
        rendererId: "contact.form",
        content: section.content as ContactFormSection["content"],
      };
    case "contact_hero":
      throw new Error("Contact hero must be rendered by the route shell");
    default:
      throw new Error(`Unexpected PageDocument section in Contact render plan: ${section.key}`);
  }
}

export function createContactPageRenderData(document: PageDocument): ContactPageRenderData {
  if (document.pageKey !== "contact") {
    throw new Error(`Contact render data requires a Contact PageDocument, received ${document.pageKey}`);
  }

  const plan = createPageDocumentRenderPlan(document);
  const hero = document.sections.find((section) => section.key === "contact_hero" && section.enabled);
  if (!hero || hero.key !== "contact_hero") {
    throw new Error("A published Contact PageDocument must contain an enabled hero");
  }

  const body = plan.sections
    .filter((section) => section.key !== "contact_hero")
    .map(toContactBodySection);

  return {
    hero: hero.content,
    body,
    plan,
  };
}
