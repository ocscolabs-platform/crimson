import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": new URL("../src/", import.meta.url).pathname },
});
const {
  PAGE_DOCUMENT_SECTION_RENDERERS,
  createPageDocumentRenderPlan,
} = await jiti.import("../src/lib/page-document-renderer.ts");
const {
  getPublishedPageDocument,
  resolvePublishedPageDocumentRow,
  resolvePublishedServiceRows,
} = await jiti.import("../src/lib/page-document-loader.ts");
const { validatePageDocument } = await jiti.import("../src/lib/page-document.ts");

const serviceSlugs = [
  "branding",
  "website-design-development",
  "custom-cms",
  "crm-business-tools",
  "custom-web-applications",
];

const now = new Date("2026-08-24T00:00:00.000Z");

function baseDocument(pageKey, sections) {
  return {
    schemaVersion: 1,
    pageKey,
    seo: {
      title: `${pageKey} title`,
      description: `${pageKey} description`,
      ogImageRef: { kind: "generated", key: "default" },
    },
    sections,
  };
}

function homeDocument() {
  return baseDocument("home", [
    {
      key: "home_hero", enabled: true, order: 0,
      content: {
        eyebrow: "Eyebrow", title: "Title", intro: "Intro",
        ctas: [{ kind: "route", label: "Services", href: "/services" }],
      },
    },
    {
      key: "home_intro", enabled: true, order: 10,
      content: { eyebrow: "The work", heading: "Heading", body: "Body" },
    },
    {
      key: "home_capabilities", enabled: true, order: 20,
      content: {
        eyebrow: "Capabilities", heading: "Heading", note: "Note",
        items: serviceSlugs.map((slug) => ({ service: { kind: "service", slug }, ctaLabel: "Discuss" })),
      },
    },
    {
      key: "home_approach", enabled: true, order: 30,
      content: {
        eyebrow: "Approach", heading: "Heading",
        items: [{ title: "One", body: "Body" }, { title: "Two", body: "Body" }, { title: "Three", body: "Body" }],
      },
    },
    {
      key: "home_proof", enabled: false, order: 40,
      content: { eyebrow: "Proof", heading: "Heading", body: "Body" },
    },
    {
      key: "home_contact", enabled: true, order: 50,
      content: { eyebrow: "Contact", heading: "Heading", body: "Body", cta: { kind: "route", label: "Contact", href: "/contact" } },
    },
  ]);
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

function publishedServiceRows(overrides = {}) {
  return serviceSlugs.map((slug) => ({
    name: slug,
    card_name: slug,
    slug,
    short_description: `${slug} summary`,
    audience: "Audience",
    outcome: "Outcome",
    status: "published",
    published_at: "2026-08-23T00:00:00.000Z",
    ...overrides,
  }));
}

test("valid published PageDocument loads and produces an ordered enabled render plan", () => {
  const document = homeDocument();
  assert.equal(validatePageDocument(document, "home").success, true);
  const result = resolvePublishedPageDocumentRow("home", publishedRow(document), now);
  assert.equal(result.kind, "document");
  if (result.kind !== "document") return;

  const plan = createPageDocumentRenderPlan(result.document);
  assert.deepEqual(plan.sections.map((section) => section.key), [
    "home_hero", "home_intro", "home_capabilities", "home_approach", "home_contact",
  ]);
  assert.deepEqual(plan.sections.map((section) => section.rendererId), [
    "home.hero", "home.intro", "home.capabilities", "home.approach", "home.contact",
  ]);
});

test("the static registry contains exactly the approved public section keys", () => {
  assert.deepEqual(Object.keys(PAGE_DOCUMENT_SECTION_RENDERERS).sort(), [
    "about_hero",
    "about_people",
    "about_principles",
    "contact_form",
    "contact_hero",
    "contact_process",
    "home_approach",
    "home_capabilities",
    "home_contact",
    "home_hero",
    "home_intro",
    "home_proof",
    "services_capabilities",
    "services_hero",
  ]);

  const unknownSectionDocument = structuredClone(homeDocument());
  unknownSectionDocument.sections[0].key = "unknown_section";
  assert.throws(() => createPageDocumentRenderPlan(unknownSectionDocument), /No approved/);
});

test("the PageDocument loader excludes Work and distinguishes unavailable from invalid content", () => {
  assert.throws(() => createPageDocumentRenderPlan({ pageKey: "work", sections: [], schemaVersion: 1, seo: {} }), /work/i);

  const missing = resolvePublishedPageDocumentRow("home", null, now);
  assert.equal(missing.kind, "unavailable");

  const unpublished = resolvePublishedPageDocumentRow("home", publishedRow(homeDocument(), { status: "review" }), now);
  assert.equal(unpublished.kind, "unavailable");

  const future = resolvePublishedPageDocumentRow("home", publishedRow(homeDocument(), { published_at: "2026-08-25T00:00:00.000Z" }), now);
  assert.equal(future.kind, "unavailable");

  const malformed = resolvePublishedPageDocumentRow("home", publishedRow({ schemaVersion: 2 }), now);
  assert.equal(malformed.kind, "invalid");

  const legacyArray = resolvePublishedPageDocumentRow("home", publishedRow([]), now);
  assert.equal(legacyArray.kind, "invalid");
});

test("CMS configuration failure is unavailable and remains distinct from malformed content", async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  try {
    const result = await getPublishedPageDocument("home");
    assert.deepEqual(result, {
      kind: "unavailable",
      reason: "cms-not-configured",
      message: "The published CMS read boundary is not configured.",
    });
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  }
});

test("published PageDocument validation rejects wrong page, schema, unknown section, CTA, required section, and order", () => {
  const wrongPage = resolvePublishedPageDocumentRow("about", publishedRow(homeDocument(), { slug: "about" }), now);
  assert.equal(wrongPage.kind, "invalid");

  const invalid = structuredClone(homeDocument());
  invalid.schemaVersion = 2;
  invalid.sections[0].key = "unknown_section";
  invalid.sections[1].order = 0;
  invalid.sections[5].content.cta.href = "https://example.com";
  const result = validatePageDocument(invalid, "home");
  assert.equal(result.success, false);

  const missingRequired = structuredClone(homeDocument());
  missingRequired.sections = missingRequired.sections.filter((section) => section.key !== "home_intro");
  assert.equal(validatePageDocument(missingRequired, "home").success, false);
});

test("Service references preserve document order and reject duplicates, missing, and unpublished rows", () => {
  const document = homeDocument();
  const rows = publishedServiceRows();
  const resolved = resolvePublishedServiceRows(document, rows, now);
  assert.equal(resolved.kind, "resolved");
  if (resolved.kind === "resolved") assert.deepEqual(resolved.services.map((service) => service.slug), serviceSlugs);

  const duplicate = structuredClone(document);
  duplicate.sections[2].content.items[1].service.slug = "branding";
  const duplicateResult = resolvePublishedServiceRows(duplicate, rows, now);
  assert.equal(duplicateResult.kind, "invalid");

  const missingResult = resolvePublishedServiceRows(document, rows.slice(0, 4), now);
  assert.equal(missingResult.kind, "invalid");

  const unpublishedResult = resolvePublishedServiceRows(document, publishedServiceRows({ status: "review" }), now);
  assert.equal(unpublishedResult.kind, "invalid");

  const futureResult = resolvePublishedServiceRows(document, publishedServiceRows({ published_at: "2026-08-25T00:00:00.000Z" }), now);
  assert.equal(futureResult.kind, "invalid");
});

test("Contact and About contract rules remain enforced by the existing validator", () => {
  const contact = {
    ...baseDocument("contact", [
      { key: "contact_hero", enabled: true, order: 0, content: { eyebrow: "Contact", title: "Title", intro: "Intro" } },
      { key: "contact_process", enabled: true, order: 10, content: { eyebrow: "Process", heading: "Heading", items: [{ title: "One", body: "Body" }, { title: "Two", body: "Body" }, { title: "Three", body: "Body" }], cta: { kind: "anchor", label: "Start", href: "#contact-form" } } },
      { key: "contact_form", enabled: true, order: 20, content: { eyebrow: "Form", heading: "Heading", intro: "Intro" } },
    ]),
  };
  assert.equal(validatePageDocument(contact, "contact").success, true);
});
