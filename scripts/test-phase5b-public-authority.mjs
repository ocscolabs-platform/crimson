import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyPublicAuthority } from "./verify-phase5b-public-authority.mjs";

const valid = {
  about: 'const result = await getPublishedPageDocument("about"); createAboutPageRenderData(result.document);',
  services: 'const result = await getPublishedPageDocument("services"); createServicesPageRenderData(result.document);',
  home: 'const sections = await getPublishedPageSections("home");',
  contact: 'const sections = await getPublishedPageSections("contact");',
  work: 'const sections = await getPublishedPageSections("work");',
  pageSections: 'return supabase.from("page_sections");',
};

test("approved mixed authority matrix passes", () => {
  assert.deepEqual(verifyPublicAuthority(valid), {
    about: "PageDocument",
    home: "transitional",
    services: "PageDocument",
    contact: "transitional",
    work: "legacy",
  });
});

test("About using the legacy body reader fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, about: 'getPublishedPageSections("about")' }), /About/);
});

test("Home cut over before Slice 4E fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, home: 'getPublishedPageDocument("home")' }), /home/);
});

test("Services without the approved render path fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, services: 'getPublishedPageDocument("services")' }), /Services/);
});

test("Services using the legacy body reader fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, services: 'getPublishedPageSections("services")' }), /Services/);
});

test("Contact cut over before Slice 4D fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, contact: 'getPublishedPageDocument("contact")' }), /contact/);
});

test("Work leaving legacy authority fails", () => {
  assert.throws(() => verifyPublicAuthority({ ...valid, work: 'getPublishedPageDocument("work")' }), /Work/);
});
