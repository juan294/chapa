import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
const mockSaveConfig = vi.hoisted(() => vi.fn());

vi.mock("./config.js", () => ({
  saveConfig: mockSaveConfig,
}));

import { login, POLL_INTERVAL_MS } from "./login";

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function advancePoll() {
    return vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 10);
  }

  it("prints authorize URL and personal account hint to stdout", async () => {
    const logSpy = vi.spyOn(console, "log");
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ status: "approved", token: "tok", handle: "juan294" }),
        { status: 200 },
      ),
    );

    const p = login("https://chapa.thecreativetoken.com");
    await advancePoll();
    await p;

    const allOutput = logSpy.mock.calls.map(c => c.join(" ")).join("\n");
    expect(allOutput).toContain("chapa.thecreativetoken.com/cli/authorize?session=");
    expect(allOutput).toContain("personal GitHub account");
    logSpy.mockRestore();
  });

  it("saves config on successful approval", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ status: "approved", token: "my-cli-token", handle: "alice" }),
        { status: 200 },
      ),
    );

    const p = login("https://example.com");
    await advancePoll();
    await p;

    expect(mockSaveConfig).toHaveBeenCalledWith({
      token: "my-cli-token",
      handle: "alice",
      server: "https://example.com",
    });
  });

  it("strips trailing slashes from server URL", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ status: "approved", token: "t", handle: "h" }),
        { status: 200 },
      ),
    );

    const p = login("https://example.com///");
    await advancePoll();
    await p;

    expect(mockSaveConfig).toHaveBeenCalledWith(
      expect.objectContaining({ server: "https://example.com" }),
    );
  });

  it("polls until approved", async () => {
    let callCount = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return new Response(JSON.stringify({ status: "pending" }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ status: "approved", token: "t", handle: "h" }),
        { status: 200 },
      );
    });

    const p = login("https://example.com");
    await advancePoll(); // poll 1 → pending
    await advancePoll(); // poll 2 → pending
    await advancePoll(); // poll 3 → approved
    await p;

    expect(callCount).toBe(3);
    expect(mockSaveConfig).toHaveBeenCalledOnce();
  });

  it("writes progress dots during polling", async () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    let callCount = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      callCount++;
      if (callCount < 6) {
        return new Response(JSON.stringify({ status: "pending" }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ status: "approved", token: "t", handle: "h" }),
        { status: 200 },
      );
    });

    const p = login("https://example.com");
    for (let i = 0; i < 6; i++) await advancePoll();
    await p;

    const dots = writeSpy.mock.calls.filter(c => c[0] === ".").length;
    expect(dots).toBeGreaterThan(0);
    writeSpy.mockRestore();
  });

  it("logs server error status during polling", async () => {
    const errorSpy = vi.spyOn(console, "error");
    let callCount = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable" }),
          { status: 503 },
        );
      }
      return new Response(
        JSON.stringify({ status: "approved", token: "t", handle: "h" }),
        { status: 200 },
      );
    });

    const p = login("https://example.com");
    await advancePoll(); // poll 1 → 503
    await advancePoll(); // poll 2 → approved
    await p;

    const allErrors = errorSpy.mock.calls.map(c => c.join(" ")).join("\n");
    expect(allErrors).toContain("503");
    errorSpy.mockRestore();
  });

  it("logs each poll response in verbose mode", async () => {
    const errorSpy = vi.spyOn(console, "error");
    let callCount = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return new Response(JSON.stringify({ status: "pending" }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ status: "approved", token: "t", handle: "h" }),
        { status: 200 },
      );
    });

    const p = login("https://example.com", { verbose: true });
    await advancePoll(); // poll 1 → pending
    await advancePoll(); // poll 2 → pending
    await advancePoll(); // poll 3 → approved
    await p;

    const allErrors = errorSpy.mock.calls.map(c => c.join(" ")).join("\n");
    expect(allErrors).toContain("[poll 1]");
    expect(allErrors).toContain("pending");
    expect(allErrors).toContain("[poll 3]");
    expect(allErrors).toContain("approved");
    errorSpy.mockRestore();
  });

  it("logs network errors in verbose mode", async () => {
    const errorSpy = vi.spyOn(console, "error");
    let callCount = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error("fetch failed");
      }
      return new Response(
        JSON.stringify({ status: "approved", token: "t", handle: "h" }),
        { status: 200 },
      );
    });

    const p = login("https://example.com", { verbose: true });
    await advancePoll(); // poll 1 → network error
    await advancePoll(); // poll 2 → approved
    await p;

    const allErrors = errorSpy.mock.calls.map(c => c.join(" ")).join("\n");
    expect(allErrors).toContain("[poll 1]");
    expect(allErrors).toContain("network error");
    errorSpy.mockRestore();
  });

  it("exits with code 1 on expired session", { timeout: 10000 }, async () => {
    vi.useRealTimers(); // Use real timers for this test — fast enough with 2s sleep

    const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "expired" }), { status: 200 }),
    );

    await expect(login("https://example.com")).rejects.toThrow("process.exit");
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });
});
