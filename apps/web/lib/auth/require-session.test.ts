import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requireSession } from "./require-session";

// Mock readSessionCookie from the same auth module
vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: vi.fn(),
}));

import { readSessionCookie } from "@/lib/auth/github";

const mockReadSession = vi.mocked(readSessionCookie);

function makeRequest(cookie?: string): Request {
  return new Request("http://localhost:3001/api/test", {
    headers: cookie ? { cookie } : {},
  });
}

describe("requireSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("when NEXTAUTH_SECRET is missing", () => {
    beforeEach(() => {
      delete process.env.NEXTAUTH_SECRET;
    });

    it("returns an error Response with status 500", () => {
      const result = requireSession(makeRequest());
      expect(result.error).toBeDefined();
      expect(result.session).toBeUndefined();
      expect(result.error!.status).toBe(500);
    });

    it("includes 'Server misconfigured' in the response body", async () => {
      const result = requireSession(makeRequest());
      const body = await result.error!.json();
      expect(body.error).toBe("Server misconfigured");
    });
  });

  describe("when NEXTAUTH_SECRET is set but session is invalid", () => {
    beforeEach(() => {
      vi.stubEnv("NEXTAUTH_SECRET", "test-secret-value");
      mockReadSession.mockReturnValue(null);
    });

    it("returns an error Response with status 401", () => {
      const result = requireSession(makeRequest("chapa_session=bad"));
      expect(result.error).toBeDefined();
      expect(result.session).toBeUndefined();
      expect(result.error!.status).toBe(401);
    });

    it("includes 'Authentication required' in the response body", async () => {
      const result = requireSession(makeRequest());
      const body = await result.error!.json();
      expect(body.error).toBe("Authentication required");
    });

    it("passes the cookie header and trimmed secret to readSessionCookie", () => {
      requireSession(makeRequest("chapa_session=some-value"));
      expect(mockReadSession).toHaveBeenCalledWith(
        "chapa_session=some-value",
        "test-secret-value",
      );
    });
  });

  describe("when session is valid", () => {
    const mockSession = {
      token: "ghp_test123",
      login: "juan294",
      name: "Juan",
      avatar_url: "https://avatars.githubusercontent.com/u/123",
    };

    beforeEach(() => {
      vi.stubEnv("NEXTAUTH_SECRET", "test-secret-value");
      mockReadSession.mockReturnValue(mockSession);
    });

    it("returns the session payload with no error", () => {
      const result = requireSession(makeRequest("chapa_session=valid"));
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeUndefined();
    });
  });

  describe("trims NEXTAUTH_SECRET", () => {
    it("trims whitespace from the secret before passing to readSessionCookie", () => {
      vi.stubEnv("NEXTAUTH_SECRET", "  secret-with-spaces  ");
      mockReadSession.mockReturnValue(null);

      requireSession(makeRequest("chapa_session=test"));

      expect(mockReadSession).toHaveBeenCalledWith(
        "chapa_session=test",
        "secret-with-spaces",
      );
    });
  });
});
