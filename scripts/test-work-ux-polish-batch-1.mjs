import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const [workPage, mediaPreview, siteHeader, routeShell, workDetailPage, homePage, homeSections, styles] = await Promise.all([
  source("src/app/work/page.tsx"),
  source("src/app/work/WorkCardMediaPreview.tsx"),
  source("src/components/site-header.tsx"),
  source("src/components/route-shell.tsx"),
  source("src/app/work/[slug]/page.tsx"),
  source("src/app/page.tsx"),
  source("src/components/home-page-sections.tsx"),
  source("src/app/globals.css"),
]);

test("Work cards expose a stretched internal target while external actions remain independent", () => {
  assert.equal((workPage.match(/className="work-card-primary-target"/g) ?? []).length, 2);
  assert.match(workPage, /href=\{`\/work\/\$\{featuredProject\.slug\}`\} aria-label=\{`View \$\{featuredProject\.name\} project`\}/);
  assert.match(workPage, /href=\{`\/work\/\$\{project\.slug\}`\} aria-label=\{`View \$\{project\.name\} project`\}/);
  assert.match(workPage, /href=\{featuredProject\.href\} target="_blank" rel="noreferrer"/);
  assert.match(workPage, /href=\{project\.href\} target="_blank" rel="noreferrer"/);
  assert.match(styles, /\.work-card-primary-target \{ position: absolute; z-index: 1; inset: 0;/);
  assert.match(styles, /\.work-card-actions \{ position: relative; z-index: 2;/);
});
test("Work actions use readable contrast and practical touch targets", () => {
  assert.match(styles, /\.work-card-link \{[^}]*min-height: 44px;[^}]*color: var\(--ink\);/);
  assert.match(styles, /\.work-card-link-secondary \{ color: var\(--copy\); font-weight: 700; \}/);
  assert.doesNotMatch(styles, /\.work-card-link:hover \{ color: var\(--green\)/);
});

test("Work listing media renders one static primary image without hover cycling or view badges", () => {
  assert.equal((mediaPreview.match(/<Image/g) ?? []).length, 1);
  assert.doesNotMatch(mediaPreview, /use client|useState|useEffect|setInterval|onMouseEnter|onFocus|views/);
  assert.doesNotMatch(workPage, /supportingMedia[^\n]*WorkCardMediaPreview|images=\{/);
  assert.doesNotMatch(styles, /work-card-preview-count|img\.is-active/);
  assert.match(styles, /\.work-card-media-preview img \{[^}]*object-fit: contain;/);
});

test("global public navigation provides skip and focus-visible behavior with nested route context", () => {
  assert.match(siteHeader, /<a className="skip-link" href="#main-content">Skip to content<\/a>/);
  assert.match(siteHeader, /pathname\.startsWith\(`\$\{href\}\/?`/);
  assert.match(siteHeader, /aria-current=\{isActive\(item\.href\) \? "page" : undefined\}/);
  assert.match(routeShell, /id="main-content" tabIndex=\{-1\}/);
  assert.match(homePage, /id="main-content" tabIndex=\{-1\}/);
  assert.match(styles, /:where\(a, button, input, select, textarea, summary, \[role="button"\]\):focus-visible/);
  assert.match(styles, /\.skip-link:focus-visible \{[^}]*transform: translateY\(0\)/);
});

test("Work detail hero restores Work context and a simple return path", () => {
  assert.match(workDetailPage, /backLink=\{\{ href: "\/work", label: "All work" \}\}/);
  assert.match(routeShell, /<span aria-hidden="true">←<\/span> \{backLink\.label\}/);
  assert.match(styles, /\.route-hero-back \{[^}]*min-height: 44px;/);
});

test("Home Work preview reuses published ordering in a three-card CSS-only rail", () => {
  const introSection = homeSections.slice(
    homeSections.indexOf('case "home_intro"'),
    homeSections.indexOf('case "home_capabilities"'),
  );
  const proofSection = homeSections.slice(
    homeSections.indexOf('case "home_proof"'),
    homeSections.indexOf('case "home_contact"'),
  );

  assert.match(homePage, /getPublishedWorkProjects\(\{ includeRelatedCapabilities: false \}\)/);
  assert.match(homePage, /<HomePageSections sections=\{body\} workProjects=\{workProjects\} \/>/);
  assert.match(homeSections, /const workPreview = workProjects\.slice\(0, 3\)/);
  assert.match(introSection, /<HomeWorkPreview projects=\{workPreview\} \/>/);
  assert.doesNotMatch(proofSection, /HomeWorkPreview/);
  assert.match(homeSections, /className="home-work-preview-card" href="\/work"/);
  assert.match(homeSections, /className="home-work-preview-all" href="\/work">View all work/);
  assert.doesNotMatch(homeSections, /useState|onTouch|onMouse|setInterval/);
  assert.match(styles, /\.home-work-preview-rail \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 840px\)[\s\S]*?\.home-work-preview-rail \{[^}]*overflow-x: auto;[^}]*scroll-snap-type: x mandatory;/);
  assert.match(styles, /\.home-work-preview-card \{ flex: 0 0 86%; scroll-snap-align: start; \}/);
});
