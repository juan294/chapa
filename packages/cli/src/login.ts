/**
 * Device authorization flow for Chapa CLI.
 *
 * 1. Generate a session ID (UUID)
 * 2. Display authorize URL for user to open in their personal browser
 * 3. Poll the server until the user approves
 * 4. Save the token locally
 */

import { randomUUID } from "node:crypto";
import { saveConfig } from "./config.js";

export const POLL_INTERVAL_MS = 2000;
export const MAX_POLL_ATTEMPTS = 150; // 5 minutes at 2s intervals

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

  console.log("\nOpen this URL in a browser where your personal GitHub account is logged in:");
  console.log(`\n  ${authorizeUrl}\n`);
  console.log("Tip: If your default browser has your work (EMU) account,");
  console.log("     use a different browser or an incognito/private window.\n");
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
