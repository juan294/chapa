/**
 * Shared test fixtures for platform OAuth route tests (Bitbucket, Codeberg, etc.).
 *
 * These factories produce the mock session, env var helpers, and common test
 * data that every platform's connect/callback/disconnect/status test uses.
 */

import { vi } from "vitest";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Session fixtures
// ---------------------------------------------------------------------------

/**
 * Default session payload used across all platform OAuth tests.
 */
export const TEST_SESSION = {
  login: "testuser",
  token: "gho_test",
  name: "Test User",
  avatar_url: "https://example.com/avatar.png",
} as const;

/**
 * Configure a mock `requireSession` to return a valid session.
 */
export function allowSession(mockRequireSession: ReturnType<typeof import("vitest").vi.fn>) {
  mockRequireSession.mockReturnValue({ session: { ...TEST_SESSION } });
}

/**
 * Configure a mock `requireSession` to return a 401 error.
 */
export function denySession(mockRequireSession: ReturnType<typeof import("vitest").vi.fn>) {
  mockRequireSession.mockReturnValue({
    error: NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    ),
  });
}

// ---------------------------------------------------------------------------
// Rate limit fixtures
// ---------------------------------------------------------------------------

/**
 * Default "allowed" rate limit response.
 */
export const RATE_LIMIT_ALLOWED = { allowed: true, current: 1, limit: 10 } as const;

/**
 * Default "blocked" rate limit response.
 */
export const RATE_LIMIT_BLOCKED = { allowed: false, current: 11, limit: 10 } as const;

/**
 * Status route uses a higher limit (120) — read-only navbar check.
 */
export const RATE_LIMIT_STATUS_ALLOWED = { allowed: true, current: 1, limit: 120 } as const;
export const RATE_LIMIT_STATUS_BLOCKED = { allowed: false, current: 121, limit: 120 } as const;

// ---------------------------------------------------------------------------
// Bitbucket-specific fixtures
// ---------------------------------------------------------------------------

export const BITBUCKET_ENV_VARS = {
  BITBUCKET_CLIENT_ID: "test-bb-client-id",
  BITBUCKET_CLIENT_SECRET: "test-bb-client-secret",
  NEXT_PUBLIC_BASE_URL: "https://chapa.thecreativetoken.com",
} as const;

export const BITBUCKET_TOKEN_RESPONSE = {
  access_token: "bb_access_123",
  refresh_token: "bb_refresh_456",
  expires_in: 7200,
  token_type: "bearer" as const,
  scopes: "account repository",
};

export const BITBUCKET_USER = {
  username: "bb-user",
  display_name: "BB User",
  links: { avatar: { href: "https://example.com/avatar.png" } },
};

export const BITBUCKET_STATE_COOKIE = {
  state: "random-csrf-state",
  cookie: "chapa_bb_oauth_state=random-csrf-state; HttpOnly; SameSite=Lax; Path=/; Max-Age=600",
};

export const BITBUCKET_AUTH_URL =
  "https://bitbucket.org/site/oauth2/authorize?client_id=test-bb-client-id&state=random-csrf-state";

export const BITBUCKET_CLEAR_COOKIE =
  "chapa_bb_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";

// ---------------------------------------------------------------------------
// Codeberg-specific fixtures
// ---------------------------------------------------------------------------

export const CODEBERG_ENV_VARS = {
  CODEBERG_CLIENT_ID: "test-cb-client-id",
  CODEBERG_CLIENT_SECRET: "test-cb-client-secret",
  NEXT_PUBLIC_BASE_URL: "https://chapa.thecreativetoken.com",
} as const;

export const CODEBERG_TOKEN_RESPONSE = {
  access_token: "cb_access_123",
  token_type: "bearer",
  expires_in: 28800,
  refresh_token: "cb_refresh_456",
};

export const CODEBERG_USER = {
  login: "cb-user",
  full_name: "CB User",
  avatar_url: "https://codeberg.org/avatars/12345",
};

export const CODEBERG_STATE_COOKIE = {
  state: "random-csrf-state",
  cookie: "chapa_cb_oauth_state=random-csrf-state; HttpOnly; SameSite=Lax; Path=/; Max-Age=600",
};

export const CODEBERG_AUTH_URL =
  "https://codeberg.org/login/oauth/authorize?client_id=test-cb-client-id&state=random-csrf-state";

export const CODEBERG_CLEAR_COOKIE =
  "chapa_cb_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";

// ---------------------------------------------------------------------------
// GitLab-specific fixtures
// ---------------------------------------------------------------------------

export const GITLAB_ENV_VARS = {
  GITLAB_CLIENT_ID: "test-gl-client-id",
  GITLAB_CLIENT_SECRET: "test-gl-client-secret",
  NEXT_PUBLIC_BASE_URL: "https://chapa.thecreativetoken.com",
} as const;

export const GITLAB_TOKEN_RESPONSE = {
  access_token: "gl_access_123",
  token_type: "bearer",
  expires_in: 7200,
  refresh_token: "gl_refresh_456",
};

export const GITLAB_USER = {
  id: 4242,
  login: "gl-user",
  full_name: "GL User",
  avatar_url: "https://gitlab.com/avatars/4242",
};

export const GITLAB_STATE_COOKIE = {
  state: "random-csrf-state",
  cookie: "chapa_gl_oauth_state=random-csrf-state; HttpOnly; SameSite=Lax; Path=/; Max-Age=600",
};

export const GITLAB_AUTH_URL =
  "https://gitlab.com/oauth/authorize?client_id=test-gl-client-id&state=random-csrf-state";

export const GITLAB_CLEAR_COOKIE =
  "chapa_gl_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";

// ---------------------------------------------------------------------------
// Env var helpers
// ---------------------------------------------------------------------------

/**
 * Set platform env vars from a record.
 */
export function setEnvVars(vars: Record<string, string>) {
  for (const [key, value] of Object.entries(vars)) {
    vi.stubEnv(key, value);
  }
}

/**
 * Clear platform env vars from a record (by keys).
 */
export function clearEnvVars(vars: Record<string, string>) {
  for (const key of Object.keys(vars)) {
    vi.stubEnv(key, undefined);
  }
}

// ---------------------------------------------------------------------------
// Common test date
// ---------------------------------------------------------------------------

export const TEST_TOKEN_EXPIRY = new Date("2026-03-01T00:00:00Z");
export const TEST_IP = "1.2.3.4";
