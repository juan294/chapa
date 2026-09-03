import { execFileSync } from "node:child_process";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { hasRenderedText, verifyHashFromHtml } from "./probe-html";

export const smokeProfilePath = "/u/octocat?__chapa_smoke=1";
export const smokeBadgePath = "/u/octocat/badge.svg?__chapa_smoke=1";

// The badge's own verification strip hardcodes this production host (see
// apps/web/lib/render/VerificationStrip.ts) — an established precedent for
// referencing the fixed production domain directly rather than deriving it
// from the environment under test. Rollback readiness is only meaningful
// checked against the ACTUAL live production identity, never whichever
// preview happens to be under test.
const PRODUCTION_ORIGIN = "https://chapa.thecreativetoken.com";


export async function assertCoreDependencies(
  request: APIRequestContext,
): Promise<void> {
  const response = await request.get("/api/health");
  const body = await response.json();
  expect(body.dependencies.redis).toBe("ok");
  expect(body.dependencies.supabase).toBe("ok");
  expect(body.dependencies.github).toBe("ok");
}

export async function assertBadgeSvg(
  request: APIRequestContext,
): Promise<void> {
  const response = await request.get(smokeBadgePath);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"] ?? "").toContain("image/svg+xml");
  const body = await response.text();
  expect(body).toContain("<svg");
  expect(body).toContain("</svg>");
}

export async function assertSharePage(page: Page): Promise<void> {
  const response = await page.goto(smokeProfilePath, {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(200);
  await expect(page.locator("body")).toBeVisible();
}

export async function assertGitHubLoginRedirect(
  request: APIRequestContext,
): Promise<void> {
  const response = await request.get("/api/auth/login", { maxRedirects: 0 });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  expect(response.headers()["location"] ?? "").toContain("github.com");
}

/**
 * #1190 — rollback readiness, promoted out of the manual release checklist.
 * A pure assertion: the release's `baselineTag` must resolve to a real,
 * ANNOTATED git tag (not lightweight — an annotated tag object carries a
 * tagger/message and can be verified as a real release marker, not just a
 * ref someone pointed at a commit), and that tag's commit must be exactly
 * what production is currently running. No browser required — this is git
 * plus one HTTP call.
 */
export async function assertRollbackReadiness(
  request: APIRequestContext,
): Promise<void> {
  const baselineTag = process.env.RELEASE_BASELINE_TAG?.trim();
  expect(
    baselineTag,
    "RELEASE_BASELINE_TAG is required for rollback-readiness evidence",
  ).toBeTruthy();

  const tagType = execFileSync("git", ["cat-file", "-t", baselineTag!], {
    encoding: "utf8",
  }).trim();
  expect(tagType, `${baselineTag} must be an annotated tag`).toBe("tag");

  const tagCommit = execFileSync(
    "git",
    ["rev-parse", `${baselineTag}^{commit}`],
    { encoding: "utf8" },
  ).trim();
  expect(tagCommit).toMatch(/^[0-9a-f]{40}$/);

  const response = await request.get(`${PRODUCTION_ORIGIN}/api/version`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.environment).toBe("production");
  expect(
    body.commitSha,
    `production identity must match baseline tag ${baselineTag} (${tagCommit})`,
  ).toBe(tagCommit);
}

/**
 * #1190 — the share page's badge + embed snippet, plus its verification
 * link, must resolve end to end: the inline badge SVG's verification strip
 * links to /verify/{hash}, and that page must render the verified success
 * state (not the not-found or invalid-hash states).
 */
/**
 * Keep the response body when an assertion on it fails, so a transient
 * (the share page once rendered without its verify link about a minute
 * after a deployment went live, #1279) is diagnosable from the artifact
 * instead of lost with the run.
 */
async function withBodyAttachment<T>(
  name: string,
  body: string,
  assertions: () => T,
): Promise<T> {
  try {
    return assertions();
  } catch (error) {
    // Written to the test's output directory as well as attached, so the
    // body survives a plain `--reporter=list` run, not only an HTML report.
    const path = test.info().outputPath(name);
    await writeFile(path, body);
    await test.info().attach(name, { path, contentType: "text/html" });
    throw error;
  }
}

export async function assertShareVerification(
  request: APIRequestContext,
): Promise<void> {
  const response = await request.get(`${smokeProfilePath}&lang=en`);
  expect(response.status()).toBe(200);
  const body = await response.text();
  const hash = await withBodyAttachment("share-page.html", body, () => {
    expect(body).toContain("Embed this badge");
    // #1279 — the previous pattern tried the 8-character alternative first
    // and verified the first 8 characters of a 32-character hash.
    const hash = verifyHashFromHtml(body);
    expect(hash, "share page did not render a /verify/{hash} link").not.toBeNull();
    return hash!;
  });

  const verifyResponse = await request.get(`/verify/${hash}?lang=en`);
  expect(verifyResponse.status()).toBe(200);
  const verifyBody = await verifyResponse.text();
  // #1279 — rendered state, not document substrings: the page also ships
  // its translation dictionary, which names every state it can render.
  await withBodyAttachment("verify-page.html", verifyBody, () => {
    expect(hasRenderedText(verifyBody, "Badge verified"), "verify page did not render the verified state").toBe(true);
    expect(hasRenderedText(verifyBody, "Invalid hash"), "verify page rendered the invalid-hash callout").toBe(false);
    expect(hasRenderedText(verifyBody, "Not found"), "verify page rendered the not-found callout").toBe(false);
  });
}

export async function assertLocales(request: APIRequestContext): Promise<void> {
  // #1217 replaced the sr-only, localized h1 with a visible one carrying the
  // profile identity, which reads the same in both locales. The badge's
  // accessible label is the localized string that is still server-rendered
  // into the HTML, so it is what these probes assert on now.
  const en = await request.get(`${smokeProfilePath}&lang=en`);
  expect(en.status()).toBe(200);
  expect(await en.text()).toContain("Chapa badge for octocat");

  const es = await request.get(`${smokeProfilePath}&lang=es`);
  expect(es.status()).toBe(200);
  expect(await es.text()).toContain("Chapa de octocat");
}
