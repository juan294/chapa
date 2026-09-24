import { NextRequest, NextResponse } from "next/server";
import { writeLocaleCookie } from "@/lib/i18n/cookie";
import { isSupportedLocale, type Locale } from "@/lib/i18n/types";
import { withErrorCapture } from "@/lib/analytics/server-errors";

/**
 * POST /api/locale
 *
 * Persists the `chapa-locale` cookie for future page loads. Deliberately a
 * plain Route Handler, NOT a Server Action.
 *
 * `LocaleSync`/`LanguageProvider.setLocale` already apply a locale change to
 * the current render synchronously, client-side, before this call — cookie
 * persistence here is best-effort and must never re-render the page. But a
 * Server Action that calls `cookies().set()` (which the old `setLocaleAction`
 * did) makes Next.js return "the updated UI and new data in a single server
 * roundtrip" for the CURRENT route alongside the action's own response (see
 * `cookies()` docs, "Understanding Cookie Behavior in Server Functions" —
 * that roundtrip is documented as specific to Server Actions, not Route
 * Handlers). On `/u/[handle]`, whose `generateMetadata` is async and streamed,
 * that second render streamed a second, byte-identical
 * `<meta property="og:image">` tag, which the client appended next to the
 * one from the original page load instead of replacing it — reproducing
 * 100% of the time on the FIRST navigation to a locale that doesn't yet
 * match the persisted cookie (e.g. the first `?lang=es` visit after the
 * cookie was set to `en` by earlier navigation), and never once the cookie
 * already matches. A Route Handler sets the `Set-Cookie` response header
 * without that implicit second render.
 */
export const POST = withErrorCapture("/api/locale", async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const locale = (body as { locale?: unknown } | null)?.locale;
  if (!isSupportedLocale(locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  await writeLocaleCookie(locale as Locale);
  return NextResponse.json({ ok: true });
});
