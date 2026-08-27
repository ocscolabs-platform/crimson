import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROUTES = {
  about: "src/app/about/page.tsx",
  home: "src/app/page.tsx",
  services: "src/app/services/page.tsx",
  contact: "src/app/contact/page.tsx",
  work: "src/app/work/page.tsx",
};

const LEGACY_READER = "getPublishedPageSections";
const LEGACY_METADATA_READER = /getPublishedPage\s*\(/;
const PAGE_DOCUMENT_MARKERS = /getPublishedPageDocument|readPageContent|PageDocument/;
const PAGE_METADATA_MARKER = /getPublishedPageMetadata\(\s*["'](?:home|services|about|contact)["']\s*\)/;

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

function requireAbsent(source, pattern, message) {
  if (pattern.test(source)) {
    throw new Error(message);
  }
}

export function verifyPublicAuthority(sources) {
  const about = sources.about;
  requireMatch(about, /getPublishedPageDocument\(\s*["']about["']\s*\)/, "About must use the published PageDocument loader.");
  requireMatch(about, /createAboutPageRenderData/, "About must use the deterministic approved render-plan path.");
  requireMatch(about, /result\.document/, "About must render the validated PageDocument result.");
  requireAbsent(about, new RegExp(LEGACY_READER), "About must not use the legacy page_sections reader for body authority.");
  requireMatch(about, /getPublishedPageMetadata\(\s*["']about["']\s*\)/, "About must use PageDocument metadata authority.");
  requireAbsent(about, LEGACY_METADATA_READER, "About must not use the legacy page-row metadata reader.");

  const services = sources.services;
  requireMatch(services, /getPublishedPageDocument\(\s*["']services["']\s*\)/, "Services must use the published PageDocument loader.");
  requireMatch(services, /createServicesPageRenderData/, "Services must use the deterministic approved render-plan path.");
  requireMatch(services, /result\.document/, "Services must render the validated PageDocument result.");
  requireAbsent(services, new RegExp(LEGACY_READER), "Services must not use the legacy page_sections reader for body authority.");
  requireMatch(services, /getPublishedPageMetadata\(\s*["']services["']\s*\)/, "Services must use PageDocument metadata authority.");
  requireAbsent(services, LEGACY_METADATA_READER, "Services must not use the legacy page-row metadata reader.");

  const contact = sources.contact;
  requireMatch(contact, /getPublishedPageDocument\(\s*["']contact["']\s*\)/, "Contact must use the published PageDocument loader.");
  requireMatch(contact, /createContactPageRenderData/, "Contact must use the deterministic approved render-plan path.");
  requireMatch(contact, /result\.document/, "Contact must render the validated PageDocument result.");
  requireAbsent(contact, new RegExp(LEGACY_READER), "Contact must not use the legacy page_sections reader for body authority.");
  requireMatch(contact, /getPublishedPageMetadata\(\s*["']contact["']\s*\)/, "Contact must use PageDocument metadata authority.");
  requireAbsent(contact, LEGACY_METADATA_READER, "Contact must not use the legacy page-row metadata reader.");

  const home = sources.home;
  requireMatch(home, /getPublishedPageDocument\(\s*["']home["']\s*\)/, "Home must use the published PageDocument loader.");
  requireMatch(home, /createHomePageRenderData/, "Home must use the deterministic approved render-plan path.");
  requireMatch(home, /result\.document/, "Home must render the validated PageDocument result.");
  requireAbsent(home, new RegExp(LEGACY_READER), "Home must not use the legacy page_sections reader for body authority.");
  requireMatch(home, /getPublishedPageMetadata\(\s*["']home["']\s*\)/, "Home must use PageDocument metadata authority.");
  requireAbsent(home, LEGACY_METADATA_READER, "Home must not use the legacy page-row metadata reader.");

  const work = sources.work;
  requireMatch(work, new RegExp(LEGACY_READER), "Work must remain on the legacy page_sections authority.");
  requireAbsent(work, PAGE_DOCUMENT_MARKERS, "Work must remain outside the PageDocument public path.");
  requireMatch(work, /getPublishedPage\(\s*["']work["']\s*\)/, "Work must retain legacy page-row metadata authority.");
  requireAbsent(work, PAGE_METADATA_MARKER, "Work must remain outside the PageDocument metadata path.");

  if (!sources.pageSections.includes('.from("page_sections")')) {
    throw new Error("The shared legacy page_sections reader is missing.");
  }

  return {
    body: {
      about: "PageDocument",
      home: "PageDocument",
      services: "PageDocument",
      contact: "PageDocument",
      work: "legacy",
    },
    metadata: {
      about: "PageDocument",
      home: "PageDocument",
      services: "PageDocument",
      contact: "PageDocument",
      work: "legacy",
    },
  };
}

async function readCurrentSources(root) {
  const entries = await Promise.all(
    Object.entries(ROUTES).map(async ([route, relativePath]) => [route, await readFile(`${root}/${relativePath}`, "utf8")]),
  );
  return Object.fromEntries([...entries, ["pageSections", await readFile(`${root}/src/lib/page-sections.ts`, "utf8")]]);
}

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sources = await readCurrentSources(process.cwd());
  const result = verifyPublicAuthority(sources);
  for (const [authorityType, routes] of Object.entries(result)) {
    console.log(`${authorityType} authority:`);
    for (const [route, authority] of Object.entries(routes)) {
      console.log(`${route}: ${authority}`);
    }
  }
  console.log("Verified the approved mixed Phase 5B public authority matrix.");
}
