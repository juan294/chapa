import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";
import { setRedesignSession, redesignFixtureClient } from "./helpers/redesign-fixtures";
import { assertScoringFixtureEnvironment, scoringReportHtml, enqueueGithubJob, seedFailedGithubJob } from "./helpers/scoring-point-fixtures";
import { studioRoot, studioControl, studioBadgePreview } from "./helpers/studio";

const admitted = process.env.REDESIGN_DISPOSABLE_PROJECT === "chapa-redesign";
if (process.env.RELEASE_VERIFICATION_MODE === "local-candidate" && !admitted) throw new Error("Local scoring qualification requires disposable fixtures");
test.skip(!admitted, "requires explicitly seeded disposable local scoring fixtures");
test.describe.configure({ mode: "serial" });

async function installTools(page: Page) {
  await page.addInitScript(() => {
    const tools = new Map<string, { execute(input: unknown): unknown }>();
    Object.defineProperty(window, "__scoringTools", { value: tools });
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool: async (tool: { name: string; execute(input: unknown): unknown }, options: { signal: AbortSignal }) => {
      tools.set(tool.name, tool); options.signal.addEventListener("abort", () => tools.delete(tool.name));
    } } });
  });
}
async function api(page: Page, handle: string) {
  const response = await page.request.get(`/api/profile/${handle}`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(JSON.stringify(body)).not.toMatch(/SCORING_PRIVATE_SENTINEL|semanticDigest|coreSemanticDigest|confidencePenalties/);
  return body;
}
async function settlePublicBadge(page: Page) {
  await expect(page.locator('svg[data-badge-design]').first()).toBeVisible();
  await expect(page.locator('svg[data-badge-design] [data-element="score"]').first()).toBeVisible();
  await expect(page.getByRole("status", { name: /^(Loading|Cargando)$/ })).toHaveCount(0);
  await expect(page.getByTestId("navbar-auth-placeholder")).toHaveCount(0);
  await page.evaluate(async () => { await document.fonts.ready; });
}
async function servedImage(page: Page) {
  // Social crawlers read the served HTML, not the hydrated DOM, so the
  // metadata contract is asserted on the server response for this exact URL
  // (with this browser context's cookies). The live DOM can briefly hold a
  // second, byte-identical tag after a same-page locale sync re-renders the
  // route's streamed metadata; that client-only duplicate is tracked
  // separately and never reaches a crawler.
  const html = await (await page.request.get(page.url())).text();
  const tags = html.match(/<meta[^>]+property="og:image"[^>]*>/g) ?? [];
  expect(tags).toHaveLength(1);
  const metadata = tags[0]?.match(/content="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  expect(metadata).toBeTruthy();
  const url = new URL(metadata!);
  expect(url.searchParams.get("v")).toBeTruthy();
  const response = await page.request.get(`${url.pathname}${url.search}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  const bytes = await response.body();
  return { bytes, digest: createHash("sha256").update(bytes).digest("hex") };
}
async function verifyIdentity(page: Page, profile: { identity: { revisionId: string; contentHash: string } }) {
  const href = await page.locator(`a[href*="/verify/v7.${profile.identity.revisionId}."]`).first().getAttribute("href");
  expect(href).toBeTruthy();
  const path = new URL(href!, page.url()).pathname;
  const response = await page.request.get(`/api${path}`);
  expect(response.status()).toBe(200);
  expect((await response.json()).envelope.contentHash.value).toBe(profile.identity.contentHash);
  return path;
}
async function currentSurface(page: Page, handle: string, craft: null | 57 | 0, baseline?: { exactScore: number; dimensions: unknown }) {
  const profile = await api(page, handle);
  expect(profile).toMatchObject({ policyVersion: "v7.2", displayScore: 46, compositeScore: 46, adjustedComposite: 46, archetype: null });
  expect(profile.exactScore).toBeCloseTo(46.40250879691149, 12);
  if (baseline) { expect(profile.exactScore).toBe(baseline.exactScore); for (const key of ["delivery", "quality", "consistency", "breadth"]) expect(profile.dimensions[key]).toBe((baseline.dimensions as Record<string, number>)[key]); }
  expect(profile.craft.status).toBe(craft === null ? "no_report" : "scored");
  if (craft !== null) expect(profile.craft.report.result.point.exact).toBe(craft);
  const insights = await page.request.get(`/api/insights/${handle}`);
  expect(insights.status()).toBe(200);
  expect(await insights.json()).toMatchObject({ policyVersion: "v7.2", identity: profile.identity, craft: profile.craft });
  const svg = await page.request.get(`/u/${handle}/badge.svg?lang=en`);
  expect(svg.status()).toBe(200); const bytes = await svg.text();
  expect(bytes).toMatch(/data-element="score"[^>]*>46<\/text>/);
  expect(bytes.match(/data-axis="/g)?.length).toBe(craft === null ? 4 : 5);
  if (craft !== null) expect(bytes).toContain(`data-axis="craft" data-value="${craft}"`);
  expect(bytes).not.toMatch(/>Builder<|>80<|>83</);
  expect(bytes).toContain(`/verify/v7.${profile.identity.revisionId}.`);
  await page.goto(`/u/${handle}?lang=en`);
  await expect(page.locator('svg[data-badge-design] [data-element="score"]').first()).toHaveText("46");
  await expect(page.locator('svg[data-badge-design] [data-axis="craft"]').first()).toHaveCount(craft === null ? 0 : 1);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __scoringTools: Map<string, unknown> }).__scoringTools.has("get_impact_profile"))).toBe(true);
  const tool = await page.evaluate(async () => JSON.parse(String(await (window as unknown as { __scoringTools: Map<string, { execute(input: unknown): unknown }> }).__scoringTools.get("get_impact_profile")!.execute({}))));
  expect(tool).toMatchObject({ policyVersion: "v7.2", displayScore: 46, identity: profile.identity, craft: profile.craft });
  await verifyIdentity(page, profile);
  await servedImage(page);
  await expect(page.getByRole("article", { name: /^Craft/ })).toHaveCount(craft === null ? 0 : 1);
  if (craft !== null) {
    // Upload invalidates the bound stats cache. The public activity must
    // survive the resulting provider replay alongside the unchanged core.
    await expect(page.locator("table.sr-only, .sr-only table")).toHaveCount(1);
    await expect(page.locator("table.sr-only tbody tr, .sr-only table tbody tr")).toHaveCount(91);
    const card = page.getByRole("article", { name: /^Craft/ });
    await card.locator("button[aria-controls]").click();
    await expect(card).toContainText(`Classified outcomes: ${craft === 57 ? 8 : 10} of 10 sessions.`);
    await expect(card).toContainText(`${craft === 57 ? 5.7 : 0} / 10 × 100 = ${craft}`);
  }
  const info = page.getByRole("article").first().locator("button[aria-describedby]").first();
  const tooltipId = await info.getAttribute("aria-describedby");
  await info.focus(); await info.press("Enter");
  await expect(page.locator(`[id="${tooltipId}"]`)).toBeVisible();
  await info.press("Escape");
  return profile;
}
async function recordPublicReceipt(page: Page, owner: string, profile: { identity: { revisionId: string; contentHash: string } }, label: string, testInfo: TestInfo) {
  const row = await redesignFixtureClient().from("scoring_v7_receipts").select("public_receipt").eq("id", profile.identity.revisionId).single();
  expect(row.error).toBeNull();
  const envelope = { receipt: row.data!.public_receipt, contentHash: { algorithm: "SHA-256", value: profile.identity.contentHash } };
  await testInfo.attach(`${label}-receipt-envelope.json`, { body: Buffer.from(JSON.stringify(envelope, null, 2)), contentType: "application/json" });
  await page.goto(`/u/${owner}?lang=en`);
  const png = await servedImage(page);
  await testInfo.attach(`${label}-public-og.png`, { body: png.bytes, contentType: "image/png" });
  const link = await page.locator(`a[href*="/verify/v7.${profile.identity.revisionId}."]`).first().getAttribute("href");
  await testInfo.attach(`${label}-public-identity.json`, { body: Buffer.from(JSON.stringify({ owner, receiptId: envelope.receipt.receiptId, revisionId: profile.identity.revisionId, contentHash: profile.identity.contentHash, verificationPath: link ? new URL(link, page.url()).pathname : null }, null, 2)), contentType: "application/json" });
}
async function chooseInsightsReport(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  const importButton = page.getByRole("button", { name: "Import Claude Code Insights", exact: true });
  await expect(importButton).toBeEnabled();
  const chooser = page.waitForEvent("filechooser");
  await importButton.click();
  await (await chooser).setFiles(file);
}
async function upload(page: Page, point: 57 | 0, referenceTime: string) {
  await page.goto("/settings?lang=en");
  const response = page.waitForResponse(r => r.url().endsWith("/api/insights") && r.request().method() === "POST");
  await chooseInsightsReport(page, { name: `report-${point}.html`, mimeType: "text/html", buffer: Buffer.from(scoringReportHtml(point, referenceTime)) });
  let result = await response;
  if (point === 0) expect(result.status()).toBe(409);
  if (result.status() === 409) {
    const replaced = page.waitForResponse(r => r.url().endsWith("/api/insights") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Replace report", exact: true }).click();
    result = await replaced;
  }
  expect(result.status()).toBe(200);
  const body = await result.json();
  expect(body).toMatchObject({ persisted: true, publication: "published", craft: { status: "scored", report: { result: { point: { exact: point } } } } });
  expect(body.refreshed).toBe(true);
  return body;
}

test("real report57 then explicit correction0 preserves one core across surfaces, saves and stays published", async ({ page, context, baseURL }, testInfo) => {
  // This is the longest browser contract: it publishes twice, saves and
  // restores Studio state, verifies two locales and confirms the retired
  // publication-withdrawal action leaves the receipt published.
  // Leave headroom when the full suite is concurrent.
  test.setTimeout(240_000);
  assertScoringFixtureEnvironment(process.env);
  const owner = `chapa-score-${testInfo.project.name}`;
  const db = redesignFixtureClient();
  await installTools(page);
  await setRedesignSession(context, baseURL!, owner);
  const initial = await currentSurface(page, owner, null);
  const referenceTime = initial.window.referenceTime;
  await recordPublicReceipt(page, owner, initial, "baseline", testInfo);
  const baselineReceipt = await db.from("scoring_v7_receipts").select("public_receipt").eq("id", initial.identity.revisionId).single();
  expect(baselineReceipt.error).toBeNull();
  if (testInfo.project.name === "chromium") {
    await page.goto("/settings?lang=en");
    const html = scoringReportHtml(0, referenceTime).replace("Failed", "Unknown");
    const uploaded = page.waitForResponse(r => r.url().endsWith("/api/insights") && r.request().method() === "POST");
    await chooseInsightsReport(page, { name: "report-insufficient.html", mimeType: "text/html", buffer: Buffer.from(html) });
    const response = await uploaded;
    expect(response.status()).toBe(200);
    expect((await response.json()).craft.status).toBe("insufficient_report_data");
    await page.goto(`/u/${owner}?lang=en`);
    await expect(page.locator('svg[data-badge-design] [data-element="score"]').first()).toHaveText("46");
    await expect(page.locator('svg[data-badge-design] [data-axis="craft"]')).toHaveCount(0);
    const insufficient = await api(page, owner);
    expect(insufficient.craft.status).toBe("insufficient_report_data");
    expect(insufficient.dimensions).not.toHaveProperty("craft");
    await recordPublicReceipt(page, owner, insufficient, "insufficient", testInfo);
  }
  const first = await upload(page, 57, referenceTime);
  const scored = await currentSurface(page, owner, 57, initial);
  await recordPublicReceipt(page, owner, scored, "report57", testInfo);
  expect(scored.identity.revisionId).toBe(first.scoring.identity.revisionId);
  expect(scored.identity.revisionId).not.toBe(initial.identity.revisionId);
  expect(scored.craft.report.result.trace.recognizedSessions).toBe(8);
  await upload(page, 0, referenceTime);
  const zero = await currentSurface(page, owner, 0, initial);
  await recordPublicReceipt(page, owner, zero, "report0", testInfo);
  const stored = await db.from("scoring_v7_receipts").select("public_receipt").eq("id", zero.identity.revisionId).single();
  expect(stored.error).toBeNull();
  expect(stored.data!.public_receipt.core).toEqual(baselineReceipt.data!.public_receipt.core);
  expect(stored.data!.public_receipt.inputs).toEqual(baselineReceipt.data!.public_receipt.inputs);

  const imageBeforePalette = await servedImage(page);
  const configBefore = await db.from("studio_configs").select("config").eq("handle", owner).single();
  expect(configBefore.error).toBeNull();
  try {
    await page.goto("/studio?lang=en");
    await expect(studioBadgePreview(page).locator('[data-element="score"]')).toHaveText("46");
    await expect(studioBadgePreview(page).locator('[data-axis="craft"]')).toHaveAttribute("data-value", "0");
    const input = page.locator("#terminal-command-input");
    await input.fill("/set palette jade"); await input.press("Enter");
    const saved = page.waitForResponse(r => r.url().includes("/api/studio/config") && r.request().method() === "PUT");
    await expect.poll(() => page.evaluate(() => (window as unknown as { __scoringTools: Map<string, unknown> }).__scoringTools.has("save_badge_config"))).toBe(true);
    await page.evaluate(async () => (window as unknown as { __scoringTools: Map<string, { execute(input: unknown): unknown }> }).__scoringTools.get("save_badge_config")!.execute({}));
    await expect(page.getByTestId("agent-save-confirm")).toBeVisible();
    expect((await db.from("studio_configs").select("config").eq("handle", owner).single()).data!.config).toEqual(configBefore.data!.config);
    await page.getByTestId("agent-save-confirm").click(); expect((await saved).status()).toBe(200);
    await expect(studioRoot(page).locator('[data-save-state="saved"]')).toBeVisible();
    await page.getByTestId("studio-zoom-half").click();
    const config = await db.from("studio_configs").select("config").eq("handle", owner).single();
    expect(config.data!.config).toEqual({ ...DEFAULT_BADGE_CONFIG, colorPalette: "jade" });
    await currentSurface(page, owner, 0, initial);
    expect((await servedImage(page)).digest).not.toBe(imageBeforePalette.digest);
    await settlePublicBadge(page);
    await page.screenshot({ path: testInfo.outputPath("scored-zero-saved-palette.png"), fullPage: true });
  } finally {
    await page.goto("/studio?lang=en");
    const input = page.locator("#terminal-command-input");
    await input.fill(`/set palette ${configBefore.data!.config.colorPalette}`); await input.press("Enter");
    const restored = page.waitForResponse(r => r.url().includes("/api/studio/config") && r.request().method() === "PUT");
    await studioControl(page, "studio-save").click(); expect((await restored).status()).toBe(200);
    await currentSurface(page, owner, 0, initial);
    expect((await servedImage(page)).digest).toBe(imageBeforePalette.digest);
  }

  // #1335 phase 5 — the `scoring_v7_rendering` selector this used to flip to
  // roll back to a v6 render is retired; v7.2 is the one rendered policy
  // unconditionally now, so there is no rollback path left to exercise here.
  expect((await api(page, owner)).policyVersion).toBe("v7.2");
  expect((await api(page, owner)).identity.revisionId).toBe(zero.identity.revisionId);
  for (const locale of ["en", "es"]) {
    const svg = await page.request.get(`/u/${owner}/badge.svg?lang=${locale}`);
    expect(await svg.text()).toContain(`v7.${zero.identity.revisionId}.`);
    await page.goto(`/u/${owner}?lang=${locale}`);
    await verifyIdentity(page, zero);
    await servedImage(page);
  }
  const tokenPath = `/verify/v7.${zero.identity.revisionId}.`;
  await page.goto(`/u/${owner}?lang=en`);
  const tokenLink = await page.locator(`a[href*="${tokenPath}"]`).first().getAttribute("href");
  expect(tokenLink).toBeTruthy();
  // Publication consent, and the "Withdraw publication" action that used to
  // depend on it, are retired (#1335 phase 2 -- see the `withdraw` branch in
  // apps/web/app/api/evidence/route.ts): every registered subject publishes
  // with no opt-in, so there is no UI action left to withdraw it. `withdraw`
  // stays a recognized command shape only so it answers a specific
  // retired_action error instead of a generic parse failure; the receipt
  // this test built stays published and its verify link stays resolvable.
  const retiredWithdraw = await page.request.post("/api/evidence", { data: { action: "withdraw", owner } });
  expect(retiredWithdraw.status()).toBe(400);
  expect((await retiredWithdraw.json()).error).toBe("retired_action");
  expect((await page.request.get(`/api${new URL(tokenLink!, baseURL).pathname}`)).status()).toBe(200);
  const remaining = await db.from("scoring_v7_receipts").select("id").eq("owner_handle", owner);
  expect(remaining.error).toBeNull();
  expect(remaining.data!.length).toBeGreaterThan(0);
});

test("expired Craft retains five labels and boundary69.99 fits EN/ES narrow themes", async ({ page, context, baseURL }, testInfo) => {
  assertScoringFixtureEnvironment(process.env);
  await installTools(page);
  for (const owner of ["chapa-score-expired", "chapa-score-boundary"]) await recordPublicReceipt(page, owner, await api(page, owner), owner, testInfo);
  for (const locale of ["en", "es"]) for (const theme of ["light", "dark"] as const) {
    await page.setViewportSize({ width: locale === "es" ? 320 : 390, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.evaluate(value => localStorage.setItem("theme", value), theme);
    await context.addCookies([{ name: "chapa-locale", value: locale, url: baseURL! }]);
    await page.goto(`/u/chapa-score-expired?lang=${locale}`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await settlePublicBadge(page);
    const svg = page.locator("svg[data-badge-design]").first();
    await expect(svg.locator('[data-element="score"]')).toHaveText("46");
    await expect(svg.locator('[data-element="craft"]')).toHaveCount(1);
    await expect(svg.locator('[data-axis="craft"]')).toHaveCount(0);
    await expect(svg.locator('[data-role="radar-incomplete"]')).toHaveCount(1);
    expect((await api(page, "chapa-score-expired")).craft.status).toBe("expired");
    await page.goto(`/u/chapa-score-boundary?lang=${locale}`);
    await expect(page.locator('svg[data-badge-design] [data-element="score"]').first()).toHaveText("69.99");
    await settlePublicBadge(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
    const boundary = await api(page, "chapa-score-boundary");
    expect(boundary).toMatchObject({ displayScore: 69.99, tier: "Solid" });
    await page.screenshot({ path: testInfo.outputPath(`boundary-${locale}-${theme}.png`), fullPage: true });
  }
});

// #1335 phase 4.8 — the durable collection queue end to end: a registered
// owner with a queued job renders "collecting", driving the REAL
// `/api/cron/collect-evidence` worker against a fetch-interception fixture
// (never real GitHub) takes it to a "ready" v7.2 score, and every surface
// agrees on that exact score. Distinct from every other test in this file,
// which seeds a receipt directly and never touches the collection queue.
test("registered owner with a queued job shows collecting, then ready with an identical score everywhere", async ({ page, context, baseURL, request }, testInfo) => {
  test.setTimeout(120_000);
  assertScoringFixtureEnvironment(process.env);
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new Error("CRON_SECRET required to drive the local collection worker");
  const owner = `chapa-collectq-${testInfo.project.name}`;
  const db = redesignFixtureClient();
  const referenceTime = new Date().toISOString();
  await installTools(page);
  await setRedesignSession(context, baseURL!, owner);

  // (a) A queued job with no receipt yet renders "collecting" -- no score,
  // no-store, never the legacy v6 fallback.
  await enqueueGithubJob(db, owner, referenceTime);
  const collectingBadge = await page.request.get(`/u/${owner}/badge.svg?lang=en`);
  expect(collectingBadge.status()).toBe(200);
  const collectingSvg = await collectingBadge.text();
  expect(collectingSvg).toContain('data-chapa-state="collecting"');
  expect(collectingSvg).not.toMatch(/data-element="score"/);
  expect(collectingBadge.headers()["cache-control"]).toContain("no-store");
  // The session is authenticated AS `owner` (needed for the Retry action
  // later), so the share page renders the OWNER'S panel here, not a
  // visitor's one-sentence summary -- SharePageScoringStatus.render.test.tsx
  // covers the visitor branch directly.
  await page.goto(`/u/${owner}?lang=en`);
  await expect(page.locator('svg[data-chapa-state="collecting"]').first()).toBeVisible();
  // .first(): the responsive layout keeps both a mobile and a desktop copy
  // of the owner's ScoringStatusPanel heading in the DOM (CSS-hidden, not
  // removed), so this resolves to 2 elements on the mobile project without it.
  await expect(page.getByText("Scoring status").first()).toBeVisible();

  // (b) Drive the real worker -- provider HTTP is replayed from the local
  // fixture server (redesign-upstream.mjs), never real GitHub -- until the
  // job completes. A zero-activity account (no repos/PRs/reviews) completes
  // in a single slice (lib/github/evidence.ts never queues per-item
  // operations with nothing to fan out over).
  let completed = false;
  for (let attempt = 0; attempt < 5 && !completed; attempt++) {
    const tick = await request.get("/api/cron/collect-evidence", { headers: { Authorization: `Bearer ${cronSecret}` } });
    expect(tick.status()).toBe(200);
    const job = await db.from("scoring_collection_jobs").select("state").eq("owner_handle", owner).eq("provider", "github").single();
    expect(job.error).toBeNull();
    completed = job.data!.state === "complete";
  }
  expect(completed).toBe(true);

  // The owner then shows ready with an identical v7.2 score everywhere.
  await expect.poll(async () => (await api(page, owner)).policyVersion, { timeout: 15_000 }).toBe("v7.2");
  const profile = await api(page, owner);
  expect(profile.archetype).toBeNull(); // Zero activity earns no archetype.

  const badge = await page.request.get(`/u/${owner}/badge.svg?lang=en`);
  expect(badge.status()).toBe(200);
  const badgeSvg = await badge.text();
  expect(badgeSvg).not.toContain("data-chapa-state=\"collecting\"");
  expect(badgeSvg).not.toContain("data-chapa-state=\"unavailable\"");
  expect(badgeSvg).toMatch(new RegExp(`data-element="score"[^>]*>${profile.displayScore}</text>`));

  // #1335 phase 4.8 — this is the first navigation to /u/:handle to reach
  // page.tsx's normal Promise.all([session, materialization, trendData,
  // webmcpEnabled, cachedSvg]) branch for this owner (the earlier "collecting"
  // visit above returns early through the status-placeholder branch, which
  // never calls isWebmcpEnabled()). The App Router streams app/u/[handle]/
  // loading.tsx's Suspense fallback ("Building the badge") first, then
  // replaces it once this Promise.all settles -- give that settle its own
  // generous poll rather than re-navigating (a fresh navigation just
  // restarts the same stream and can race the fallback again).
  await page.goto(`/u/${owner}?lang=en`);
  await expect(page.locator('svg[data-badge-design] [data-element="score"]').first()).toHaveText(String(profile.displayScore), { timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __scoringTools: Map<string, unknown> }).__scoringTools.has("get_impact_profile")), { timeout: 15_000 }).toBe(true);
  const tool = await page.evaluate(async () => JSON.parse(String(await (window as unknown as { __scoringTools: Map<string, { execute(input: unknown): unknown }> }).__scoringTools.get("get_impact_profile")!.execute({}))));
  expect(tool).toMatchObject({ policyVersion: "v7.2", displayScore: profile.displayScore, identity: profile.identity });

  const history = await page.request.get(`/api/history/${owner}?include=snapshots`);
  expect(history.status()).toBe(200);
  const historyBody = await history.json();
  expect(historyBody.policyVersion).toBe("v7.2");
  expect(historyBody.snapshots).toHaveLength(1);
  expect(historyBody.snapshots[0].composite).toMatchObject({ exact: profile.exactScore, display: profile.displayScore });

  await verifyIdentity(page, profile);
});

// #1335 phase 4.8 — a terminally-failed job (seeded directly -- the actual
// failure paths are exercised by lib/collection/worker.test.ts's unit suite,
// not this browser spec) shows the owner a reason and a working Retry action.
test("a failed collection job shows the reason and a Retry action to the owner", async ({ page, context, baseURL }, testInfo) => {
  assertScoringFixtureEnvironment(process.env);
  const owner = `chapa-collectq-failed-${testInfo.project.name}`;
  const db = redesignFixtureClient();
  const referenceTime = new Date().toISOString();
  await setRedesignSession(context, baseURL!, owner);
  await seedFailedGithubJob(db, owner, referenceTime, { provider: "github", operation: "profile", stopKind: "http", httpStatus: 500, retryAfterSeconds: null });

  const badge = await page.request.get(`/u/${owner}/badge.svg?lang=en`);
  expect(badge.status()).toBe(200);
  const svg = await badge.text();
  expect(svg).toContain('data-chapa-state="action_needed"');
  expect(svg).toContain("Scoring paused: action needed");
  expect(badge.headers()["cache-control"]).toContain("no-store");

  await page.goto("/settings?lang=en");
  await expect(page.getByText("Scoring paused: action needed")).toBeVisible();
  await expect(page.getByText("We were alerted; you can retry.")).toBeVisible();
  const retryButton = page.getByRole("button", { name: "Retry", exact: true });
  await expect(retryButton).toBeVisible();
  const retried = page.waitForResponse((r) => r.url().endsWith("/api/scoring/status") && r.request().method() === "POST");
  await retryButton.click();
  expect((await retried).status()).toBe(200);
  // POST /api/scoring/status re-enqueues (state -> "queued") and then calls
  // scheduleCollectionAdvance() to run a bounded slice in the background
  // immediately, rather than waiting for the next cron tick. Against this
  // zero-activity fixture that background slice can complete before this
  // poll's first read, racing straight through "queued" to "complete" --
  // the retry succeeded either way, so assert only that it left "failed".
  await expect
    .poll(async () => (await db.from("scoring_collection_jobs").select("state").eq("owner_handle", owner).eq("provider", "github").single()).data?.state)
    .not.toBe("failed");
});
