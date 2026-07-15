import { NextResponse, type NextRequest } from "next/server";
import { pickFromAcceptLanguage } from "./lib/i18n/detect";
import { DEFAULT_LOCALE, LOCALE_COOKIE, SUPPORTED_LOCALES } from "./lib/i18n/types";
import type { Locale } from "./lib/i18n/types";

/**
 * Resolves the locale for a content-page request using the same priority
 * order as the server-side `getServerLocale()` helper (lib/i18n/server.ts):
 * `chapa-locale` cookie first, then `Accept-Language`, falling back to
 * `DEFAULT_LOCALE`. Re-implemented here (reading directly from the
 * `NextRequest` cookie jar / headers) rather than reusing `getServerLocale`
 * because the proxy (formerly "middleware") runs on the Edge runtime and
 * must not import `next/headers` (which requires the Next.js request-scoped
 * async storage that `getServerLocale` relies on).
 */
export function resolveProxyLocale(request: NextRequest): Locale {
  const cookieValue = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieValue && SUPPORTED_LOCALES.includes(cookieValue as Locale)) {
    return cookieValue as Locale;
  }
  const headerLocale = pickFromAcceptLanguage(
    request.headers.get("accept-language"),
  );
  return headerLocale ?? DEFAULT_LOCALE;
}

/**
 * Rewrites the 9 statically-generated content pages (see `matcher` below) to
 * their internal locale-segmented route (`/[locale]/...`) so the CANONICAL,
 * public-facing URL never carries a locale prefix (#1023 / FE-H1). This is a
 * REWRITE, not a redirect — the browser URL bar, all internal links, the
 * sitemap, and canonical/OG metadata stay exactly as they are today (`/`,
 * `/about`, `/archetypes/builder`, ...). Both locale variants are
 * statically generated at build time (see `app/[locale]/layout.tsx`'s
 * `generateStaticParams`), so this rewrite resolves to a pre-rendered page —
 * no request-time render cost, no client-side re-render/flash.
 *
 * Scope: see `docs/decisions/2026-07-08-no-middleware-adr.md` and its
 * 2026-07-15 addendum (`docs/decisions/2026-07-15-i18n-middleware-carve-out.md`)
 * — written when this file was still named `middleware.ts` (Next.js 16
 * renamed the convention to `proxy.ts`; the ADRs' reasoning and scope
 * decisions are unaffected by the rename). The `matcher` below is the
 * narrow, deliberately-scoped proxy that ADR anticipated — it covers ONLY
 * the 9 migrated content pages (and the 7 archetype slugs) and must NEVER be
 * broadened to a catch-all or wildcard pattern. It must not absorb the
 * existing per-page auth/flag gates (`/studio`, `/admin`, `/cli/authorize`),
 * which remain inline in their own page components exactly as before. It
 * must never match `/u/*` (share page, badge SVG, OG image — the hottest
 * path in the product), `/api/*`, `/verify/*` (badge verification —
 * distinct from `/about/verification`, which IS one of the 9 migrated
 * pages), `/experiments/*`, `/generating/*`, `/coming-soon`, `/_next/*`, or
 * static assets.
 */
export function proxy(request: NextRequest) {
  const locale = resolveProxyLocale(request);
  const url = request.nextUrl.clone();
  url.pathname =
    url.pathname === "/" ? `/${locale}` : `/${locale}${url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/",
    "/about",
    "/about/scoring",
    "/about/verification",
    "/privacy",
    "/terms",
    "/archetypes/builder",
    "/archetypes/guardian",
    "/archetypes/marathoner",
    "/archetypes/polymath",
    "/archetypes/artificer",
    "/archetypes/balanced",
    "/archetypes/emerging",
  ],
};
