import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve("supabase", "migrations");
const filenamePattern = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

const files = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort();

const errors = [];
const versions = new Set();

if (files.length === 0) {
  errors.push("No SQL migrations were found.");
}

for (const file of files) {
  const match = filenamePattern.exec(file);
  if (!match) {
    errors.push(`${file}: expected <14-digit-timestamp>_<lower_snake_case>.sql`);
    continue;
  }

  const [, version] = match;
  if (versions.has(version)) {
    errors.push(`${file}: duplicate migration version ${version}`);
  }
  versions.add(version);

  const body = await readFile(path.join(root, file), "utf8");
  if (!body.trim()) {
    errors.push(`${file}: migration is empty`);
  }

  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sb_secret_[A-Za-z0-9_]+/.test(body)) {
    errors.push(`${file}: possible secret material detected`);
  }
}

if (errors.length > 0) {
  console.error("Migration validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Migration validation passed: ${files.length} canonical migration files.`);
console.log(`First: ${files[0]}`);
console.log(`Last:  ${files.at(-1)}`);
