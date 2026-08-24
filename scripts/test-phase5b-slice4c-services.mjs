import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": new URL("../src/", import.meta.url).pathname },
});
const { createServicesPageRenderData } = await jiti.import("../src/lib/services-page.ts");
const {
  resolvePublishedPageDocumentRow,
  resolvePublishedServiceList,
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

function servicesDocument() {
  return {
    schemaVersion: 1,
    pageKey: "services",
    seo: {
      title: "Services",
      description: "Strategy, design, and technology working as one system.",
      ogImageRef: { kind: "generated", key: "default" },
    },
    sections: [
      {
        key: "services_hero", enabled: true, order: 0,
        content: {
          eyebrow: "Capabilities",
          title: "One connected system for the work that matters.",
          intro: "OCSCO brings strategy, design, and technology together so the parts of your digital presence reinforce one another.",
        },
      },
      {
        key: "services_capabilities", enabled: true, order: 10,
        content: {},
      },
    ],
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

function publishedRow(content, overrides = {}) {
  return {
    slug: "services",
    status: "published",
    published_at: "2026-08-23T00:00:00.000Z",
    content,
    ...overrides,
  };
}

test("valid Services PageDocument produces the approved ordered render data", () => {
  const document = servicesDocument();
  assert.equal(validatePageDocument(document, "services").success, true);
  const result = resolvePublishedPageDocumentRow("services", publishedRow(document), now);
  assert.equal(result.kind, "document");
  if (result.kind !== "document") return;

  const view = createServicesPageRenderData(result.document);
  assert.deepEqual(view.plan.sections.map((section) => section.key), ["services_hero", "services_capabilities"]);
  assert.equal(view.hero.title, document.sections[0].content.title);
  assert.equal(view.capabilities.eyebrow, undefined);
  assert.equal(view.capabilities.heading, undefined);
  assert.equal(view.capabilities.note, undefined);
});

test("missing, unpublished, future, and malformed Services PageDocuments fail closed", () => {
  const document = servicesDocument();
  assert.equal(resolvePublishedPageDocumentRow("services", null, now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("services", publishedRow(document, { status: "review" }), now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("services", publishedRow(document, { published_at: "2026-08-25T00:00:00.000Z" }), now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("services", publishedRow({ schemaVersion: 2 }), now).kind, "invalid");
});

test("Services render data rejects wrong-page and incomplete render plans", () => {
  const document = servicesDocument();
  assert.throws(() => createServicesPageRenderData({ ...document, pageKey: "about" }), /Services PageDocument/);
  assert.throws(() => createServicesPageRenderData({ ...document, sections: document.sections.filter((section) => section.key !== "services_capabilities") }), /capabilities/);
});

test("complete published Service rows resolve in canonical order without PageDocument duplication", () => {
  const result = resolvePublishedServiceList(serviceRows(), now);
  assert.equal(result.kind, "resolved");
  if (result.kind !== "resolved") return;
  assert.deepEqual(result.services.map((service) => service.slug), serviceSlugs);
  assert.equal(result.services[0].summary, "branding summary");
});

test("Services preserve canonical public.services query order", () => {
  const rows = serviceRows().reverse();
  const result = resolvePublishedServiceList(rows, now);
  assert.equal(result.kind, "resolved");
  if (result.kind !== "resolved") return;
  assert.deepEqual(result.services.map((service) => service.slug), [...serviceSlugs].reverse());
});

test("missing, unpublished, future, duplicate, and unexpected Service rows fail without a partial list", () => {
  const rows = serviceRows();
  assert.equal(resolvePublishedServiceList(rows.slice(1), now).kind, "invalid");
  assert.equal(resolvePublishedServiceList(rows.map((row, index) => index === 0 ? { ...row, status: "draft" } : row), now).kind, "invalid");
  assert.equal(resolvePublishedServiceList(rows.map((row, index) => index === 0 ? { ...row, published_at: "2026-08-25T00:00:00.000Z" } : row), now).kind, "invalid");
  assert.equal(resolvePublishedServiceList([...rows, rows[0]], now).kind, "invalid");
  assert.equal(resolvePublishedServiceList([...rows, { ...rows[0], slug: "unapproved-service" }], now).kind, "invalid");
});

test("Services route uses PageDocument and canonical published Service authority only", async () => {
  const source = await readFile(new URL("../src/app/services/page.tsx", import.meta.url), "utf8");
  assert.match(source, /getPublishedPageDocument\("services"\)/);
  assert.match(source, /getPublishedPageServices/);
  assert.match(source, /createServicesPageRenderData/);
  assert.match(source, /result\.document/);
  assert.match(source, /servicesResult\.services/);
  assert.doesNotMatch(source, /getPublishedPageSections|getPublishedServices|page-sections/);
  assert.doesNotMatch(source, /One connected system for the work that matters\.|OCSCO brings strategy/);
});

test("Services detail route remains isolated from the Services overview cutover", async () => {
  const source = await readFile(new URL("../src/app/services/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /getPublishedService/);
  assert.doesNotMatch(source, /getPublishedPageDocument|createServicesPageRenderData/);
});
