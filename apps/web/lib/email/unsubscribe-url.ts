import { generateUnsubscribeToken } from "@/lib/auth/unsubscribe-token";
import { getBaseUrl, getNextauthSecret } from "@/lib/env";

/**
 * Build a signed unsubscribe URL for outbound emails.
 */
export function buildUnsubscribeUrl(handle: string): string {
  const normalizedHandle = handle.toLowerCase();
  const token = generateUnsubscribeToken(
    normalizedHandle,
    getNextauthSecret() ?? "",
  );

  const params = new URLSearchParams({
    handle: normalizedHandle,
    token,
  });

  return `${getBaseUrl()}/api/notifications/unsubscribe?${params.toString()}`;
}
