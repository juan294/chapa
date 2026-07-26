import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseRequiredCatalog } from "./contracts";

export async function validateCatalogFile(path: string): Promise<string[]> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as unknown;
    const result = parseRequiredCatalog(raw);
    return result.ok ? [] : result.errors;
  } catch (error) {
    return [
      `${path}: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
}

async function main(): Promise<void> {
  const path = process.argv[2] ?? "quality/release-required.json";
  const errors = await validateCatalogFile(path);
  if (errors.length) {
    errors.forEach((error) => console.error(error));
    process.exitCode = 1;
    return;
  }
  console.log(`Release-required catalog is valid: ${path}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
