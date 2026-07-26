import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { analyzeReleaseRun } from "./contracts";

function option(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const runPath = option(argv, "--run");
  const catalogPath =
    option(argv, "--catalog") ?? "quality/release-required.json";
  const stage = option(argv, "--stage") ?? "final";
  if (!runPath) throw new Error("--run is required");
  if (stage !== "pre-merge" && stage !== "final") {
    throw new Error("--stage must be pre-merge or final");
  }
  const [catalog, run] = await Promise.all([
    readFile(catalogPath, "utf8").then((value) => JSON.parse(value) as unknown),
    readFile(runPath, "utf8").then((value) => JSON.parse(value) as unknown),
  ]);
  const analysis = analyzeReleaseRun(catalog, run, { stage });
  console.log(JSON.stringify(analysis, null, 2));
  if (analysis.decision === "blocked") process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
