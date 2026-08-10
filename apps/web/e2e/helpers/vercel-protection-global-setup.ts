import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { request, type FullConfig } from "@playwright/test";
import {
  isCookieScopedToPreview,
  vercelBypassStorageStatePath,
} from "./vercel-protection";

export default async function vercelProtectionGlobalSetup(
  config: FullConfig,
): Promise<() => Promise<void>> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  const baseUrl = config.projects[0]?.use.baseURL;
  if (!secret || typeof baseUrl !== "string") {
    throw new Error("protected preview setup requires a bypass secret and base URL");
  }

  await mkdir(dirname(vercelBypassStorageStatePath), { recursive: true });
  const context = await request.newContext({ baseURL: baseUrl });
  try {
    const response = await context.get("/", {
      headers: {
        "x-vercel-protection-bypass": secret,
        "x-vercel-set-bypass-cookie": "true",
      },
      maxRedirects: 0,
    });
    if (response.status() >= 400) {
      throw new Error(`Vercel bypass setup failed with status ${response.status()}`);
    }

    const state = await context.storageState();
    if (!state.cookies.some((cookie) => isCookieScopedToPreview(cookie, baseUrl))) {
      throw new Error("Vercel bypass setup did not return a preview-scoped cookie");
    }

    const proof = await context.get("/api/version", {
      headers: { accept: "application/json" },
      maxRedirects: 0,
    });
    if (
      proof.status() !== 200 ||
      !proof.headers()["content-type"]?.includes("application/json")
    ) {
      throw new Error(
        `Vercel bypass cookie proof failed with status ${proof.status()}`,
      );
    }

    await writeFile(
      vercelBypassStorageStatePath,
      JSON.stringify(state),
      { mode: 0o600 },
    );
  } catch (error) {
    await unlink(vercelBypassStorageStatePath).catch(() => undefined);
    throw error;
  } finally {
    await context.dispose();
  }

  return async () => {
    await unlink(vercelBypassStorageStatePath).catch(() => undefined);
  };
}
