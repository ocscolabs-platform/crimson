import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

export const BACKWARD_COMPATIBLE = "backward-compatible";
export const REQUIRES_TWO_PHASE = "requires-two-phase-release";

const declarationPattern =
  /^\s*--\s*release-compatibility:\s*(backward-compatible|requires-two-phase-release)\s*$/gim;

export function classifyMigration(source) {
  const declarations = [...source.matchAll(declarationPattern)].map((match) =>
    match[1].toLowerCase(),
  );

  if (declarations.length === 0) return { classification: null };
  if (declarations.length > 1) {
    return { error: "contains more than one release-compatibility declaration" };
  }

  return { classification: declarations[0] };
}

export async function evaluateMigrationDelta(files, loadFile = readFile) {
  if (files.length === 0) {
    return {
      ok: true,
      message: "NO DATABASE MIGRATION — NOT APPLICABLE",
      files: [],
    };
  }

  const errors = [];
  const compatible = [];

  for (const file of files) {
    if (file.status !== "A") {
      errors.push(
        `${file.path}: existing canonical migrations are immutable; add a new migration instead`,
      );
      continue;
    }

    const result = classifyMigration(await loadFile(file.path, "utf8"));
    if (result.error) {
      errors.push(`${file.path}: ${result.error}`);
    } else if (!result.classification) {
      errors.push(`${file.path}: missing release-compatibility declaration`);
    } else if (result.classification === REQUIRES_TWO_PHASE) {
      errors.push(`${file.path}: declared ${REQUIRES_TWO_PHASE}`);
    } else {
      compatible.push(file.path);
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      message: errors.some((error) => error.includes(REQUIRES_TWO_PHASE))
        ? "SCHEMA-SENSITIVE RELEASE REQUIRES SPLIT PROMOTION"
        : "SCHEMA-SENSITIVE RELEASE COMPATIBILITY DECLARATION REQUIRED",
      errors,
      files: compatible,
    };
  }

  return {
    ok: true,
    message: `SCHEMA-SENSITIVE RELEASE COMPATIBLE — ${compatible.length} migration(s)`,
    files: compatible,
  };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function changedMigrationFiles(base) {
  const output = execFileSync(
    "git",
    [
      "diff",
      "--name-status",
      "--diff-filter=ACDMRT",
      `${base}...HEAD`,
      "--",
      ":(glob)supabase/migrations/*.sql",
    ],
    { encoding: "utf8" },
  );

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [status, path] = line.split("\t");
      return { status, path };
    });
}

async function main() {
  const base = argumentValue("--base");
  if (!base) {
    console.error("Usage: verify-schema-release-compatibility.mjs --base <git-ref>");
    process.exitCode = 1;
    return;
  }

  try {
    execFileSync("git", ["rev-parse", "--verify", `${base}^{commit}`], {
      stdio: "ignore",
    });
  } catch {
    console.error(`Schema compatibility base is not available: ${base}`);
    process.exitCode = 1;
    return;
  }

  const result = await evaluateMigrationDelta(changedMigrationFiles(base));
  console.log(result.message);
  for (const file of result.files) console.log(`- ${file}`);
  for (const error of result.errors ?? []) console.error(`- ${error}`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
