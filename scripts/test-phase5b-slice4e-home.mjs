import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": new URL("../src/", import.meta.url).pathname },
});
const { createHomePageRenderData } = await jiti.import("../src/lib/home-page.ts");
const {
  resolvePublishedPageDocumentRow,
  resolvePublishedServiceRows,
} = await jiti.import("../src/lib/page-document-loader.ts");
const { validatePageDocument } = await jiti.import("../src/lib/page-document.ts");

const now = new Date("2026-08-24T00:00:00.000Z");
const serviceSlugs = [
  "branding",
  "website-design-development",
  "custom-cms",
  "crm-business-tools",
  "custom-web-applications",
];

function homeDocument() {
  return {
    schemaVersion: 1,
    pageKey: "home",
    seo: {
      title: "OCSCO — Strategy, design, and technology",
      description: "Strategy, design, and technology for brands ready to move with precision.",
      ogImageRef: { kind: "generated", key: "default" },
    },
    sections: [
      {
        key: "home_hero", enabled: true, order: 0,
        content: {
          eyebrow: "Strategy / Design / Technology",
          title: "Digital infrastructure for brands ready to move with precision.",
          intro: "OCSCO integrates strategy, design, and technology to build digital systems that make ambitious businesses clearer, stronger, and ready for what comes next.",
          ctas: [
            { kind: "anchor", label: "Start a conversation", href: "#contact" },
            { kind: "route", label: "Explore the capabilities", href: "/services" },
          ],
        },
      },
      {
        key: "home_intro", enabled: true, order: 10,
        content: {
          eyebrow: "The work",
          heading: "A sharper digital presence starts with a better system.",
          body: "Your brand, website, and internal tools should reinforce one another. We bring the thinking and execution together so every part of the experience moves in the same direction.",
        },
      },
      {
        key: "home_capabilities", enabled: true, order: 20,
        content: {
          eyebrow: "Capabilities",
          heading: "Built as a system. Delivered with intent.",
          note: "Five connected capabilities. One clear standard: the work has to perform.",
          items: serviceSlugs.map((slug, index) => ({
            service: { kind: "service", slug },
            ctaLabel: ["Discuss branding", "Discuss a website", "Discuss a content system", "Discuss a business tool", "Discuss an application"][index],
          })),
        },
      },
      {
        key: "home_approach", enabled: true, order: 30,
        content: {
          eyebrow: "How we work",
          heading: "Clarity first. Craft all the way through.",
          items: [
            { title: "Understand the real problem", body: "We start with the business context, not a predetermined deliverable." },
            { title: "Architect the right system", body: "Strategy, design, and technology align around the outcome that matters." },
            { title: "Build with precision", body: "Senior-level thinking stays close to the work from first decision to final detail." },
          ],
        },
      },
      {
        key: "home_proof", enabled: true, order: 40,
        content: {
          eyebrow: "Proof of work",
          heading: "The work deserves the space to speak for itself.",
          body: "Selected case studies will be added here as projects, outcomes, and publication permissions are approved.",
        },
      },
      {
        key: "home_contact", enabled: true, order: 50,
        content: {
          eyebrow: "The next step",
          heading: "Bring us the thing that needs to work better.",
          body: "Start with a conversation. We will bring clarity to the opportunity, the path, and what it will take to build well.",
          cta: { kind: "route", label: "Start a conversation", href: "/contact" },
        },
      },
    ],
  };
}

function publishedRow(content, overrides = {}) {
  return {
    slug: "home",
    status: "published",
    published_at: "2026-08-23T00:00:00.000Z",
    content,
    ...overrides,
  };
}

function serviceRows() {
  return serviceSlugs.map((slug, index) => ({
    name: slug,
    card_name: `${slug} card`,
    slug,
    short_description: `${slug} summary`,
    audience: `${slug} audience`,
    outcome: `${slug} outcome`,
    status: "published",
    published_at: `2026-08-${String(10 + index).padStart(2, "0")}T00:00:00.000Z`,
  }));
}

test("valid Home PageDocument produces the complete ordered render data", () => {
  const document = homeDocument();
  assert.equal(validatePageDocument(document, "home").success, true);
  const result = resolvePublishedPageDocumentRow("home", publishedRow(document), now);
  assert.equal(result.kind, "document");
  if (result.kind !== "document") return;

  const servicesResult = resolvePublishedServiceRows(result.document, serviceRows(), now);
  assert.equal(servicesResult.kind, "resolved");
  if (servicesResult.kind !== "resolved") return;

  const view = createHomePageRenderData(result.document, servicesResult.services);
  assert.deepEqual(view.plan.sections.map((section) => section.key), [
    "home_hero", "home_intro", "home_capabilities", "home_approach", "home_proof", "home_contact",
  ]);
  assert.equal(view.hero.title, document.sections[0].content.title);
  assert.deepEqual(view.body.map((section) => section.key), [
    "home_intro", "home_capabilities", "home_approach", "home_proof", "home_contact",
  ]);
  assert.deepEqual(view.body[1].services.map((service) => service.slug), serviceSlugs);
  assert.equal(view.body[2].content.items.length, 3);
  assert.equal(view.body[4].content.cta.href, "/contact");
});

test("Home preserves the approved optional proof visibility and required boundaries", () => {
  const document = homeDocument();
  document.sections[4].enabled = false;
  const result = resolvePublishedPageDocumentRow("home", publishedRow(document), now);
  assert.equal(result.kind, "document");
  if (result.kind !== "document") return;

  const view = createHomePageRenderData(result.document, serviceRows().map((row) => ({
    slug: row.slug, name: row.name, cardName: row.card_name, summary: row.short_description,
    audience: row.audience, outcome: row.outcome,
  })));
  assert.deepEqual(view.body.map((section) => section.key), [
    "home_intro", "home_capabilities", "home_approach", "home_contact",
  ]);
});

test("missing, unpublished, future, and malformed Home documents fail closed", () => {
  const document = homeDocument();
  assert.equal(resolvePublishedPageDocumentRow("home", null, now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("home", publishedRow(document, { status: "review" }), now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("home", publishedRow(document, { published_at: "2026-08-25T00:00:00.000Z" }), now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("home", publishedRow({ schemaVersion: 2 }), now).kind, "invalid");
});

test("Home validator rejects malformed sections, unsupported sections, and unsafe CTAs", () => {
  const document = homeDocument();
  const malformed = structuredClone(document);
  malformed.sections[2].content.items[0].service.slug = "not-approved";
  assert.equal(validatePageDocument(malformed, "home").success, false);

  const unsupported = structuredClone(document);
  unsupported.sections[1].key = "about_people";
  assert.equal(validatePageDocument(unsupported, "home").success, false);

  const unsafeCta = structuredClone(document);
  unsafeCta.sections[5].content.cta.href = "https://example.com";
  assert.equal(validatePageDocument(unsafeCta, "home").success, false);

  const missingRequired = structuredClone(document);
  missingRequired.sections = missingRequired.sections.filter((section) => section.key !== "home_intro");
  assert.equal(validatePageDocument(missingRequired, "home").success, false);
});

test("Home Service references require exact order and a complete published set", () => {
  const document = homeDocument();
  const valid = resolvePublishedServiceRows(document, serviceRows(), now);
  assert.equal(valid.kind, "resolved");

  const reordered = serviceRows().reverse();
  assert.equal(resolvePublishedServiceRows(document, reordered, now).kind, "resolved");
  const missing = serviceRows().slice(1);
  assert.equal(resolvePublishedServiceRows(document, missing, now).kind, "invalid");
  assert.equal(resolvePublishedServiceRows(document, serviceRows().map((row, index) => index === 0 ? { ...row, status: "draft" } : row), now).kind, "invalid");
  assert.equal(resolvePublishedServiceRows(document, serviceRows().map((row, index) => index === 0 ? { ...row, published_at: "2026-08-25T00:00:00.000Z" } : row), now).kind, "invalid");
  const duplicateDocument = structuredClone(document);
  duplicateDocument.sections[2].content.items[1].service.slug = "branding";
  assert.equal(resolvePublishedServiceRows(duplicateDocument, serviceRows(), now).kind, "invalid");
});

test("Home route uses PageDocument body authority and no legacy fallback", async () => {
  const source = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /getPublishedPageDocument\("home"\)/);
  assert.match(source, /resolvePublishedPageServices/);
  assert.match(source, /createHomePageRenderData/);
  assert.match(source, /result\.document/);
  assert.match(source, /<HomePageSections sections=\{body\}/);
  assert.doesNotMatch(source, /getPublishedPageSections|from ["']@\/lib\/page-sections/);
  assert.doesNotMatch(source, /Digital infrastructure for brands ready to move with precision\.|A sharper digital presence starts with a better system\./);
});

test("Home renderer consumes PageDocument content and canonical Service data", async () => {
  const source = await readFile(new URL("../src/components/home-page-sections.tsx", import.meta.url), "utf8");
  assert.match(source, /HomePageBodySection/);
  assert.match(source, /section\.content\.items\.map/);
  assert.match(source, /section\.services\[index\]/);
  assert.match(source, /HomeCta/);
  assert.doesNotMatch(source, /OrderedPageSections|getPublishedPageSections|page-sections/);
  assert.doesNotMatch(source, /Brand strategy|Digital experiences|Content systems|Business workflows|Web applications/);
});

test("Home is isolated while About, Services, and Contact remain PageDocument and Work remains legacy", async () => {
  const [about, services, contact, work, authority] = await Promise.all([
    readFile(new URL("../src/app/about/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/services/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/contact/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/work/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./verify-phase5b-public-authority.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(about, /getPublishedPageDocument\("about"\)/);
  assert.match(services, /getPublishedPageDocument\("services"\)/);
  assert.match(contact, /getPublishedPageDocument\("contact"\)/);
  assert.match(work, /getPublishedPageSections\("work"\)/);
  assert.doesNotMatch(work, /getPublishedPageDocument|PageDocument/);
  assert.match(authority, /home: "PageDocument"/);
});
