import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

const MEDIA_MAX_EDGE = 2400;
const mediaSources = [
  "src/app/admin/case-studies/[slug]/page.tsx",
  "src/app/admin/insights/articles/actions.ts",
];

async function createInput(format, width = 64, height = 48) {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 18, g: 92, b: 140 },
    },
  });

  return image[format]().toBuffer();
}

async function normalize(input) {
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize({
      width: MEDIA_MAX_EDGE,
      height: MEDIA_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

test("the installed Sharp release is the patched target", () => {
  assert.equal(sharp.versions.sharp, "0.35.5");
});

for (const [format, mediaType] of [
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["avif", "image/avif"],
]) {
  test(`${format.toUpperCase()} input decodes and normalizes to WebP`, async () => {
    const input = await createInput(format);
    const inputMetadata = await sharp(input, { failOn: "error" }).metadata();
    assert.equal(inputMetadata.mediaType, mediaType);
    assert.deepEqual([inputMetadata.width, inputMetadata.height], [64, 48]);

    const output = await normalize(input);
    const outputMetadata = await sharp(output, { failOn: "error" }).metadata();
    assert.equal(outputMetadata.mediaType, "image/webp");
    assert.deepEqual([outputMetadata.width, outputMetadata.height], [64, 48]);
  });
}

test("normalization preserves aspect ratio and enforces the 2400px dimension cap", async () => {
  const input = await createInput("png", 3200, 1200);
  const output = await normalize(input);
  const metadata = await sharp(output, { failOn: "error" }).metadata();
  assert.deepEqual([metadata.width, metadata.height], [2400, 900]);
});

test("invalid image input is rejected", async () => {
  await assert.rejects(() => normalize(Buffer.from("not-an-image")));
});

test("Work and Insights retain source and normalized 2 MB size guards", async () => {
  for (const path of mediaSources) {
    const source = await readFile(path, "utf8");
    assert.match(source, /MEDIA_SOURCE_SIZE_LIMIT = 2 \* 1024 \* 1024/);
    assert.match(source, /MEDIA_OUTPUT_SIZE_LIMIT = 2 \* 1024 \* 1024/);
    assert.match(source, /file\.size > MEDIA_SOURCE_SIZE_LIMIT/);
    assert.match(source, /(?:convertedImage|normalized)\.length > MEDIA_OUTPUT_SIZE_LIMIT/);
  }
});

test("Insights validates the decoded MIME type exposed by Sharp", async () => {
  const source = await readFile("src/app/admin/insights/articles/actions.ts", "utf8");
  assert.match(source, /metadata\.mediaType/);
  assert.doesNotMatch(source, /actualFormat === "avif"/);
});
