import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getSessionSecret,
  getSessionKey,
  getOptionalRequestSession,
  getOptionalServerSessionFromHeaders,
  requireRequestSession,
} from "./session";

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: vi.fn(),
}));

import { readSessionCookie } from "@/lib/auth/github";

const mockReadSessionCookie = vi.mocked(readSessionCookie);

function makeRequest(cookie?: string): Request {
  return new Request("http://localhost:3001/api/test", {
    headers: cookie ? { cookie } : {},
  });
}

function makeHeaderStore(cookie?: string): { get(name: string): string | null } {
  return {
    get(name: string) {
      return name === "cookie" ? cookie ?? null : null;
    },
  };
}

describe("session helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("getOptionalRequestSession", () => {
    it("treats a short NEXTAUTH_SECRET as misconfigured", () => {
      vi.stubEnv("NEXTAUTH_SECRET", "short");

      expect(() =>
        getOptionalRequestSession(makeRequest("chapa_session=test")),
      ).toThrow(/at least 32 chars/i);
      expect(mockReadSessionCookie).not.toHaveBeenCalled();
    });

    it("returns null when NEXTAUTH_SECRET is missing", () => {
      vi.stubEnv("NEXTAUTH_SECRET", undefined);

      const result = getOptionalRequestSession(makeRequest("chapa_session=test"));

      expect(result).toBeNull();
      expect(mockReadSessionCookie).not.toHaveBeenCalled();
    });

    it("passes the cookie header and trimmed secret to readSessionCookie", () => {
      vi.stubEnv("NEXTAUTH_SECRET", "  12345678901234567890123456789012  ");
      mockReadSessionCookie.mockReturnValue(null);

      getOptionalRequestSession(makeRequest("chapa_session=some-value"));

      expect(mockReadSessionCookie).toHaveBeenCalledWith(
        "chapa_session=some-value",
        "12345678901234567890123456789012",
      );
    });
  });

  describe("getSessionKey", () => {
    it("getSessionSecret also enforces the production minimum length", () => {
      vi.stubEnv("NEXTAUTH_SECRET", "short");

      expect(() => getSessionSecret()).toThrow(/at least 32 chars/i);
    });

    it("throws when NEXTAUTH_SECRET is shorter than 32 chars", () => {
      vi.stubEnv("NEXTAUTH_SECRET", "short");

      expect(() => getSessionKey()).toThrow(/at least 32 chars/i);
    });

    it("returns a buffer when NEXTAUTH_SECRET is long enough", () => {
      vi.stubEnv("NEXTAUTH_SECRET", "12345678901234567890123456789012");

      expect(getSessionKey()).toEqual(
        Buffer.from("12345678901234567890123456789012", "utf8"),
      );
    });
  });

  describe("getOptionalServerSessionFromHeaders", () => {
    it("reads the cookie header from the header store", () => {
      vi.stubEnv("NEXTAUTH_SECRET", "12345678901234567890123456789012");
      mockReadSessionCookie.mockReturnValue({
        login: "juan294",
        name: "Juan",
        avatar_url: "https://avatars.githubusercontent.com/u/123",
      });

      const result = getOptionalServerSessionFromHeaders(
        makeHeaderStore("chapa_session=server-cookie"),
      );

      expect(result?.login).toBe("juan294");
      expect(mockReadSessionCookie).toHaveBeenCalledWith(
        "chapa_session=server-cookie",
        "12345678901234567890123456789012",
      );
    });
  });

  describe("requireRequestSession", () => {
    it("returns 500 when NEXTAUTH_SECRET is missing", async () => {
      vi.stubEnv("NEXTAUTH_SECRET", undefined);

      const result = requireRequestSession(makeRequest());

      expect(result.session).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(500);
      await expect(result.error!.json()).resolves.toEqual({
        error: "Server misconfigured",
      });
    });
    it("returns 401 when the session is invalid", async () => {
      vi.stubEnv("NEXTAUTH_SECRET", "12345678901234567890123456789012");
      mockReadSessionCookie.mockReturnValue(null);

      const result = requireRequestSession(makeRequest("chapa_session=bad"));

      expect(result.session).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.status).toBe(401);
      await expect(result.error!.json()).resolves.toEqual({
        error: "Authentication required",
      });
    });

    it("returns the session payload when the session is valid", () => {
      vi.stubEnv("NEXTAUTH_SECRET", "12345678901234567890123456789012");
      mockReadSessionCookie.mockReturnValue({
        login: "juan294",
        name: "Juan",
        avatar_url: "https://avatars.githubusercontent.com/u/123",
      });

      const result = requireRequestSession(makeRequest("chapa_session=valid"));

      expect(result.error).toBeUndefined();
      expect(result.session).toEqual({
        login: "juan294",
        name: "Juan",
        avatar_url: "https://avatars.githubusercontent.com/u/123",
      });
    });
  });
});
