import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createJiti } from "jiti";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const jiti = createJiti(import.meta.url, {
  alias: { "@": new URL("../src/", import.meta.url).pathname },
});
const { validatePageDocument } = await jiti.import("../src/lib/page-document.ts");
const { canEditSectionVisibility, getSectionMoveState, movePageDocumentSection } = await jiti.import("../src/lib/page-document-editor.ts");

const seo = (pageKey) => ({
  title: `PHASE 5 ${pageKey} title`,
  description: `PHASE 5 ${pageKey} description`,
  ogTitle: `PHASE 5 ${pageKey} sharing title`,
  ogDescription: `PHASE 5 ${pageKey} sharing description`,
  ogImageRef: { kind: "generated", key: "default" },
});
const cta = (label, href = "/contact") => ({ kind: "route", label, href });
const items = () => [
  { title: "One", body: "One body" },
  { title: "Two", body: "Two body" },
  { title: "Three", body: "Three body" },
];
const section = (key, order, content, enabled = true) => ({ key, order, content, enabled });

function documentFor(pageKey) {
  if (pageKey === "home") {
    return {
      schemaVersion: 1, pageKey, seo: seo(pageKey), sections: [
        section("home_hero", 0, { eyebrow: "Eyebrow", title: "Title", intro: "Intro", ctas: [cta("Contact"), cta("Services", "/services")] }),
        section("home_intro", 10, { eyebrow: "Eyebrow", heading: "Heading", body: "Body" }),
        section("home_capabilities", 20, { eyebrow: "Eyebrow", heading: "Heading", note: "Note", items: ["branding", "website-design-development", "custom-cms", "crm-business-tools", "custom-web-applications"].map((slug) => ({ service: { kind: "service", slug }, ctaLabel: "Discuss" })) }),
        section("home_approach", 30, { eyebrow: "Eyebrow", heading: "Heading", items: items() }),
        section("home_proof", 40, { eyebrow: "Eyebrow", heading: "Heading", body: "Body" }),
        section("home_contact", 50, { eyebrow: "Eyebrow", heading: "Heading", body: "Body", cta: cta("Contact") }),
      ],
    };
  }
  if (pageKey === "services") {
    return {
      schemaVersion: 1, pageKey, seo: seo(pageKey), sections: [
        section("services_hero", 0, { eyebrow: "Eyebrow", title: "Title", intro: "Intro" }),
        section("services_capabilities", 10, { eyebrow: "Eyebrow", heading: "Heading", note: "Note" }),
      ],
    };
  }
  if (pageKey === "about") {
    return {
      schemaVersion: 1, pageKey, seo: seo(pageKey), sections: [
        section("about_hero", 0, { eyebrow: "Eyebrow", title: "Title", intro: "Intro" }),
        section("about_principles", 10, { eyebrow: "Eyebrow", heading: "Heading", items: items() }),
        section("about_people", 20, { eyebrow: "Eyebrow", heading: "Heading", cta: cta("People") }),
      ],
    };
  }
  return {
    schemaVersion: 1, pageKey, seo: seo(pageKey), sections: [
      section("contact_hero", 0, { eyebrow: "Eyebrow", title: "Title", intro: "Intro" }),
      section("contact_process", 10, { eyebrow: "Eyebrow", heading: "Heading", items: items(), cta: cta("Contact") }),
      section("contact_form", 20, { eyebrow: "Eyebrow", heading: "Heading", intro: "Intro" }),
    ],
  };
}

test("all four approved PageDocument editor payloads pass the canonical validator", () => {
  for (const pageKey of ["home", "services", "about", "contact"]) {
    assert.equal(validatePageDocument(documentFor(pageKey), pageKey).success, true, pageKey);
  }
  assert.equal(validatePageDocument(documentFor("home"), "about").success, false);
});

test("section visibility is limited to the approved optional sections", () => {
  assert.equal(canEditSectionVisibility("home", "home_proof"), true);
  assert.equal(canEditSectionVisibility("about", "about_people"), true);
  assert.equal(canEditSectionVisibility("home", "home_intro"), false);
  assert.equal(canEditSectionVisibility("contact", "contact_form"), false);
});

test("ordering moves only flexible sections and preserves fixed boundaries", () => {
  const home = documentFor("home");
  assert.deepEqual(getSectionMoveState(home, "home_hero"), { canMoveUp: false, canMoveDown: false });
  assert.deepEqual(getSectionMoveState(home, "home_contact"), { canMoveUp: false, canMoveDown: false });
  assert.deepEqual(getSectionMoveState(home, "home_intro"), { canMoveUp: false, canMoveDown: true });
  const moved = movePageDocumentSection(home, "home_intro", "down");
  assert.equal(moved.sections.find((section) => section.key === "home_intro").order, 20);
  assert.equal(moved.sections.find((section) => section.key === "home_capabilities").order, 10);
  assert.equal(movePageDocumentSection(home, "home_hero", "down"), home);
  assert.deepEqual(getSectionMoveState(documentFor("services"), "services_capabilities"), { canMoveUp: false, canMoveDown: false });
});

test("Batch 2 exposes the structured editor without publication or Work conversion", () => {
  const editor = read("src/app/admin/content/pages/_components/PageDocumentEditor.tsx");
  const action = read("src/app/admin/content/pages/actions.ts");
  const page = read("src/app/admin/content/pages/[pageKey]/page.tsx");
  const pageIndex = read("src/app/admin/content/pages/page.tsx");
  const globalContent = read("src/app/admin/content/page.tsx");

  for (const key of ["home_hero", "home_intro", "home_capabilities", "home_approach", "home_proof", "home_contact", "services_hero", "services_capabilities", "about_hero", "about_principles", "about_people", "contact_hero", "contact_process", "contact_form"]) {
    assert.match(editor, new RegExp(`\\"${key}\\"`));
  }
  assert.match(editor, /useActionState/);
  assert.match(editor, /beforeunload/);
  assert.match(editor, /Move up/);
  assert.match(editor, /Move down/);
  assert.match(editor, /Show this section/);
  assert.match(editor, /Save Draft/);
  assert.match(editor, /Draft changes are private and are not visible on the public site/);
  assert.match(editor, /published content remains unchanged/);
  assert.doesNotMatch(editor, /Draft only · no publication action is available in Batch 2/);
  assert.match(action, /cms_page_document_save_draft/);
  assert.match(action, /p_page_key: adapter\.pageKey/);
  assert.match(action, /Draft saved/);
  assert.doesNotMatch(action, /cms_publish_revision|cms_restore_revision/);
  assert.doesNotMatch(editor, /initialPageDocumentActionState.*from/);
  assert.match(page, /PageDocumentEditor/);
  assert.match(pageIndex, /Open structured editor/);
  assert.doesNotMatch(pageIndex, /read-only foundation|read-only in Batch 1/i);
  assert.match(globalContent, /Managed in Pages/);
  assert.match(globalContent, /content\/pages\/\$\{page\.slug\}/);
  assert.match(globalContent, /Legacy section compatibility/);
});

test("Work remains outside the Batch 2 structured editor boundary", () => {
  const adapter = read("src/lib/admin-page-documents.ts");
  const pageIndex = read("src/app/admin/content/pages/page.tsx");
  assert.doesNotMatch(adapter, /pageKey: "work"/);
  assert.match(pageIndex, /Work remains a legacy page/);
  assert.doesNotMatch(read("src/app/admin/content/pages/actions.ts"), /\bwork\b/i);
});
