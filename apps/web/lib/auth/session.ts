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

function assertSessionSecretLength(secret: string): string {
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new Error("NEXTAUTH_SECRET must be set and at least 32 chars");
  }
  return secret;
}

function getRawSessionSecret(): string | null {
  const sessionSecret = getNextauthSecret();
  return sessionSecret || null;
}

export function getSessionSecret(): string | null {
  return getRawSessionSecret();
}

export function getSessionKey(): Buffer {
  const sessionSecret = getRawSessionSecret();
  if (!sessionSecret) {
    throw new Error("NEXTAUTH_SECRET must be set and at least 32 chars");
  }
  return Buffer.from(assertSessionSecretLength(sessionSecret), "utf8");
}

function parseSessionCookie(
  cookieHeader: string | null,
  sessionSecret: string | null = getSessionSecret(),
): SessionPayload | null {
  if (!sessionSecret) return null;
  return readSessionCookie(cookieHeader, sessionSecret);
}

export function getOptionalServerSessionFromHeaders(
  headerStore: CookieHeaderSource,
  sessionSecret?: string | null,
): SessionPayload | null {
  return parseSessionCookie(headerStore.get("cookie"), sessionSecret);
}

export function getOptionalRequestSession(
  request: Pick<Request, "headers">,
  sessionSecret?: string | null,
): SessionPayload | null {
  return parseSessionCookie(request.headers.get("cookie"), sessionSecret);
}

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
