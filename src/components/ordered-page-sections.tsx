import { Fragment, type ReactNode } from "react";
import type { PageSectionConfig } from "@/lib/page-sections";

type OrderedPageSectionsProps = {
  sections: PageSectionConfig[];
  blocks: Record<string, ReactNode>;
};

export function OrderedPageSections({ sections, blocks }: OrderedPageSectionsProps) {
  return sections
    .filter((section) => section.isVisible && section.sectionKey in blocks)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => <Fragment key={section.sectionKey}>{blocks[section.sectionKey]}</Fragment>);
}
