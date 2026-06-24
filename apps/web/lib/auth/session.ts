import "server-only";
import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";
import { getNextauthSecret } from "@/lib/env";

export type SessionPayload = NonNullable<ReturnType<typeof readSessionCookie>>;
const MIN_SESSION_SECRET_LENGTH = 32;

export type RequireSessionResult =
  | { session: SessionPayload; error?: never }
  | { session?: never; error: Response };

type CookieHeaderSource = {
  get(name: string): string | null;
};

/** Throws if the secret is shorter than the minimum required length; returns it otherwise. */
function assertSessionSecretLength(secret: string): string {
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error("NEXTAUTH_SECRET must be set and at least 32 chars");
  }
  return secret;
}

/** Reads NEXTAUTH_SECRET from the environment; returns null when unset or empty. */
function getRawSessionSecret(): string | null {
  const sessionSecret = getNextauthSecret();
  return sessionSecret || null;
}

/** Return the configured session signing secret, or null when it is unset. */
export function getSessionSecret(): string | null {
  const sessionSecret = getRawSessionSecret();
  return sessionSecret ? assertSessionSecretLength(sessionSecret) : null;
}

/** Return the validated session signing key used for HMAC cookie operations. */
export function getSessionKey(): Buffer {
  const sessionSecret = getSessionSecret();
  if (!sessionSecret) {
    throw new Error("NEXTAUTH_SECRET must be set and at least 32 chars");
  }
  return Buffer.from(sessionSecret, "utf8");
}

/** Decodes and verifies the session cookie; returns null when the header is absent or the signature is invalid. */
function parseSessionCookie(
  cookieHeader: string | null,
  sessionSecret: string | null = getSessionSecret(),
): SessionPayload | null {
  if (!sessionSecret) return null;
  return readSessionCookie(cookieHeader, sessionSecret);
}

/** Read an optional session from a server header store such as next/headers. */
export function getOptionalServerSessionFromHeaders(
  headerStore: CookieHeaderSource,
  sessionSecret?: string | null,
): SessionPayload | null {
  return parseSessionCookie(headerStore.get("cookie"), sessionSecret);
}

/** Read an optional session from a Fetch API request without creating a response. */
export function getOptionalRequestSession(
  request: Pick<Request, "headers">,
  sessionSecret?: string | null,
): SessionPayload | null {
  return parseSessionCookie(request.headers.get("cookie"), sessionSecret);
}

/** Require a valid request session, returning a JSON error response on failure. */
export function requireRequestSession(
  request: Request,
): RequireSessionResult {
  const sessionSecret = getSessionSecret();
  if (!sessionSecret) {
    return {
      error: NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      ),
    };
  }

  const session = getOptionalRequestSession(request, sessionSecret);
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }

  return { session };
}
