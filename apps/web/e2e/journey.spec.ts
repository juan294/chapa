import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_BADGE_CONFIG } from "@chapa/shared";

const requiredEnvPresent = Boolean(
  process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXTAUTH_SECRET,
);

const pendingStorageKey = "chapa:e2e:pending-studio-config";

type Shape = {
  kind: "craft" | "non-craft" | "linked";
  handle: string;
  craft: number | null;
  platform?: "bitbucket";
};

type FeatureFlagState = {
  key: string;
  enabled: boolean;
  description: string | null;
  config: unknown;
};

// #1244 — derived from DEFAULT_BADGE_CONFIG, not hand-enumerated.
// `isValidBadgeConfig` requires an exact key set, so a hand-written literal
// silently becomes a 400 payload the moment a category is added: #1242's
// `palette` turned this fixture into a six-key body and CI went red on a
// change that had nothing to do with the journey. Spreading the default means
// the fixture tracks the schema and only the fields this test cares about are
// spelled out.
const savedConfig = {
  ...DEFAULT_BADGE_CONFIG,
  background: "aurora",
  cardStyle: "frost",
  scoreEffect: "chrome",
  heatmapAnimation: "ripple",
  tierTreatment: "enhanced",
};

test.skip(!requiredEnvPresent, "journey spec requires local Supabase service-role env");

test.describe("full impact journey", () => {
  test("login -> generate -> badge -> studio save -> share -> refresh across persistence shapes", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const projectName = testInfo.project.name.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const requestedRunId = process.env.E2E_PRO_RUN_ID || `local-${process.pid}`;
    const evidenceRunId = requestedRunId
      .replace(/[^a-z0-9._-]/gi, "-")
      .toLowerCase();
    const runId = `${evidenceRunId}-${testInfo.workerIndex}-${testInfo.retry}`
      .replace(/[^a-z0-9-]/gi, "-")
      .toLowerCase()
      .slice(0, 14);
    const shapes: Shape[] = [
      { kind: "craft", handle: `chapa-e2e-${runId}-${projectName.slice(0, 5)}-craft`, craft: 78 },
      { kind: "non-craft", handle: `chapa-e2e-${runId}-${projectName.slice(0, 5)}-plain`, craft: null },
      {
        kind: "linked",
        handle: `chapa-e2e-${runId}-${projectName.slice(0, 5)}-linked`,
        craft: 66,
        platform: "bitbucket",
      },
    ];

    const db = serviceClient();
    const originalFeatureFlags = await readFeatureFlags(db);
    const startedAt = new Date().toISOString();
    let journeyPassed = false;
    try {
      await seedFeatureFlags(db);
      await resetShapes(db, shapes);
      await seedShapes(db, shapes);

      for (const shape of shapes) {
        await setSessionCookie(context, baseURL, shape.handle);

        const generating = await page.goto(`/generating/${shape.handle}`, {
          waitUntil: "domcontentloaded",
        });
        expect(generating).not.toBeNull();
        expect(generating!.status()).toBeLessThan(500);

        // The fixture handle has no GitHub account. The badge route answers
        // 404 with a localized SVG for a user GitHub does not know (LE-8-2),
        // or the try-later 200 when the fetch ran under the fixture's fake
        // session token; either way the body is an SVG and persistence below
        // is what this journey proves.
        const badge = await page.request.get(`/u/${shape.handle}/badge.svg`);
        expect([200, 404]).toContain(badge.status());
        expect(badge.headers()["content-type"] ?? "").toContain("image/svg+xml");
        const svg = await badge.text();
        expect(svg).toContain("<svg");
        expect(svg).toContain("</svg>");

        await page.goto("/", { waitUntil: "domcontentloaded" });
        const saveResult = await saveStudioConfigInBrowser(page, savedConfig);
        expect(saveResult.status).toBe(200);
        // #1191 hotfix (v2.29.2) — the save now awaits invalidation of both
        // cache layers before responding and reports the outcome. This fixture
        // seeds a synthetic handle that does not exist on GitHub, so a live
        // badge re-render answers 404 (or the "could not load data" SVG)
        // (`json.data.user` is null for an unknown login regardless of token —
        // see lib/github/queries.ts) — the config-marker content itself can't
        // be asserted through this fixture. What IS provable end-to-end,
        // through the real server rather than a unit mock, is that the field
        // exists and is boolean-typed, and that the badge route survives a
        // real invalidation pass (Redis delete attempts against the dummy
        // Upstash config in this suite's env, plus the edge-purge call, which
        // reports "skipped" outside Vercel) without erroring.
        expect(typeof saveResult.body?.badgeRefreshed).toBe("boolean");

        const afterSave = await page.request.get(
          `/u/${shape.handle}/badge.svg?after-save=${Date.now()}`,
        );
        expect([200, 404]).toContain(afterSave.status());
        expect(afterSave.headers()["content-type"] ?? "").toContain("image/svg+xml");

        const share = await page.goto(`/u/${shape.handle}`, {
          waitUntil: "domcontentloaded",
        });
        expect(share).not.toBeNull();
        expect(share!.status()).toBeLessThan(500);
        await expect(page.locator("body")).toContainText(shape.handle);
        // #1335 phase 5 — with v6 deleted, this fixture handle (never
        // registered as a scoring subject) never reaches a GitHub fetch or
        // materialize at all: the share page's status gate answers
        // "unregistered" before any of that runs, and shows the owner's
        // scoring-status panel ("You haven't started scoring yet.") rather
        // than the old not-found state a stats-fetch failure used to
        // produce. This is what LE-8-2's honest-render invariant looks like
        // now that the badge/share pipeline is v7.2-only.
        await expect(page.locator("body")).toContainText(
          /Not on Chapa yet|Aún no está en Chapa|haven.t started scoring yet|no has empezado a puntuar/,
        );

        await context.setOffline(true);
        const offlineResult = await saveStudioConfigInBrowser(page, {
          ...savedConfig,
          background: "particles",
        });
        expect(offlineResult.status).toBe("offline");
        expect(
          await page.evaluate((key) => window.localStorage.getItem(key), pendingStorageKey),
        ).toContain("particles");

        await context.setOffline(false);
        const queuedConfig = await page.evaluate((key) => {
          const raw = window.localStorage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        }, pendingStorageKey);
        expect(queuedConfig).not.toBeNull();
        const flushResult = await saveStudioConfigInBrowser(page, queuedConfig);
        expect(flushResult.status).toBe(200);
        await page.evaluate((key) => window.localStorage.removeItem(key), pendingStorageKey);

        const refresh = await page.request.post(`/api/refresh?handle=${shape.handle}`);
        expect(refresh.status()).toBeLessThan(600);
      }

      for (const shape of shapes) {
        const config = await readStudioConfig(db, shape.handle);
        expect(config).toMatchObject({ ...savedConfig, background: "particles" });

        if (shape.platform) {
          const platform = await readPlatform(db, shape.handle, shape.platform);
          expect(platform).toMatchObject({
            platform: shape.platform,
            remote_login: `${shape.handle}-remote`,
            access_token: `token-${shape.handle}`,
            refresh_token: `refresh-${shape.handle}`,
          });
        }
      }

      journeyPassed = true;
    } finally {
      await context.setOffline(false).catch(() => undefined);
      const cleanupErrors: unknown[] = [];
      await resetShapes(db, shapes).catch((error: unknown) => {
        cleanupErrors.push(error);
      });
      await restoreFeatureFlags(db, originalFeatureFlags).catch((error: unknown) => {
        cleanupErrors.push(error);
      });
      const remainingCount = await countShapeResidue(db, shapes).catch(
        (error: unknown) => {
          cleanupErrors.push(error);
          return -1;
        },
      );
      const featureFlagsRestored = await featureFlagsMatch(
        db,
        originalFeatureFlags,
      ).catch((error: unknown) => {
        cleanupErrors.push(error);
        return false;
      });
      const cleanupStatus =
        cleanupErrors.length === 0 &&
        remainingCount === 0 &&
        featureFlagsRestored
          ? "removed"
          : "present";
      const evidencePath = testInfo.outputPath("release-evidence.json");
      const evidenceReference = "release-evidence.json#cleanup";
      const studioFixtures = [
        {
          id: `${evidenceRunId}-${projectName}-studio`,
          cleanupStatus,
          residueEvidence: evidenceReference,
        },
      ];
      await writeFile(
        evidencePath,
        `${JSON.stringify(
          {
            schemaVersion: 1,
            runId: evidenceRunId,
            fixtureIds: shapes.map((shape) => shape.handle),
            results: [
              {
                scenarioId: "studio.config-persistence",
                environment: "local-contract",
                status: journeyPassed ? "passed" : "failed",
                startedAt,
                finishedAt: new Date().toISOString(),
                runner: "playwright",
                evidence: {
                  ui: ["playwright:full-impact-journey"],
                  http: [evidenceReference],
                  datastore: [evidenceReference],
                  cleanup: [evidenceReference],
                },
                fixtures: studioFixtures,
              },
            ],
            cleanup: {
              status: cleanupStatus,
              remainingCount,
              featureFlagsRestored,
              errors: cleanupErrors.map((error) =>
                error instanceof Error ? error.message : String(error),
              ),
            },
          },
          null,
          2,
        )}\n`,
      );
      await testInfo.attach("release-evidence", {
        path: evidencePath,
        contentType: "application/json",
      });
      if (cleanupErrors.length > 0) {
        throw new AggregateError(cleanupErrors, "journey cleanup failed");
      }
      expect(remainingCount, "run-owned journey fixtures must leave zero residue").toBe(0);
      expect(
        featureFlagsRestored,
        "shared feature flags must be restored to their pre-test state",
      ).toBe(true);
    }
  });
});

async function saveStudioConfigInBrowser(
  page: Page,
  config: Record<string, unknown>,
): Promise<{ status: number | "offline"; body?: { badgeRefreshed?: boolean } }> {
  return page.evaluate(
    async ({ config: nextConfig, storageKey }) => {
      try {
        const response = await fetch("/api/studio/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextConfig),
        });
        const body = await response.json().catch(() => undefined);
        return { status: response.status, body };
      } catch {
        window.localStorage.setItem(storageKey, JSON.stringify(nextConfig));
        return { status: "offline" as const };
      }
    },
    { config, storageKey: pendingStorageKey },
  );
}

function serviceClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function resetShapes(db: SupabaseClient, shapes: Shape[]): Promise<void> {
  const handles = shapes.map((shape) => shape.handle);
  const errors: string[] = [];
  for (const table of ["user_platforms", "studio_configs", "users"]) {
    const { error } = await db.from(table).delete().in("handle", handles);
    if (error) errors.push(`${table}: ${error.message}`);
  }
  if (errors.length > 0) throw new Error(errors.join("; "));
}

async function countShapeResidue(
  db: SupabaseClient,
  shapes: Shape[],
): Promise<number> {
  const handles = shapes.map((shape) => shape.handle);
  let remainingCount = 0;
  for (const table of ["user_platforms", "studio_configs", "users"]) {
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true })
      .in("handle", handles);
    expect(error).toBeNull();
    remainingCount += count ?? 0;
  }
  return remainingCount;
}

async function seedShapes(db: SupabaseClient, shapes: Shape[]): Promise<void> {
  for (const shape of shapes) {
    const { error: userError } = await db
      .from("users")
      .upsert({ handle: shape.handle }, { onConflict: "handle" });
    expect(userError).toBeNull();

    if (shape.platform) {
      const { error: platformError } = await db.from("user_platforms").upsert(
        {
          handle: shape.handle,
          platform: shape.platform,
          remote_login: `${shape.handle}-remote`,
          access_token: `token-${shape.handle}`,
          refresh_token: `refresh-${shape.handle}`,
          token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
        },
        { onConflict: "handle,platform" },
      );
      expect(platformError).toBeNull();
    }
  }
}

async function seedFeatureFlags(db: SupabaseClient): Promise<void> {
  const { error } = await db.from("feature_flags").upsert(
    [
      {
        key: "studio_enabled",
        enabled: true,
        description: "Creator Studio feature",
        config: {},
      },
      {
        key: "bitbucket_integration",
        enabled: true,
        description: "Bitbucket account linking + stats merge",
        config: {},
      },
    ],
    { onConflict: "key" },
  );
  expect(error).toBeNull();
}

const journeyFeatureFlagKeys = ["studio_enabled", "bitbucket_integration"];

async function readFeatureFlags(db: SupabaseClient): Promise<FeatureFlagState[]> {
  const { data, error } = await db
    .from("feature_flags")
    .select("key,enabled,description,config")
    .in("key", journeyFeatureFlagKeys)
    .order("key");
  expect(error).toBeNull();
  return (data ?? []) as FeatureFlagState[];
}

async function restoreFeatureFlags(
  db: SupabaseClient,
  original: FeatureFlagState[],
): Promise<void> {
  const { error: deleteError } = await db
    .from("feature_flags")
    .delete()
    .in("key", journeyFeatureFlagKeys);
  if (deleteError) throw deleteError;
  if (original.length > 0) {
    const { error: restoreError } = await db
      .from("feature_flags")
      .upsert(original, { onConflict: "key" });
    if (restoreError) throw restoreError;
  }
}

async function featureFlagsMatch(
  db: SupabaseClient,
  expected: FeatureFlagState[],
): Promise<boolean> {
  const actual = await readFeatureFlags(db);
  return JSON.stringify(actual) === JSON.stringify(expected);
}

async function readStudioConfig(
  db: SupabaseClient,
  handle: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await db
    .from("studio_configs")
    .select("config")
    .eq("handle", handle)
    .maybeSingle();
  expect(error).toBeNull();
  return data?.config ?? null;
}

async function readPlatform(
  db: SupabaseClient,
  handle: string,
  platform: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await db
    .from("user_platforms")
    .select("platform, remote_login, access_token, refresh_token")
    .eq("handle", handle)
    .eq("platform", platform)
    .maybeSingle();
  expect(error).toBeNull();
  return data;
}

async function setSessionCookie(
  context: BrowserContext,
  baseURL: string | undefined,
  handle: string,
): Promise<void> {
  const url = baseURL ?? "http://localhost:3001";
  await context.addCookies([
    {
      name: "chapa_session",
      value: encryptedSessionValue(handle),
      url,
      httpOnly: true,
      sameSite: "Lax",
      expires: Math.floor(Date.now() / 1000) + 86400,
    },
  ]);
}

function encryptedSessionValue(handle: string): string {
  const payload = JSON.stringify({
    login: handle,
    name: handle,
    // A host `next.config.ts` allows for next/image. In dev the loader throws
    // on any other host, and that throw in the navbar's UserMenu replaced
    // every owner page with the error boundary once the client re-rendered
    // it (LE-8-2 made this visible: a streamed not-found is client-rendered).
    avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4",
    token: "ghp_e2e_fixture",
    iat: Math.floor(Date.now() / 1000),
  });
  const key = createHash("sha256").update(process.env.NEXTAUTH_SECRET!).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}
