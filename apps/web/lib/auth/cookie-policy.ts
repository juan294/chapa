function isLocalhostHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function shouldUseSecureCookies(originLike?: string | null): boolean {
  if (!originLike?.trim()) {
    return true;
  }

  try {
    const origin = new URL(originLike);
    return !(
      origin.protocol === "http:" &&
      isLocalhostHostname(origin.hostname)
    );
  } catch {
    return true;
  }
}

export function buildAuthCookieFlags(originLike?: string | null): string {
  const secure = shouldUseSecureCookies(originLike) ? " Secure;" : "";
  return `HttpOnly;${secure} SameSite=Lax; Path=/`;
}
