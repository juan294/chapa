import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCreateClient = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { getSupabase, _resetClient } from "./supabase";

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
