/**
 * Device authorization flow for Chapa CLI.
 *
 * 1. Generate a session ID (UUID)
 * 2. Open browser to the Chapa authorize page
 * 3. Poll the server until the user approves
 * 4. Save the token locally
 */

import { randomUUID } from "node:crypto";
import { exec } from "node:child_process";
import { saveConfig } from "./config.js";

export const POLL_INTERVAL_MS = 2000;
export const MAX_POLL_ATTEMPTS = 150; // 5 minutes at 2s intervals

function openBrowser(url: string): void {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {
    // Ignore errors — user can open manually
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PollResponse {
  status: "pending" | "approved" | "expired";
  token?: string;
  handle?: string;
}

export async function login(serverUrl: string): Promise<void> {
  const baseUrl = serverUrl.replace(/\/+$/, "");
  const sessionId = randomUUID();
  const authorizeUrl = `${baseUrl}/cli/authorize?session=${sessionId}`;

  console.log("Opening browser for authentication...");
  console.log(`If your browser didn't open, visit:\n  ${authorizeUrl}\n`);
  openBrowser(authorizeUrl);

  console.log("Waiting for approval...");

  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await sleep(POLL_INTERVAL_MS);

    let data: PollResponse | null = null;
    try {
      const res = await fetch(
        `${baseUrl}/api/cli/auth/poll?session=${sessionId}`,
      );
      if (!res.ok) continue;
      data = await res.json();
    } catch {
      // Network error — keep trying
      continue;
    }

    if (data?.status === "approved" && data.token && data.handle) {
      saveConfig({
        token: data.token,
        handle: data.handle,
        server: baseUrl,
      });
      console.log(`\nLogged in as ${data.handle}!`);
      console.log("Credentials saved to ~/.chapa/credentials.json");
      return;
    }

    if (data?.status === "expired") {
      console.error("\nSession expired. Please try again.");
      process.exit(1);
    }
  }

  console.error("\nTimed out waiting for approval. Please try again.");
  process.exit(1);
}
