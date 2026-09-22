/**
 * Regenerate docs/assets/badge-reference.png on purpose (#1277).
 *
 *   pnpm run generate:badge-reference
 *
 * Commit the result when the badge design changes. The test suite validates
 * the pipeline in a temporary directory and never writes this file.
 */
import { REFERENCE_PNG_PATH, writeBadgeReferencePng } from "./badge-reference";

async function main(): Promise<void> {
  const bytes = await writeBadgeReferencePng(REFERENCE_PNG_PATH);
  console.log(`Wrote ${REFERENCE_PNG_PATH} (${bytes} bytes)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
