/**
 * Shared admin auth test helpers for campaign route tests.
 *
 * The `vi.mock()` declarations MUST stay in each test file (vitest only
 * hoists `vi.mock` calls that appear directly in the test module). This
 * helper extracts the repetitive `beforeEach` setup that configures a
 * valid admin session, and re-exports the mocked symbols for convenience.
 *
 * Usage:
 *
 *   // 1. Keep vi.mock() calls in the test file (vitest hoists these)
 *   vi.mock("@/lib/auth/github", () => ({ readSessionCookie: vi.fn() }));
 *   vi.mock("@/lib/auth/admin", () => ({ isAdminHandle: vi.fn() }));
 *   vi.mock("@/lib/cache/redis", () => ({
 *     rateLimit: vi.fn().mockResolvedValue({ allowed: true, current: 1, limit: 10 }),
 *   }));
 *   vi.mock("@/lib/http/client-ip", () => ({ getClientIp: () => "127.0.0.1" }));
 *
 *   // 2. Import the helper + re-exported mocks
 *   import { adminAuthBeforeEach, readSessionCookie, isAdminHandle } from "@/lib/test-helpers/admin-auth";
 *
 *   // 3. Use in beforeEach
 *   beforeEach(() => { adminAuthBeforeEach(); });
 */

import { vi } from "vitest";
import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
// Re-export so test files can import everything from one place
export { readSessionCookie, isAdminHandle };

/**
 * Standard `beforeEach` body: clear mocks, set `NEXTAUTH_SECRET`, and
 * configure a valid admin session (`readSessionCookie` returns a session,
 * `isAdminHandle` returns true).
 */
export function adminAuthBeforeEach(): void {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret-32-characters-valid-ok");
  vi.mocked(readSessionCookie).mockReturnValue({
    token: "t",
    login: "admin",
    name: "Admin",
    avatar_url: "",
  });
  vi.mocked(isAdminHandle).mockReturnValue(true);
}
