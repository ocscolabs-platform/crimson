import assert from "node:assert/strict";
import { test } from "node:test";
import { readPageContent, validatePageDocument } from "../src/lib/page-document.ts";

const serviceSlugs = [
  "branding",
  "website-design-development",
  "custom-cms",
  "crm-business-tools",
  "custom-web-applications",
];

function hero(key, title = `${key} title`) {
  return {
    key,
    enabled: true,
    order: 0,
    content: { eyebrow: "Eyebrow", title, intro: "Intro copy" },
  };
}

function baseDocument(pageKey, sections) {
  return {
    schemaVersion: 1,
    pageKey,
    seo: {
      title: `${pageKey} SEO title`,
      description: `${pageKey} SEO description`,
      ogImageRef: { kind: "generated", key: "default" },
    },
    sections,
  };
}

function homeDocument() {
  const homeHero = hero("home_hero");
  homeHero.content.ctas = [
    { kind: "anchor", label: "Start", href: "#contact" },
    { kind: "route", label: "Services", href: "/services" },
  ];
  return baseDocument("home", [
    homeHero,
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
      content: { eyebrow: "How we work", heading: "Heading", items: [
        { title: "One", body: "Body" }, { title: "Two", body: "Body" }, { title: "Three", body: "Body" },
      ] },
    },
    {
      key: "home_proof", enabled: false, order: 40,
      content: { eyebrow: "Proof", heading: "Heading", body: "Body" },
    },
    {
      key: "home_contact", enabled: true, order: 50,
      content: { eyebrow: "Next", heading: "Heading", body: "Body", cta: { kind: "route", label: "Contact", href: "/contact" } },
    },
  ]);
}

function servicesDocument() {
  return baseDocument("services", [
    hero("services_hero"),
    { key: "services_capabilities", enabled: true, order: 10, content: { heading: "Capabilities" } },
  ]);
}

function aboutDocument() {
  return baseDocument("about", [
    hero("about_hero"),
    {
      key: "about_principles", enabled: true, order: 10,
      content: { eyebrow: "Principles", heading: "Heading", items: [
        { title: "One", body: "Body" }, { title: "Two", body: "Body" }, { title: "Three", body: "Body" },
      ] },
    },
    {
      key: "about_people", enabled: false, order: 20,
      content: { eyebrow: "People", heading: "Heading", body: "Body", cta: { kind: "route", label: "Contact", href: "/contact" } },
    },
  ]);
}

function contactDocument() {
  return baseDocument("contact", [
    hero("contact_hero"),
    {
      key: "contact_process", enabled: true, order: 10,
      content: { eyebrow: "Process", heading: "Heading", items: [
        { title: "One", body: "Body" }, { title: "Two", body: "Body" }, { title: "Three", body: "Body" },
      ], cta: { kind: "anchor", label: "Start", href: "#contact-form" } },
    },
    { key: "contact_form", enabled: true, order: 20, content: { eyebrow: "Form", heading: "Heading", intro: "Intro" } },
  ]);
}

test("accepts valid documents for all four Phase 5 pages", () => {
  for (const document of [homeDocument(), servicesDocument(), aboutDocument(), contactDocument()]) {
    const result = validatePageDocument(document);
    assert.equal(result.success, true);
  }
});

test("rejects invalid schema, page, section, order, CTA, service, and OG values", () => {
  const invalid = structuredClone(homeDocument());
  invalid.schemaVersion = 2;
  invalid.pageKey = "about";
  invalid.sections[0].key = "unknown_section";
  invalid.sections[1].order = 0;
  invalid.sections[2].content.items[0].service.slug = "unknown-service";
  invalid.sections[5].content.cta.href = "https://example.com";
  invalid.seo.ogImageRef = { kind: "uploaded", key: "custom" };
  const result = validatePageDocument(invalid);
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.issues.length >= 6);
});

test("rejects duplicate, missing, hidden-required, and wrong-page sections", () => {
  const invalid = structuredClone(aboutDocument());
  invalid.sections = [invalid.sections[0], invalid.sections[0], {
    key: "contact_form", enabled: true, order: 20,
    content: { eyebrow: "Form", heading: "Heading", intro: "Intro" },
  }];
  const result = validatePageDocument(invalid);
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.issues.some((issue) => issue.includes("duplicate section key")));
});

test("recognizes legacy arrays without merging them with PageDocuments", () => {
  const legacy = [{ eyebrow: "Legacy", title: "Legacy title", intro: "Legacy intro" }];
  const result = readPageContent(legacy, "home");
  assert.equal(result.kind, "legacy");
  if (result.kind === "legacy") assert.deepEqual(result.content, legacy);
});

test("recognizes valid PageDocuments and rejects malformed objects", () => {
  assert.equal(readPageContent(homeDocument(), "home").kind, "page-document");
  const malformed = structuredClone(homeDocument());
  malformed.sections[0].content = { eyebrow: "Missing title and intro" };
  assert.equal(readPageContent(malformed, "home").kind, "invalid");
});
