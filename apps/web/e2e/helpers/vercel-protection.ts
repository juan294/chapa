import { tmpdir } from "node:os";
import { join } from "node:path";

const runId = (process.env.E2E_PRO_RUN_ID ?? "local")
  .replace(/[^0-9A-Za-z._-]/g, "-");

export const vercelBypassStorageStatePath = join(
  tmpdir(),
  `chapa-playwright-vercel-bypass-${runId}.json`,
);

export function isCookieScopedToPreview(
  cookie: { domain: string; path: string },
  previewUrl: string,
): boolean {
  try {
    const previewHost = new URL(previewUrl).hostname;
    return (
      cookie.domain.replace(/^\./, "") === previewHost && cookie.path === "/"
    );
  } catch {
    return false;
  }
}
