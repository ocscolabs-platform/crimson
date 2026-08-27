import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyPublicAuthority } from "./verify-phase5b-public-authority.mjs";

const valid = {
  about: 'const metadata = await getPublishedPageMetadata("about"); const result = await getPublishedPageDocument("about"); createAboutPageRenderData(result.document);',
  services: 'const metadata = await getPublishedPageMetadata("services"); const result = await getPublishedPageDocument("services"); createServicesPageRenderData(result.document);',
  home: 'const metadata = await getPublishedPageMetadata("home"); const result = await getPublishedPageDocument("home"); createHomePageRenderData(result.document);',
  contact: 'const metadata = await getPublishedPageMetadata("contact"); const result = await getPublishedPageDocument("contact"); createContactPageRenderData(result.document);',
  work: 'const metadata = await getPublishedPage("work"); const sections = await getPublishedPageSections("work");',
  pageSections: 'return supabase.from("page_sections");',
};

test("approved mixed authority matrix passes", () => {
  assert.deepEqual(verifyPublicAuthority(valid), {
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
  });
});

test("About using the legacy body reader fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, about: 'getPublishedPageSections("about")' }), /About/);
});

test("Home without the approved render path fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, home: 'getPublishedPageDocument("home")' }), /Home/);
});

test("Home using the legacy body reader fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, home: 'getPublishedPageSections("home")' }), /Home/);
});

test("Services without the approved render path fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, services: 'getPublishedPageDocument("services")' }), /Services/);
});

test("Services using the legacy body reader fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, services: 'getPublishedPageSections("services")' }), /Services/);
});

test("Contact without the approved render path fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, contact: 'getPublishedPageDocument("contact")' }), /Contact/);
});

test("Contact using the legacy body reader fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, contact: 'getPublishedPageSections("contact")' }), /Contact/);
});

test("Work leaving legacy authority fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, work: 'getPublishedPageDocument("work")' }), /Work/);
});
