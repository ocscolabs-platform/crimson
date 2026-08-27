import assert from "node:assert/strict";
import { test } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": new URL("../src/", import.meta.url).pathname },
});
const { readPageContent, validatePageDocument } = await jiti.import("../src/lib/page-document.ts");

const services = [
  "branding",
  "website-design-development",
  "custom-cms",
  "crm-business-tools",
  "custom-web-applications",
];

const seo = (title, description) => ({
  title,
  description,
  ogImageRef: { kind: "generated", key: "default" },
});

const section = (key, order, content, enabled = true) => ({ key, order, enabled, content });

function homeDocument() {
  return {
    schemaVersion: 1,
    pageKey: "home",
    seo: seo("OCSCO — Strategy, design, and technology", "Strategy, design, and technology for brands ready to move with precision."),
    sections: [
      section("home_hero", 0, {
        eyebrow: "Strategy / Design / Technology",
        title: "Digital infrastructure for brands ready to move with precision.",
        intro: "OCSCO integrates strategy, design, and technology to build digital systems that make ambitious businesses clearer, stronger, and ready for what comes next.",
        ctas: [
          { kind: "anchor", label: "Start a conversation", href: "#contact" },
          { kind: "route", label: "Explore the capabilities", href: "/services" },
        ],
      }),
      section("home_intro", 10, {
        eyebrow: "The work",
        heading: "A sharper digital presence starts with a better system.",
        body: "Your brand, website, and internal tools should reinforce one another. We bring the thinking and execution together so every part of the experience moves in the same direction.",
      }),
      section("home_capabilities", 20, {
        eyebrow: "Capabilities",
        heading: "Built as a system. Delivered with intent.",
        note: "Five connected capabilities. One clear standard: the work has to perform.",
        items: services.map((slug, index) => ({
          service: { kind: "service", slug },
          ctaLabel: ["Discuss branding", "Discuss a website", "Discuss a content system", "Discuss a business tool", "Discuss an application"][index],
        })),
      }),
      section("home_approach", 30, {
        eyebrow: "How we work",
        heading: "Clarity first. Craft all the way through.",
        items: [
          { title: "Understand the real problem", body: "We start with the business context, not a predetermined deliverable." },
          { title: "Architect the right system", body: "Strategy, design, and technology align around the outcome that matters." },
          { title: "Build with precision", body: "Senior-level thinking stays close to the work from first decision to final detail." },
        ],
      }),
      section("home_proof", 40, {
        eyebrow: "Proof of work",
        heading: "The work deserves the space to speak for itself.",
        body: "Selected case studies will be added here as projects, outcomes, and publication permissions are approved.",
      }),
      section("home_contact", 50, {
        eyebrow: "The next step",
        heading: "Bring us the thing that needs to work better.",
        body: "Start with a conversation. We will bring clarity to the opportunity, the path, and what it will take to build well.",
        cta: { kind: "route", label: "Start a conversation", href: "/contact" },
      }),
    ],
  };
}

function servicesDocument() {
  return {
    schemaVersion: 1,
    pageKey: "services",
    seo: seo("Services", "Explore OCSCO's proposed capabilities across strategy, design, and technology."),
    sections: [
      section("services_hero", 0, {
        eyebrow: "Capabilities",
        title: "One connected system for the work that matters.",
        intro: "OCSCO brings strategy, design, and technology together so the parts of your digital presence reinforce one another.",
      }),
      // Canonical Service records remain authoritative; this section stores no duplicate Service copy.
      section("services_capabilities", 10, {}),
    ],
  };
}

function aboutDocument() {
  return {
    schemaVersion: 1,
    pageKey: "about",
    seo: seo("About", "The thinking and working principles behind OCSCO."),
    sections: [
      section("about_hero", 0, {
        eyebrow: "The thinking",
        title: "Clarity is not a presentation layer. It is how the work gets built.",
        intro: "OCSCO brings strategy, design, and technology into one connected practice for organizations that need their digital presence to work harder.",
      }),
      section("about_principles", 10, {
        eyebrow: "Working principles",
        heading: "Precision over volume. Substance before style. Partnership, not vendorship.",
        items: [
          { title: "Clarity as a discipline.", body: "Remove ambiguity from strategy, design, and communication." },
          { title: "Intelligent innovation.", body: "Use technology when it creates a genuine advantage." },
          { title: "Quiet confidence.", body: "Let the quality of the thinking and the work carry the weight." },
        ],
      }),
      section("about_people", 20, {
        eyebrow: "The people",
        heading: "Team and origin details will be added after owner review.",
        cta: { kind: "route", label: "Start a conversation", href: "/contact" },
      }),
    ],
  };
}

function contactDocument() {
  return {
    schemaVersion: 1,
    pageKey: "contact",
    seo: seo("Contact", "Start a conversation with OCSCO."),
    sections: [
      section("contact_hero", 0, {
        eyebrow: "The next step",
        title: "Bring us the thing that needs to work better.",
        intro: "Start with a conversation. We will bring clarity to the opportunity, the path, and what it will take to build well.",
      }),
      section("contact_process", 10, {
        eyebrow: "What happens next",
        heading: "A clear conversation before a proposal.",
        items: [
          { title: "Share the context.", body: "Tell us what is changing, where the friction is, and what better looks like." },
          { title: "Find the shape.", body: "We clarify the opportunity, scope, and right next step." },
          { title: "Build the plan.", body: "If there is a fit, we define the work and how it should move forward." },
        ],
        cta: { kind: "anchor", label: "Start the conversation", href: "#contact-form" },
      }),
      section("contact_form", 20, {
        eyebrow: "Start the conversation",
        heading: "Tell us what needs to work better.",
        intro: "Share the context, the friction, and the opportunity. We will take it from there.",
      }),
    ],
  };
}

const documents = [homeDocument(), servicesDocument(), aboutDocument(), contactDocument()];

test("the exact four Slice 3 documents pass the shared validator", () => {
  for (const document of documents) {
    const result = validatePageDocument(document, document.pageKey);
    assert.equal(result.success, true, result.success ? undefined : result.issues.join("; "));
  }
});

test("Slice 3 preserves the approved structural boundaries", () => {
  const aboutPeople = aboutDocument().sections.find((item) => item.key === "about_people");
  assert.ok(aboutPeople);
  assert.deepEqual(Object.keys(aboutPeople.content).sort(), ["cta", "eyebrow", "heading"]);

  const process = contactDocument().sections.find((item) => item.key === "contact_process");
  assert.ok(process);
  assert.equal(process.content.items.length, 3);
  assert.deepEqual(Object.keys(process.content.items[0]).sort(), ["body", "title"]);

  const capabilities = servicesDocument().sections.find((item) => item.key === "services_capabilities");
  assert.ok(capabilities);
  assert.deepEqual(capabilities.content, {});

  const homeCapabilities = homeDocument().sections.find((item) => item.key === "home_capabilities");
  assert.ok(homeCapabilities);
  assert.deepEqual(homeCapabilities.content.items.map((item) => item.service.slug), services);
});

test("Work remains legacy and is not accepted as a PageDocument target", () => {
  const legacyWork = [{ eyebrow: "Work", title: "Legacy work", intro: "Legacy intro" }];
  assert.deepEqual(readPageContent(legacyWork, "home"), { kind: "legacy", content: legacyWork });
});
