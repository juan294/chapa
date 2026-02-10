/**
 * PostHog analytics stub.
 * No-op until PostHog is configured.
 */

export function trackEvent(
  _event: string,
  _properties?: Record<string, unknown>,
): void {
  // No-op stub
}

export function identifyUser(
  _distinctId: string,
  _traits?: Record<string, unknown>,
): void {
  // No-op stub
}
