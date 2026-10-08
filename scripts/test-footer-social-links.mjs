import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [footer, styles, packageJson] = await Promise.all([
  readFile(new URL("src/components/site-footer.tsx", root), "utf8"),
  readFile(new URL("src/app/globals.css", root), "utf8"),
  readFile(new URL("package.json", root), "utf8"),
]);

const links = [
  ["https://www.instagram.com/ocscodotio/", "OCSCO on Instagram"],
  ["https://www.facebook.com/ocscohq", "OCSCO on Facebook"],
  ["https://ph.linkedin.com/company/ocsco", "OCSCO on LinkedIn"],
];

test("shared footer exposes the three approved external social links", () => {
  for (const [href, label] of links) {
    assert.match(footer, new RegExp(`href="${href.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}" target="_blank" rel="noopener noreferrer" aria-label="${label}"`));
  }
  assert.equal((footer.match(/className="footer-social-link"/g) ?? []).length, 3);
});

test("social icons are decorative and have consistent practical tap targets", () => {
  assert.equal((footer.match(/aria-hidden="true" focusable="false"/g) ?? []).length, 3);
  assert.match(styles, /\.footer-social-link \{[^}]*width: 44px; height: 44px;/);
  assert.match(styles, /\.footer-social-link:hover \{[^}]*color: var\(--green\);/);
});

test("the patch does not add another icon dependency", () => {
  const dependencies = JSON.parse(packageJson).dependencies;
  assert.equal(dependencies["lucide-react"], "^1.32.0");
  assert.equal(Object.keys(dependencies).filter((name) => name.includes("icon")).length, 0);
});
