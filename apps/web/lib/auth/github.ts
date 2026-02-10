import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";

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
    scope: "read:user",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// CSRF state cookie
// ---------------------------------------------------------------------------

const STATE_COOKIE_NAME = "chapa_oauth_state";

export function createStateCookie(): { state: string; cookie: string } {
  const state = randomBytes(16).toString("hex");
  const cookie = `${STATE_COOKIE_NAME}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`;
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
  return cookieState === queryState;
}

export function clearStateCookie(): string {
  return `${STATE_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
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
    const [ivHex, authTagHex, ciphertextHex] = parts;
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
  return `${COOKIE_NAME}=${encrypted}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`;
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
    return JSON.parse(json) as SessionPayload;
  } catch {
    return null;
  }
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
