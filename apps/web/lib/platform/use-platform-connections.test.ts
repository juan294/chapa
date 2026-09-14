// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({
  bitbucketEnabled: true,
  codebergEnabled: true,
  gitlabEnabled: true,
}));

vi.mock("@/components/ClientFeatureFlagsProvider", () => ({
  useClientFeatureFlags: () => flags,
}));

import {
  clearPlatformStatusCache,
  usePlatformConnections,
} from "./use-platform-connections";

function response(ok: boolean, body: unknown, jsonReject = false) {
  return {
    ok,
    json: jsonReject
      ? vi.fn().mockRejectedValue(new Error("invalid json"))
      : vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function connection(
  rendered: { result: { current: ReturnType<typeof usePlatformConnections> } },
  platform: string,
) {
  return rendered.result.current.connections.find((item) => item.platform === platform)!;
}

beforeEach(() => {
  clearPlatformStatusCache();
  flags.bitbucketEnabled = true;
  flags.codebergEnabled = true;
  flags.gitlabEnabled = true;
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("usePlatformConnections", () => {
  it("loads enabled platform statuses, including GitLab", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const platform = String(input).split("/").at(-2)!;
      return response(true, {
        enabled: true,
        linked: platform !== "codeberg",
        remoteLogin: platform === "gitlab" ? "octo-gl" : platform === "bitbucket" ? "octo-bb" : null,
      });
    });

    const rendered = renderHook(() => usePlatformConnections());

    await waitFor(() => expect(connection(rendered, "gitlab").status).toEqual({
      linked: true,
      remoteLogin: "octo-gl",
    }));
    expect(connection(rendered, "bitbucket").status?.remoteLogin).toBe("octo-bb");
    expect(connection(rendered, "codeberg").status?.linked).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("does not call status endpoints for feature-disabled platforms", async () => {
    flags.bitbucketEnabled = false;
    flags.codebergEnabled = false;
    vi.mocked(fetch).mockResolvedValue(response(true, {
      enabled: true,
      linked: false,
      remoteLogin: null,
    }));

    const rendered = renderHook(() => usePlatformConnections());

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith("/api/auth/gitlab/status");
    expect(connection(rendered, "bitbucket").enabled).toBe(false);
  });

  it("keeps status null when the server disables an integration", async () => {
    vi.mocked(fetch).mockResolvedValue(response(true, {
      enabled: false,
      linked: true,
      remoteLogin: "hidden",
    }));

    const rendered = renderHook(() => usePlatformConnections());

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(rendered.result.current.connections.every((item) => item.status === null)).toBe(true);
  });

  it("gracefully handles status request and JSON failures", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).includes("bitbucket")) throw new Error("offline");
      if (String(input).includes("codeberg")) return response(true, {}, true);
      return response(true, { enabled: true, linked: false, remoteLogin: null });
    });

    const rendered = renderHook(() => usePlatformConnections());

    await waitFor(() => expect(connection(rendered, "gitlab").status?.linked).toBe(false));
    expect(connection(rendered, "bitbucket").status).toBeNull();
    expect(connection(rendered, "codeberg").status).toBeNull();
  });

  it("deduplicates pending status requests across concurrent mounts", async () => {
    let resolve!: (value: Response) => void;
    const pending = new Promise<Response>((done) => { resolve = done; });
    vi.mocked(fetch).mockReturnValue(pending);

    const first = renderHook(() => usePlatformConnections());
    const second = renderHook(() => usePlatformConnections());
    expect(fetch).toHaveBeenCalledTimes(3);

    resolve(response(true, { enabled: true, linked: false, remoteLogin: null }));
    await waitFor(() => expect(connection(first, "gitlab").status?.linked).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(connection(second, "gitlab").status?.linked).toBe(false);
  });

  it("marks GitLab as unlinking and clears its linked state after success", async () => {
    flags.bitbucketEnabled = false;
    flags.codebergEnabled = false;
    vi.mocked(fetch).mockResolvedValueOnce(response(true, {
      enabled: true,
      linked: true,
      remoteLogin: "octo-gl",
    }));
    const rendered = renderHook(() => usePlatformConnections());
    await waitFor(() => expect(connection(rendered, "gitlab").status?.linked).toBe(true));

    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    let unlinkPromise!: Promise<boolean>;
    act(() => { unlinkPromise = rendered.result.current.unlink("gitlab"); });
    expect(connection(rendered, "gitlab").unlinking).toBe(true);

    await act(async () => resolve(response(true, { success: true })));
    await expect(unlinkPromise).resolves.toBe(true);
    expect(fetch).toHaveBeenLastCalledWith("/api/auth/gitlab/disconnect", { method: "POST" });
    expect(connection(rendered, "gitlab").status).toEqual({ linked: false, remoteLogin: null });
    expect(connection(rendered, "gitlab").unlinking).toBe(false);
  });

  it.each([
    ["permission response", () => Promise.resolve(response(false, { error: "forbidden" }))],
    ["success false", () => Promise.resolve(response(true, { success: false }))],
    ["invalid JSON", () => Promise.resolve(response(false, {}, true))],
    ["network failure", () => Promise.reject(new Error("offline"))],
  ])("returns false and clears unlinking after a %s", async (_name, nextResponse) => {
    flags.bitbucketEnabled = false;
    flags.codebergEnabled = false;
    flags.gitlabEnabled = false;
    vi.mocked(fetch).mockImplementationOnce(nextResponse);
    const rendered = renderHook(() => usePlatformConnections());

    let succeeded = true;
    await act(async () => { succeeded = await rendered.result.current.unlink("gitlab"); });

    expect(succeeded).toBe(false);
    expect(connection(rendered, "gitlab").unlinking).toBe(false);
    expect(connection(rendered, "gitlab").status).toBeNull();
  });
});
