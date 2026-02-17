import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCreateClient = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { getSupabase, pingSupabase, _resetClient } from "./supabase";

beforeEach(() => {
  vi.clearAllMocks();
  _resetClient();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getSupabase", () => {
  it("returns null when SUPABASE_URL is missing", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-key");

    expect(getSupabase()).toBeNull();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("logs a warning when env vars are missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    getSupabase();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("SUPABASE_URL"),
    );
    warnSpy.mockRestore();
  });

  it("returns null when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    expect(getSupabase()).toBeNull();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("creates a client with trimmed env vars", () => {
    const fakeClient = { from: vi.fn() };
    mockCreateClient.mockReturnValue(fakeClient);

    vi.stubEnv("SUPABASE_URL", "  https://test.supabase.co  ");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "  sk-test-key  ");

    const client = getSupabase();

    expect(client).toBe(fakeClient);
    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "sk-test-key",
      { auth: { persistSession: false } },
    );
  });

  it("returns the same singleton on subsequent calls", () => {
    const fakeClient = { from: vi.fn() };
    mockCreateClient.mockReturnValue(fakeClient);

    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sk-test-key");

    const first = getSupabase();
    const second = getSupabase();

    expect(first).toBe(second);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
  });

  it("reinitializes after _resetClient()", () => {
    const fakeClient = { from: vi.fn() };
    mockCreateClient.mockReturnValue(fakeClient);

    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sk-test-key");

    getSupabase();
    _resetClient();
    getSupabase();

    expect(mockCreateClient).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// pingSupabase
// ---------------------------------------------------------------------------

describe("pingSupabase", () => {
  it("returns 'ok' when query succeeds", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ error: null }),
    });
    mockCreateClient.mockReturnValue({ from: () => ({ select: mockSelect }) });

    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sk-test-key");

    const result = await pingSupabase();
    expect(result).toBe("ok");
  });

  it("returns 'unavailable' when env vars are missing", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    const result = await pingSupabase();
    expect(result).toBe("unavailable");
  });

  it("returns 'error' when query fails", async () => {
    const mockSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ error: new Error("DB down") }),
    });
    mockCreateClient.mockReturnValue({ from: () => ({ select: mockSelect }) });

    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sk-test-key");

    const result = await pingSupabase();
    expect(result).toBe("error");
  });
});
