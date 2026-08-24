import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": new URL("../src/", import.meta.url).pathname },
});
const { createContactPageRenderData } = await jiti.import("../src/lib/contact-page.ts");
const { resolvePublishedPageDocumentRow } = await jiti.import("../src/lib/page-document-loader.ts");
const { validatePageDocument } = await jiti.import("../src/lib/page-document.ts");

const now = new Date("2026-08-24T00:00:00.000Z");

function contactDocument() {
  return {
    schemaVersion: 1,
    pageKey: "contact",
    seo: {
      title: "Contact",
      description: "Start a conversation with OCSCO.",
      ogImageRef: { kind: "generated", key: "default" },
    },
    sections: [
      {
        key: "contact_hero", enabled: true, order: 0,
        content: {
          eyebrow: "The next step",
          title: "Bring us the thing that needs to work better.",
          intro: "Start with a conversation. We will bring clarity to the opportunity, the path, and what it will take to build well.",
        },
      },
      {
        key: "contact_process", enabled: true, order: 10,
        content: {
          eyebrow: "What happens next",
          heading: "A clear conversation before a proposal.",
          items: [
            { title: "Share the context.", body: "Tell us what is changing, where the friction is, and what better looks like." },
            { title: "Find the shape.", body: "We clarify the opportunity, scope, and right next step." },
            { title: "Build the plan.", body: "If there is a fit, we define the work and how it should move forward." },
          ],
          cta: { kind: "anchor", label: "Start the conversation", href: "#contact-form" },
        },
      },
      {
        key: "contact_form", enabled: true, order: 20,
        content: {
          eyebrow: "Start the conversation",
          heading: "Tell us what needs to work better.",
          intro: "Share the context, the friction, and the opportunity. We will take it from there.",
        },
      },
    ],
  };
}

function publishedRow(content, overrides = {}) {
  return {
    slug: "contact",
    status: "published",
    published_at: "2026-08-23T00:00:00.000Z",
    content,
    ...overrides,
  };
}

test("valid Published Contact PageDocument produces the approved render plan", () => {
  const document = contactDocument();
  assert.equal(validatePageDocument(document, "contact").success, true);
  const result = resolvePublishedPageDocumentRow("contact", publishedRow(document), now);
  assert.equal(result.kind, "document");
  if (result.kind !== "document") return;

  const view = createContactPageRenderData(result.document);
  assert.deepEqual(view.plan.sections.map((section) => section.key), ["contact_hero", "contact_process", "contact_form"]);
  assert.equal(view.hero.title, "Bring us the thing that needs to work better.");
  assert.equal(view.body[0].key, "contact_process");
  assert.equal(view.body[1].key, "contact_form");
});

test("Contact process content uses title/body only and keeps numbering code-controlled", () => {
  const process = contactDocument().sections[1].content;
  assert.deepEqual(Object.keys(process.items[0]).sort(), ["body", "title"]);
  assert.equal(process.items.length, 3);
  assert.equal(process.items[0].title, "Share the context.");
  assert.equal(process.cta.href, "#contact-form");
});

test("Contact validator rejects persisted process prefixes and malformed content", () => {
  const document = contactDocument();
  const withPrefix = structuredClone(document);
  withPrefix.sections[1].content.items[0].prefix = "01 /";
  const prefixResult = validatePageDocument(withPrefix, "contact");
  assert.equal(prefixResult.success, false);
  assert.ok(prefixResult.issues.some((issue) => issue.includes("unknown field")));

  assert.equal(validatePageDocument({ ...document, schemaVersion: 2 }, "contact").success, false);
  assert.equal(validatePageDocument({ ...document, sections: [] }, "contact").success, false);
});

test("missing, unpublished, future, and malformed Contact documents fail closed", () => {
  const document = contactDocument();
  assert.equal(resolvePublishedPageDocumentRow("contact", null, now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("contact", publishedRow(document, { status: "review" }), now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("contact", publishedRow(document, { published_at: "2026-08-25T00:00:00.000Z" }), now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("contact", publishedRow({ schemaVersion: 2 }), now).kind, "invalid");
});

test("Contact route uses PageDocument body authority without legacy fallback", async () => {
  const source = await readFile(new URL("../src/app/contact/page.tsx", import.meta.url), "utf8");
  assert.match(source, /getPublishedPageDocument\("contact"\)/);
  assert.match(source, /createContactPageRenderData/);
  assert.match(source, /result\.document/);
  assert.match(source, /notFound\(\)/);
  assert.match(source, /section\.content\.eyebrow/);
  assert.match(source, /section\.content\.heading/);
  assert.match(source, /section\.content\.items\.map/);
  assert.match(source, /String\(index \+ 1\)\.padStart/);
  assert.match(source, /section\.content\.cta\.href/);
  assert.match(source, /section\.content\.intro/);
  assert.doesNotMatch(source, /getPublishedPageSections|OrderedPageSections|page-sections/);
  assert.doesNotMatch(source, /Bring us the thing that needs to work better\.|What happens next|Tell us what needs to work better/);
  assert.doesNotMatch(source, /prefix/);
});

test("ContactForm functional boundary remains code-controlled", async () => {
  const routeSource = await readFile(new URL("../src/app/contact/page.tsx", import.meta.url), "utf8");
  const formSource = await readFile(new URL("../src/components/contact-form.tsx", import.meta.url), "utf8");
  assert.match(routeSource, /<ContactForm \/>/);
  assert.match(formSource, /fetch\("\/api\/inquiries"/);
  assert.match(formSource, /reportValidity\(\)/);
  assert.match(formSource, /contact-honeypot/);
  assert.match(formSource, /minLength=\{20\}/);
  assert.match(formSource, /services\.map/);
  assert.match(formSource, /status === "success"|status === "error"/);
  assert.doesNotMatch(formSource, /getPublishedPageDocument|PageDocument|page_sections/);
});

test("About, Services, Home, and Work remain isolated from Contact cutover", async () => {
  const [about, services, home, work] = await Promise.all([
    readFile(new URL("../src/app/about/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/services/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/work/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(about, /getPublishedPageDocument\("about"\)/);
  assert.match(services, /getPublishedPageDocument\("services"\)/);
  assert.match(home, /getPublishedPageSections\("home"\)/);
  assert.match(work, /getPublishedPageSections\("work"\)/);
  assert.doesNotMatch(home, /getPublishedPageDocument|createHomePageRenderData/);
  assert.doesNotMatch(work, /getPublishedPageDocument|PageDocument/);
});
