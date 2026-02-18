import { createHash, createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

// ---------------------------------------------------------------------------
// OAuth URL
// ---------------------------------------------------------------------------

export function buildAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// CSRF state cookie
// ---------------------------------------------------------------------------

const STATE_COOKIE_NAME = "chapa_oauth_state";

function isSecureOrigin(): boolean {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim() ?? "";
  return base.startsWith("https://");
}

function cookieFlags(): string {
  const secure = isSecureOrigin() ? " Secure;" : "";
  return `HttpOnly;${secure} SameSite=Lax; Path=/`;
}

export function createStateCookie(): { state: string; cookie: string } {
  const state = randomBytes(16).toString("hex");
  const cookie = `${STATE_COOKIE_NAME}=${state}; ${cookieFlags()}; Max-Age=600`;
  return { state, cookie };
}

export function validateState(
  cookieHeader: string | null,
  queryState: string | null,
): boolean {
  if (!cookieHeader || !queryState) return false;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE_NAME}=`));
  if (!match) return false;
  const cookieState = match.slice(STATE_COOKIE_NAME.length + 1);
  const cookieBuf = Buffer.from(cookieState, "utf8");
  const queryBuf = Buffer.from(queryState, "utf8");
  if (cookieBuf.length !== queryBuf.length) return false;
  return timingSafeEqual(cookieBuf, queryBuf);
}

export function clearStateCookie(): string {
  return `${STATE_COOKIE_NAME}=; ${cookieFlags()}; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const data = await res.json();
    if (data.error || !data.access_token) return null;
    return data.access_token as string;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch authenticated user
// ---------------------------------------------------------------------------

export async function fetchGitHubUser(
  accessToken: string,
): Promise<GitHubUser | null> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      login: data.login,
      name: data.name ?? null,
      avatar_url: data.avatar_url,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch primary verified email (requires user:email scope)
// ---------------------------------------------------------------------------

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * Fetch the user's primary verified email from GitHub.
 * Requires the `user:email` OAuth scope. Returns null if no primary
 * verified email is found or on any error.
 */
export async function fetchGitHubUserEmail(
  accessToken: string,
): Promise<string | null> {
  try {
    const res = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) return null;

    const emails: GitHubEmail[] = await res.json();
    const primary = emails.find((e) => e.primary && e.verified);
    return primary?.email ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Token encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptToken(token: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(
  encrypted: string,
  secret: string,
): string | null {
  try {
    const parts = encrypted.split(":");
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
    const key = deriveKey(secret);
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session cookie helpers
// ---------------------------------------------------------------------------

const COOKIE_NAME = "chapa_session";

interface SessionPayload {
  token: string;
  login: string;
  name: string | null;
  avatar_url: string;
}

export function createSessionCookie(
  payload: SessionPayload,
  secret: string,
): string {
  const json = JSON.stringify(payload);
  const encrypted = encryptToken(json, secret);
  return `${COOKIE_NAME}=${encrypted}; ${cookieFlags()}; Max-Age=86400`;
}

function isValidSessionPayload(value: unknown): value is SessionPayload {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj.login !== "string") return false;
  if (typeof obj.token !== "string") return false;
  if (obj.name !== null && typeof obj.name !== "string") return false;
  if (typeof obj.avatar_url !== "string") return false;
  return true;
}

export function readSessionCookie(
  cookieHeader: string | null,
  secret: string,
): SessionPayload | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const value = match.slice(COOKIE_NAME.length + 1);
  const json = decryptToken(value, secret);
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!isValidSessionPayload(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; ${cookieFlags()}; Max-Age=0`;
}
