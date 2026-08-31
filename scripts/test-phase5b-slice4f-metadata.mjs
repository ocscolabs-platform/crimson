import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": new URL("../src/", import.meta.url).pathname },
});
const { buildPageDocumentMetadata } = await jiti.import("../src/lib/page-metadata.ts");
const { resolvePublishedPageDocumentRow } = await jiti.import("../src/lib/page-document-loader.ts");
const { validatePageDocument } = await jiti.import("../src/lib/page-document.ts");

const now = new Date("2026-08-24T00:00:00.000Z");

function aboutDocument(overrides = {}) {
  return {
    schemaVersion: 1,
    pageKey: "about",
    seo: {
      title: "About OCSCO",
      description: "The thinking and working principles behind OCSCO.",
      ogTitle: "About OCSCO",
      ogDescription: "How OCSCO brings strategy, design, and technology together.",
      ogImageRef: { kind: "generated", key: "default" },
    },
    sections: [
      {
        key: "about_hero", enabled: true, order: 0,
        content: {
          eyebrow: "The thinking",
          title: "Clarity is how the work gets built.",
          intro: "OCSCO brings strategy, design, and technology into one connected practice.",
        },
      },
      {
        key: "about_principles", enabled: true, order: 10,
        content: {
          eyebrow: "Working principles",
          heading: "Precision over volume.",
          items: [
            { title: "Clarity.", body: "Remove ambiguity." },
            { title: "Innovation.", body: "Use technology with purpose." },
            { title: "Confidence.", body: "Let the work carry the weight." },
          ],
        },
      },
      {
        key: "about_people", enabled: true, order: 20,
        content: {
          eyebrow: "The people",
          heading: "Team details will be added after review.",
          cta: { kind: "route", label: "Start a conversation", href: "/contact" },
        },
      },
    ],
    ...overrides,
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

test("PageDocument SEO supplies title, description, Open Graph, Twitter, and code-controlled canonical metadata", () => {
  const document = aboutDocument();
  const metadata = buildPageDocumentMetadata(document, "about");

  assert.equal(metadata.title, "About OCSCO");
  assert.equal(metadata.description, "The thinking and working principles behind OCSCO.");
  assert.deepEqual(metadata.alternates, { canonical: "/about" });
  assert.deepEqual(metadata.openGraph, {
    title: "About OCSCO",
    description: "How OCSCO brings strategy, design, and technology together.",
    type: "website",
    url: "/about",
    images: [{ url: "/og/ocsco-about.png", width: 1200, height: 630, alt: "About OCSCO" }],
  });
  assert.deepEqual(metadata.twitter, {
    card: "summary_large_image",
    title: "About OCSCO",
    description: "How OCSCO brings strategy, design, and technology together.",
    images: ["/og/ocsco-about.png"],
  });
});

test("omitted approved OG reference falls back to the generated default route", () => {
  const document = aboutDocument({ seo: { title: "About", description: "Description" } });
  const metadata = buildPageDocumentMetadata(document, "about");
  assert.deepEqual(metadata.openGraph.images, [{ url: "/og/ocsco-about.png", width: 1200, height: 630, alt: "About" }]);
  assert.deepEqual(metadata.twitter, {
    card: "summary_large_image",
    title: "About",
    description: "Description",
    images: ["/og/ocsco-about.png"],
  });
});

test("metadata builder rejects a mismatched page key and invalid OG reference", () => {
  assert.throws(() => buildPageDocumentMetadata(aboutDocument(), "contact"), /key mismatch/);
  assert.throws(
    () => buildPageDocumentMetadata(aboutDocument({ seo: { title: "About", description: "Description", ogImageRef: { kind: "uploaded", key: "hero" } } }), "about"),
    /approved generated default/,
  );
});

test("published metadata uses the same effective publication boundary as body content", () => {
  const document = aboutDocument();
  assert.equal(resolvePublishedPageDocumentRow("about", publishedRow(document), now).kind, "document");
  assert.equal(resolvePublishedPageDocumentRow("about", publishedRow(document, { status: "draft" }), now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("about", publishedRow(document, { published_at: "2026-08-25T00:00:00.000Z" }), now).kind, "unavailable");
  assert.equal(resolvePublishedPageDocumentRow("about", publishedRow({ ...document, seo: { title: "", description: "Description" } }), now).kind, "invalid");
});

test("PageDocument validator rejects arbitrary canonical and OG URL fields", () => {
  const document = aboutDocument({ seo: { title: "About", description: "Description", canonical: "https://ocsco.io/about", ogImagePath: "https://example.com/image.png" } });
  const result = validatePageDocument(document, "about");
  assert.equal(result.success, false);
});

test("route metadata authority is PageDocument-driven while Work remains legacy", async () => {
  const routes = {
    home: "src/app/page.tsx",
    services: "src/app/services/page.tsx",
    about: "src/app/about/page.tsx",
    contact: "src/app/contact/page.tsx",
    work: "src/app/work/page.tsx",
  };

  for (const [pageKey, file] of Object.entries(routes)) {
    const source = await readFile(file, "utf8");
    if (pageKey === "work") {
      assert.match(source, /getPublishedPage\(\s*["']work["']\s*\)/);
      assert.doesNotMatch(source, /getPublishedPageMetadata/);
    } else {
      assert.match(source, new RegExp(`getPublishedPageMetadata\\(\\s*["']${pageKey}["']\\s*\\)`));
      assert.doesNotMatch(source, /getPublishedPage\s*\(/);
    }
    assert.match(source, /force-dynamic/);
  }
});

test("origin, generated image path, and route paths remain code-controlled", async () => {
  const helper = await readFile("src/lib/page-metadata.ts", "utf8");
  const origin = await readFile("src/lib/site-origin.ts", "utf8");
  const layout = await readFile("src/app/layout.tsx", "utf8");
  const ogAssets = await readFile("src/lib/og-assets.ts", "utf8");
  assert.match(origin, /NEXT_PUBLIC_SITE_URL/);
  assert.match(layout, /twitter:\s*\{/);
  assert.match(helper, /PAGE_OG_IMAGE_PATHS/);
  assert.match(ogAssets, /\/og\/ocsco-about\.png/);
  assert.doesNotMatch(helper, /NEXT_PUBLIC_SITE_URL|ocsco\\.io|VERCEL_URL/);
  assert.doesNotMatch(helper, /\/opengraph-image/);
  assert.doesNotMatch(helper, /canonical:\s*document\.seo|ogImagePath\s*=\s*document\.seo/);
});

test("published PageDocument reads are request-memoized without persistent revalidation", async () => {
  const loader = await readFile("src/lib/page-document-loader.ts", "utf8");
  const routes = await Promise.all([
    readFile("src/app/page.tsx", "utf8"),
    readFile("src/app/services/page.tsx", "utf8"),
    readFile("src/app/about/page.tsx", "utf8"),
    readFile("src/app/contact/page.tsx", "utf8"),
  ]);
  assert.match(loader, /import \{ cache \} from "react"/);
  assert.match(loader, /cache\(async function getPublishedPageDocument/);
  for (const source of routes) {
    assert.match(source, /force-dynamic/);
    assert.doesNotMatch(source, /unstable_cache|revalidateTag|export const revalidate/);
  }
});
