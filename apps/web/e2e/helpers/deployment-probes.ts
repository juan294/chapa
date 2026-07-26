import {
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

export const smokeProfilePath = "/u/octocat?__chapa_smoke=1";
export const smokeBadgePath = "/u/octocat/badge.svg?__chapa_smoke=1";

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
