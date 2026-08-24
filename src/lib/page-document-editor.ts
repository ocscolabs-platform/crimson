import { getPageDefinition, type PageSectionBlueprint } from "@/lib/page-registry";
import { validatePageDocument, type PageDocument, type PageKey, type PageSectionKey } from "@/lib/page-document";

export function validatePageDocumentDraft(document: unknown, pageKey: PageKey) {
  return validatePageDocument(document, pageKey);
}

export function canEditSectionVisibility(pageKey: PageKey, sectionKey: PageSectionKey) {
  return getPageDefinition(pageKey).blueprint.some((section) => section.key === sectionKey && section.canHide);
}

export function getSectionMoveState(document: PageDocument, sectionKey: PageSectionKey) {
  const definition = getPageDefinition(document.pageKey);
  const blueprint = definition.blueprint.find((section) => section.key === sectionKey) as PageSectionBlueprint | undefined;
  if (!blueprint || blueprint.position !== "flexible") {
    return { canMoveUp: false, canMoveDown: false };
  }

  const flexibleKeys = new Set<PageSectionKey>(
    definition.blueprint.filter((section) => section.position === "flexible").map((section) => section.key as PageSectionKey),
  );
  const flexibleSections = document.sections
    .filter((section) => flexibleKeys.has(section.key))
    .sort((left, right) => left.order - right.order);
  const index = flexibleSections.findIndex((section) => section.key === sectionKey);

  return {
    canMoveUp: index > 0,
    canMoveDown: index >= 0 && index < flexibleSections.length - 1,
  };
}

export function movePageDocumentSection(document: PageDocument, sectionKey: PageSectionKey, direction: "up" | "down") {
  const state = getSectionMoveState(document, sectionKey);
  if ((direction === "up" && !state.canMoveUp) || (direction === "down" && !state.canMoveDown)) {
    return document;
  }

  const definition = getPageDefinition(document.pageKey);
  const flexibleKeys = new Set<PageSectionKey>(
    definition.blueprint.filter((section) => section.position === "flexible").map((section) => section.key as PageSectionKey),
  );
  const flexibleSections = document.sections
    .filter((section) => flexibleKeys.has(section.key))
    .sort((left, right) => left.order - right.order);
  const index = flexibleSections.findIndex((section) => section.key === sectionKey);
  const neighbor = flexibleSections[index + (direction === "up" ? -1 : 1)];
  if (!neighbor) return document;

  const next = structuredClone(document) as PageDocument;
  const current = next.sections.find((section) => section.key === sectionKey);
  const nextNeighbor = next.sections.find((section) => section.key === neighbor.key);
  if (!current || !nextNeighbor) return document;

  const order = current.order;
  current.order = nextNeighbor.order;
  nextNeighbor.order = order;
  return next;
}
