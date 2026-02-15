import { NextResponse } from "next/server";
import { readSessionCookie } from "@/lib/auth/github";

/**
 * Session payload shape — mirrors the interface in github.ts.
 * Re-declared here to keep the module self-contained; the source of truth
 * is readSessionCookie's return type.
 */
export interface SessionPayload {
  token: string;
  login: string;
  name: string | null;
  avatar_url: string;
}

type RequireSessionResult =
  | { session: SessionPayload; error?: never }
  | { session?: never; error: Response };

/**
 * Validate that the incoming request has a valid session cookie.
 *
 * Returns either:
 *   - `{ session }` on success
 *   - `{ error }` with a ready-to-return Response (500 or 401)
 *
 * Usage:
 * ```ts
 * const { session, error } = requireSession(request);
 * if (error) return error;
 * // session is guaranteed to be defined here
 * ```
 */
export function requireSession(request: Request): RequireSessionResult {
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim();
  if (!sessionSecret) {
    return {
      error: NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      ),
    };
  }

  const cookieHeader = request.headers.get("cookie");
  const session = readSessionCookie(cookieHeader, sessionSecret);
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }

  return { session: session as SessionPayload };
}
