import type PostHog from "posthog-js";

let _posthog: typeof PostHog | null = null;

/** Lazily load posthog-js and cache the default export. */
function getPosthog(): typeof PostHog | null {
  return _posthog;
}

/**
 * Called by PostHogProvider after dynamic import resolves.
 * Stores a reference so trackEvent can use it without its own import.
 */
export function setPosthogInstance(ph: typeof PostHog): void {
  _posthog = ph;
}

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  const ph = getPosthog();
  if (!ph || !ph.__loaded) return;
  ph.capture(event, properties);
}
