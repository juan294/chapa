import { describe, it, expect } from "vitest";

import { DEFAULT_LOCALE } from "./types";

/**
 * #1201 — `DEFAULT_LOCALE` is the fallback used ONLY when a request carries no
 * locale signal at all. A `chapa-locale` cookie or an `Accept-Language` header
 * still wins ahead of it everywhere (`proxy.ts`, `getServerLocale`), so a
 * Spanish visitor keeps Spanish; this constant governs the signal-less case.
 *
 * The signal-less case is not an edge case for this product. The embeddable
 * badge (`/u/:handle/badge.svg`) is the clearest instance: a README `<img>`
 * embed sends no cookie and no useful `Accept-Language`, so
 * `resolveLocaleFromRequest` resolves purely from `?lang=` and falls back here.
 * Every un-qualified embedded badge on GitHub therefore renders in this locale
 * for a worldwide audience. The same constant renders the static shells (root
 * layout, the `loading.tsx` files, `/verify`) and the badge the warm-cache cron
 * pre-warms.
 *
 * This is asserted as its own contract rather than left implicit in the
 * behavioural tests, because flipping it silently changes what an anonymous
 * visitor and every embedded badge see.
 */
describe("DEFAULT_LOCALE (#1201)", () => {
  it("is English, so a request with no locale signal renders English", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });
});
