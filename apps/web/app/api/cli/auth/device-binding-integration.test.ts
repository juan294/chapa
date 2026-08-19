import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// BE-H3 / SE-H1 (#1078, #1097): regression test for the real approve -> poll
// sequence. Every prior test constructed the cached session object by hand,
// which is exactly why the bug (approve blindly overwriting the session and
// dropping deviceCode/deviceCodeConfirmed) went unnoticed. This test drives
// BOTH real route handlers against a shared in-memory Redis fake so the
// approve route's actual read/write behavior is what's under test.
// ---------------------------------------------------------------------------

const { store, approvedWriteGate } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  approvedWriteGate: {
    beforeWrite: null as null | (() => Promise<void>),
    started: null as null | (() => void),
  },
}));

async function waitBeforeApprovedWrite(value: unknown): Promise<void> {
  const session = value as { status?: string };
  if (session.status !== "approved" || !approvedWriteGate.beforeWrite) return;
  approvedWriteGate.started?.();
  await approvedWriteGate.beforeWrite();
}

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: vi.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
  cacheSet: vi.fn(async (key: string, value: unknown) => {
    await waitBeforeApprovedWrite(value);
    store.set(key, value);
    return true;
  }),
  cacheMergeJson: vi.fn(async (key: string, patch: Record<string, unknown>) => {
    await waitBeforeApprovedWrite(patch);
    const existing = (store.get(key) as Record<string, unknown> | undefined) ?? {};
    store.set(key, { ...existing, ...patch });
    return true;
  }),
  cacheDel: vi.fn(async (key: string) => {
    store.delete(key);
  }),
  rateLimit: vi.fn(async () => ({ allowed: true, current: 1, limit: 1000 })),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn(() => ({
    session: { login: "octocat", name: "Octocat", avatar_url: "" },
  })),
}));

vi.mock("@/lib/http/client-ip", () => ({
  NO_TRUSTED_IP: "unknown",
  getClientIp: (req: Request) =>
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
}));

import { GET as pollGET } from "./poll/route";
import { POST as approvePOST } from "./approve/route";

const SESSION_ID = "1feae8e3-6bc0-47da-84aa-0e24e2510454";

function pollRequest(deviceCode?: string): NextRequest {
  const url = new URL("https://chapa.thecreativetoken.com/api/cli/auth/poll");
  url.searchParams.set("session", SESSION_ID);
  if (deviceCode !== undefined) url.searchParams.set("device_code", deviceCode);
  return new NextRequest(url.toString());
}

function approveRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/cli/auth/approve",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "chapa_session=valid",
      },
      body: JSON.stringify({ sessionId: SESSION_ID }),
    },
  );
}

beforeEach(() => {
  store.clear();
  approvedWriteGate.beforeWrite = null;
  approvedWriteGate.started = null;
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret-32-characters-valid-ok");
});

describe("CLI device-code binding survives approval (#1078, #1097)", () => {
  it("keeps device_code enforcement after approval — redeeming poll without the code is rejected", async () => {
    // 1. First poll — real route creates the session and mints a device_code.
    const first = await pollGET(pollRequest());
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.status).toBe("pending");
    const deviceCode: string = firstBody.device_code;
    expect(typeof deviceCode).toBe("string");

    // 2. Second poll — the CLI echoes the device_code back, confirming the session.
    const confirm = await pollGET(pollRequest(deviceCode));
    expect(confirm.status).toBe(200);
    expect((await confirm.json()).status).toBe("pending");

    // 3. The REAL approve handler approves the session (not a hand-built object).
    const approve = await approvePOST(approveRequest());
    expect(approve.status).toBe(200);

    // 4. The redeeming poll WITHOUT device_code must still be rejected — the
    // binding must survive approval, not be silently dropped by a blind
    // Redis overwrite in the approve route.
    const redeemWithoutCode = await pollGET(pollRequest());
    expect(redeemWithoutCode.status).toBe(401);
    const redeemBody = await redeemWithoutCode.json();
    expect(redeemBody.error).toMatch(/device_code/i);
    expect(redeemBody.token).toBeUndefined();
  });

  it("issues a token on the redeeming poll when the correct device_code is presented after approval", async () => {
    const first = await pollGET(pollRequest());
    const deviceCode: string = (await first.json()).device_code;

    await pollGET(pollRequest(deviceCode)); // confirm
    const approve = await approvePOST(approveRequest()); // approve via real handler
    expect(approve.status).toBe(200);

    const redeem = await pollGET(pollRequest(deviceCode));
    expect(redeem.status).toBe(200);
    const body = await redeem.json();
    expect(body.status).toBe("approved");
    expect(typeof body.token).toBe("string");
    expect(body.handle).toBe("octocat");
  });

  it("atomically preserves confirmation when approval and confirmation overlap", async () => {
    const first = await pollGET(pollRequest());
    const deviceCode: string = (await first.json()).device_code;

    let releaseApprovedWrite!: () => void;
    const approvedWriteCanFinish = new Promise<void>((resolve) => {
      releaseApprovedWrite = resolve;
    });
    let markApprovedWriteStarted!: () => void;
    const approvedWriteStarted = new Promise<void>((resolve) => {
      markApprovedWriteStarted = resolve;
    });
    approvedWriteGate.beforeWrite = () => approvedWriteCanFinish;
    approvedWriteGate.started = markApprovedWriteStarted;

    const approvalPromise = approvePOST(approveRequest());
    await approvedWriteStarted;

    const confirmation = await pollGET(pollRequest(deviceCode));
    expect(confirmation.status).toBe(200);

    releaseApprovedWrite();
    expect((await approvalPromise).status).toBe(200);

    expect(store.get(`cli:device:${SESSION_ID}`)).toEqual(
      expect.objectContaining({
        status: "approved",
        handle: "octocat",
        deviceCode,
        deviceCodeConfirmed: true,
      }),
    );
  });

  it("legacy flow (device_code offered but never confirmed) still works via sessionId only after approval", async () => {
    // First poll offers a device_code, but the (legacy) client never echoes it
    // back, so the session is never confirmed.
    await pollGET(pollRequest());

    const approve = await approvePOST(approveRequest());
    expect(approve.status).toBe(200);

    const redeem = await pollGET(pollRequest());
    expect(redeem.status).toBe(200);
    const body = await redeem.json();
    expect(body.status).toBe("approved");
    expect(typeof body.token).toBe("string");
  });
});
