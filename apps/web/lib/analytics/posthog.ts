/**
 * PostHog analytics stub.
 * No-op until PostHog is configured.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function trackEvent(event: string, properties?: Record<string, unknown>): void {
  // No-op stub
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function identifyUser(distinctId: string, traits?: Record<string, unknown>): void {
  // No-op stub
}
