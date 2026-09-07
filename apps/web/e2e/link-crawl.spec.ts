import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

/**
 * Link and route integrity crawl.
 *
 * Breadth-first over every same-origin link reachable from a fixed seed set,
 * in both locales, on both Playwright projects. Fails on any internal page
 * or asset answering 400 or above, any console error, any hydration warning,
 * any horizontal overflow, any broken image, and any href that leaks the
 * internal `/en/` or `/es/` rewrite target (the public URL never carries a
 * locale prefix — see `proxy.ts`).
 *
 * Only fixture handles are visited under `/u/`: rendering a profile writes
 * that handle's snapshot, and this suite runs against real data. Other `/u/`
 * links (leaderboard, sitemap) are recorded but never followed.
 *
 * Latency budgets (regression guard for 8fcc0371, which restored the stats
 * cache after every render had paid a live GitHub fetch) are asserted only
 * against a production build, i.e. when PLAYWRIGHT_BASE_URL is set; a dev
 * server's compile time would make them meaningless.
 */

const FIXTURE_HANDLES = [
  "octocat",
  "juan294",
  ...(process.env.E2E_BOARD_HANDLE?.trim() ? [process.env.E2E_BOARD_HANDLE.trim()] : []),
];

const ARCHETYPES = ["builder", "guardian", "marathoner", "polymath", "artificer", "balanced", "emerging"];
const EXPERIMENTS = [
  "3d-tilt", "aurora", "confetti", "glassmorphism", "gradient-border", "heatmap-wave", "hexmap",
  "holographic", "metallic-shimmer", "number-counters", "particles", "text-effects", "tier-visuals",
];

const SEEDS = [
  "/", "/about", "/about/scoring", "/about/verification", "/about/leaderboard",
  "/privacy", "/terms", "/verify", "/studio?demo=1", "/generating/octocat", "/coming-soon",
  ...ARCHETYPES.map((a) => `/archetypes/${a}`),
  ...EXPERIMENTS.map((e) => `/experiments/${e}`),
  ...FIXTURE_HANDLES.map((h) => `/u/${h}`),
];

const MAX_DEPTH = 3;
const MAX_PAGES = 150;
const isProductionBuild = Boolean(process.env.PLAYWRIGHT_BASE_URL?.trim());
const HYDRATION = /hydrat|Minified React error #(?:418|419|423)/i;
const EXPECTED_SIGNED_OUT = new Set(["/api/auth/session", "/api/generate"]);

type Visit = {
  url: string;
  from: string;
  depth: number;
  status: number;
  ms: number;
  consoleErrors: string[];
  failedRequests: string[];
  overflowPx: number;
  localeLeaks: string[];
  brokenImages: string[];
  externalLinks: string[];
  skippedProfileLinks: string[];
};

function normalize(href: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (!/^https?:$/.test(url.protocol)) return null;
  url.hash = "";
  return url.pathname + url.search;
}

function shouldFollow(path: string): boolean {
  if (path.startsWith("/api/")) return false;
  if (path.startsWith("/u/")) {
    const handle = path.split("/")[2]?.split("?")[0] ?? "";
    return FIXTURE_HANDLES.includes(handle) && !path.endsWith("/badge.svg") && !path.endsWith("/og-image");
  }
  return true;
}

async function visit(page: Page, origin: string, path: string, from: string, depth: number): Promise<Visit> {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const onConsole = (message: { type(): string; text(): string; location(): { url?: string } }) => {
    if (message.type() !== "error") return;
    const text = message.text();
    // Vercel's first-party analytics scripts exist only on a Vercel deployment;
    // a local production build 404s them and the browser echoes that here.
    if (/\/_vercel\//.test(message.location()?.url ?? "") || /\/_vercel\//.test(text)) return;
    // Dev-server-only noise, not site defects: the CSP blocks Vercel's debug
    // analytics scripts (production serves them first-party from /_vercel),
    // the browser echoes the allowlisted 401/429 responses as resource
    // failures, and Next forwards server logs for the synthetic handle that
    // deliberately does not exist on GitHub.
    if (/va\.vercel-scripts\.com/.test(text)) return;
    if (/Failed to load resource: .* (?:401|429) /.test(text)) return;
    if (/\[github\] GraphQL errors for chapa-e2e-/.test(text)) return;
    consoleErrors.push(text);
  };
  const onPageError = (error: Error) => consoleErrors.push(`pageerror: ${error.message}`);
  const onResponse = (response: { url(): string; status(): number }) => {
    const url = new URL(response.url());
    if (url.origin !== origin || response.status() < 400) return;
    // Signed-out visitors legitimately get 401 from the session probe and from
    // `/generating/:handle`'s generate call; that state is what those pages
    // render. A 429 on the session probe is the crawl's own concurrency from
    // one IP (60/min on the session probe, stricter on login) and is counted
    // separately rather than failed.
    if (response.status() === 401 && EXPECTED_SIGNED_OUT.has(url.pathname)) return;
    if (response.status() === 404 && url.pathname.startsWith("/_vercel/")) return;
    if (response.status() === 429 && url.pathname.startsWith("/api/auth/")) {
      failedRequests.push(`rate-limited ${url.pathname}`);
      return;
    }
    failedRequests.push(`${response.status()} ${url.pathname}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  const started = Date.now();
  const response = await page.goto(path, { waitUntil: "load" });
  const ms = Date.now() - started;
  await page.waitForTimeout(300);

  // A page may navigate again after load (e.g. `/generating/:handle` redirects
  // to the profile once generation settles). Let that navigation finish and
  // measure the page the user ends up on.
  const measure = () => page.evaluate(({ fixtureHandles, currentOrigin }) => {
    const root = document.documentElement;
    const anchors = [...document.querySelectorAll("a[href]")] as HTMLAnchorElement[];
    const hrefs = anchors.map((a) => a.getAttribute("href") ?? "");
    const images = [...document.querySelectorAll("img")] as HTMLImageElement[];
    const external: string[] = [];
    const skippedProfiles: string[] = [];
    const internal: string[] = [];
    for (const a of anchors) {
      let url: URL;
      try {
        url = new URL(a.href);
      } catch {
        continue;
      }
      if (url.origin !== currentOrigin) {
        if (/^https?:$/.test(url.protocol)) external.push(url.href);
        continue;
      }
      const handle = url.pathname.startsWith("/u/") ? url.pathname.split("/")[2] ?? "" : null;
      if (handle !== null && !fixtureHandles.includes(handle)) {
        skippedProfiles.push(url.pathname);
        continue;
      }
      internal.push(url.href);
    }
    return {
      overflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
      localeLeaks: hrefs.filter((h) => /^\/(?:en|es)(?:\/|$|\?)/.test(h)),
      brokenImages: images
        .filter((img) => img.getAttribute("src") && img.complete && img.naturalWidth === 0)
        .map((img) => img.getAttribute("src") ?? ""),
      internal,
      external: [...new Set(external)],
      skippedProfiles: [...new Set(skippedProfiles)],
    };
  }, { fixtureHandles: FIXTURE_HANDLES, currentOrigin: origin });

  let measured: Awaited<ReturnType<typeof measure>> | null = null;
  for (let attempt = 0; attempt < 3 && !measured; attempt += 1) {
    try {
      measured = await measure();
    } catch (error) {
      if (!/Execution context was destroyed|Target closed|navigation/i.test(String(error)) || attempt === 2) throw error;
      await page.waitForLoadState("load");
      await page.waitForTimeout(500);
    }
  }
  if (!measured) throw new Error(`could not measure ${path}`);

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  page.off("response", onResponse);

  return {
    url: path,
    from,
    depth,
    status: response?.status() ?? 0,
    ms,
    consoleErrors,
    failedRequests,
    overflowPx: measured.overflowPx,
    localeLeaks: measured.localeLeaks,
    brokenImages: measured.brokenImages,
    externalLinks: measured.external,
    skippedProfileLinks: measured.skippedProfiles,
    // carried on the object for the crawl loop, stripped from the report
    ...({ __links: measured.internal } as object),
  };
}

for (const locale of ["en", "es"] as const) {
  test(`every internal link resolves (${locale})`, async ({ page, context, baseURL }, testInfo) => {
    test.setTimeout(900_000);
    const origin = new URL(baseURL ?? "http://localhost:3001").origin;
    await context.addCookies([{ name: "chapa-locale", value: locale, url: origin }]);

    const queue: Array<{ path: string; from: string; depth: number }> = SEEDS.map((path) => ({ path, from: "seed", depth: 0 }));
    const seen = new Set<string>(SEEDS);
    const visits: Visit[] = [];
    const viewportWidth = page.viewportSize()?.width ?? 0;

    while (queue.length > 0 && visits.length < MAX_PAGES) {
      const next = queue.shift()!;
      const result = await visit(page, origin, next.path, next.from, next.depth);
      const links = (result as unknown as { __links: string[] }).__links;
      delete (result as unknown as { __links?: string[] }).__links;
      visits.push(result);
      if (next.depth >= MAX_DEPTH) continue;
      for (const href of links) {
        const path = normalize(href, origin);
        if (!path || seen.has(path) || !shouldFollow(path)) continue;
        seen.add(path);
        queue.push({ path, from: next.path, depth: next.depth + 1 });
      }
    }

    let landingWarmMs: number | null = null;
    const profileWarmMs: Record<string, number> = {};
    if (isProductionBuild) {
      landingWarmMs = (await visit(page, origin, "/", "warm", 0)).ms;
      for (const handle of ["juan294", "octocat"]) {
        profileWarmMs[handle] = (await visit(page, origin, `/u/${handle}`, "warm", 0)).ms;
      }
    }

    const report = {
      locale,
      project: testInfo.project.name,
      viewportWidth,
      productionBuild: isProductionBuild,
      pages: visits.length,
      sessionRateLimited: visits.reduce((n, v) => n + v.failedRequests.filter((r) => r.startsWith("rate-limited")).length, 0),
      landingColdMs: visits.find((v) => v.url === "/")?.ms ?? null,
      landingWarmMs,
      profileWarmMs,
      visits,
    };
    const reportPath = testInfo.outputPath(`crawl-${locale}-${testInfo.project.name}.json`);
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    await testInfo.attach(`crawl-${locale}-${testInfo.project.name}.json`, { path: reportPath, contentType: "application/json" });

    const describe = (v: Visit) => `${v.url} (from ${v.from})`;
    expect(visits.length, "crawl visited at least the seed set").toBeGreaterThanOrEqual(SEEDS.length);
    expect(visits.filter((v) => v.status >= 400 || v.status === 0).map((v) => `${v.status} ${describe(v)}`), "pages answering >= 400").toEqual([]);
    expect(visits.flatMap((v) => v.failedRequests.filter((r) => !r.startsWith("rate-limited")).map((r) => `${r} on ${v.url}`)), "same-origin requests >= 400").toEqual([]);
    expect(visits.flatMap((v) => v.consoleErrors.map((e) => `${v.url}: ${e.slice(0, 200)}`)), "console errors").toEqual([]);
    expect(visits.flatMap((v) => v.consoleErrors.filter((e) => HYDRATION.test(e)).map((e) => `${v.url}: ${e.slice(0, 120)}`)), "hydration warnings").toEqual([]);
    // `/experiments/*` are flag-gated prototypes and exempt from the product
    // layout rules (docs/design-system.md); their overflow is recorded in the
    // attached JSON but does not fail the crawl.
    expect(visits.filter((v) => v.overflowPx > 0 && !v.url.startsWith("/experiments/")).map((v) => `${v.url}: +${v.overflowPx}px at ${viewportWidth}`), "horizontal overflow").toEqual([]);
    expect(visits.flatMap((v) => v.localeLeaks.map((h) => `${v.url}: ${h}`)), "locale-prefixed hrefs").toEqual([]);
    expect(visits.flatMap((v) => v.brokenImages.map((s) => `${v.url}: ${s}`)), "broken images").toEqual([]);

    if (isProductionBuild) {
      expect(report.landingColdMs, "landing cold render").toBeLessThan(5000);
      expect(landingWarmMs, "landing warm render").toBeLessThan(2000);
      for (const [handle, ms] of Object.entries(profileWarmMs)) {
        expect(ms, `/u/${handle} warm render`).toBeLessThan(2000);
      }
    }
  });
}

test("non-HTML routes answer with the expected status and content type", async ({ request }) => {
  const checks: Array<{ path: string; status: number | number[]; type?: RegExp; header?: [string, RegExp] }> = [
    { path: "/robots.txt", status: 200, type: /text\/plain/ },
    { path: "/sitemap.xml", status: 200, type: /xml/ },
    { path: "/llms.txt", status: 200, type: /text\/plain/ },
    { path: "/llms-full.txt", status: 200, type: /text\/plain/ },
    { path: "/site.webmanifest", status: 200, type: /manifest|json/ },
    { path: "/.well-known/security.txt", status: 200, type: /text\/plain/ },
    { path: "/.well-known/mcp.json", status: 200, type: /json/ },
    { path: "/.well-known/glama.json", status: 200, type: /json/ },
    { path: "/og-image", status: 200, type: /image\/png/ },
    { path: "/u/octocat/og-image", status: 200, type: /image\/png/ },
    { path: "/u/octocat/badge.svg", status: 200, type: /image\/svg\+xml/ },
    { path: "/u/octocat/badge.svg?lang=es", status: 200, type: /image\/svg\+xml/ },
    { path: "/u/bad%20handle/badge.svg", status: 400, type: /image\/svg\+xml/ },
    { path: "/u/this-user-definitely-does-not-exist-xyz123", status: [200, 404] },
    { path: "/api/profile/octocat", status: 200, type: /json/ },
    { path: "/api/history/octocat", status: 200, type: /json/ },
    { path: "/api/insights/octocat", status: [200, 404], type: /json/ },
    { path: "/api/feature-flags", status: 200, type: /json/ },
    { path: "/api/version", status: 200, type: /json/ },
    { path: "/api/mcp", status: 405, header: ["allow", /POST/] },
    { path: "/api/health", status: [200, 503], type: /json/ },
  ];
  const failures: string[] = [];
  for (const check of checks) {
    const response = await request.get(check.path, { maxRedirects: 0 });
    const allowed = Array.isArray(check.status) ? check.status : [check.status];
    if (!allowed.includes(response.status())) failures.push(`${check.path}: status ${response.status()}, expected ${allowed.join("|")}`);
    const contentType = response.headers()["content-type"] ?? "";
    if (check.type && !check.type.test(contentType)) failures.push(`${check.path}: content-type ${contentType || "(none)"}`);
    if (check.header) {
      const value = response.headers()[check.header[0]] ?? "";
      if (!check.header[1].test(value)) failures.push(`${check.path}: ${check.header[0]} ${value || "(none)"}`);
    }
  }
  expect(failures, "non-HTML route checks").toEqual([]);
});
