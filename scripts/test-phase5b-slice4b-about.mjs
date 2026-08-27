import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": new URL("../src/", import.meta.url).pathname },
});
const { createAboutPageRenderData } = await jiti.import("../src/lib/about-page.ts");
const { resolvePublishedPageDocumentRow } = await jiti.import("../src/lib/page-document-loader.ts");
const { validatePageDocument } = await jiti.import("../src/lib/page-document.ts");

const now = new Date("2026-08-24T00:00:00.000Z");

function aboutDocument() {
  return {
    schemaVersion: 1,
    pageKey: "about",
    seo: {
      title: "About",
      description: "The thinking and working principles behind OCSCO.",
      ogImageRef: { kind: "generated", key: "default" },
    },
    sections: [
      {
        key: "about_hero", enabled: true, order: 0,
        content: {
          eyebrow: "The thinking",
          title: "Clarity is not a presentation layer. It is how the work gets built.",
          intro: "OCSCO brings strategy, design, and technology into one connected practice for organizations that need their digital presence to work harder.",
        },
      },
      {
        key: "about_principles", enabled: true, order: 10,
        content: {
          eyebrow: "Working principles",
          heading: "Precision over volume. Substance before style. Partnership, not vendorship.",
          items: [
            { title: "Clarity as a discipline.", body: "Remove ambiguity from strategy, design, and communication." },
            { title: "Intelligent innovation.", body: "Use technology when it creates a genuine advantage." },
            { title: "Quiet confidence.", body: "Let the quality of the thinking and the work carry the weight." },
          ],
        },
      },
      {
        key: "about_people", enabled: true, order: 20,
        content: {
          eyebrow: "The people",
          heading: "Team and origin details will be added after owner review.",
          cta: { kind: "route", label: "Start a conversation", href: "/contact" },
        },
      },
    ],
  };
}

function publishedRow(content, overrides = {}) {
  return {
    slug: "about",
    status: "published",
    published_at: "2026-08-23T00:00:00.000Z",
    content,
    ...overrides,
  };
}

test("valid published About content produces the approved ordered render data", () => {
  const document = aboutDocument();
  assert.equal(validatePageDocument(document, "about").success, true);
  const result = resolvePublishedPageDocumentRow("about", publishedRow(document), now);
  assert.equal(result.kind, "document");
  if (result.kind !== "document") return;

  const view = createAboutPageRenderData(result.document);
  assert.deepEqual(view.plan.sections.map((section) => section.key), [
    "about_hero", "about_principles", "about_people",
  ]);
  assert.deepEqual(view.body.map((section) => section.key), ["about_principles", "about_people"]);
  assert.equal(view.hero.title, document.sections[0].content.title);
  assert.deepEqual(view.body[0].content.items.map((item) => item.title), [
    "Clarity as a discipline.", "Intelligent innovation.", "Quiet confidence.",
  ]);
});

test("disabled optional people section is omitted while required sections remain", () => {
  const document = aboutDocument();
  document.sections[2].enabled = false;
  const result = resolvePublishedPageDocumentRow("about", publishedRow(document), now);
  assert.equal(result.kind, "document");
  if (result.kind !== "document") return;

  const view = createAboutPageRenderData(result.document);
  assert.deepEqual(view.body.map((section) => section.key), ["about_principles"]);
});

test("missing, unpublished, and malformed About content fail closed before rendering", () => {
  assert.equal(resolvePublishedPageDocumentRow("about", null, now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("about", publishedRow(aboutDocument(), { status: "review" }), now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("about", publishedRow({ schemaVersion: 2 }), now).kind, "invalid");
});

test("About renderer rejects non-About documents and invalid section plans", () => {
  const document = aboutDocument();
  assert.throws(() => createAboutPageRenderData({ ...document, pageKey: "home" }), /About PageDocument/);
  assert.throws(() => createAboutPageRenderData({ ...document, sections: document.sections.filter((section) => section.key !== "about_hero") }), /valid|hero/i);
});

test("About route uses PageDocument body authority without page_sections or hardcoded body copy", async () => {
  const source = await readFile(new URL("../src/app/about/page.tsx", import.meta.url), "utf8");
  assert.match(source, /getPublishedPageDocument\("about"\)/);
  assert.match(source, /createAboutPageRenderData/);
  assert.match(source, /getPublishedPageMetadata\("about"\)/); // metadata now follows the approved PageDocument authority.
  assert.doesNotMatch(source, /getPublishedPageSections|page-sections/);
  assert.doesNotMatch(source, /Clarity as a discipline\.|Intelligent innovation\.|Quiet confidence\./);
  assert.doesNotMatch(source, /Team and origin details will be added after owner review\./);
});

test("About CTA remains constrained by the shared validator", () => {
  const document = aboutDocument();
  document.sections[2].content.cta.href = "https://example.com";
  const result = validatePageDocument(document, "about");
  assert.equal(result.success, false);
});
