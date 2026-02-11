import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes that always pass through even when COMING_SOON is enabled.
 * Order doesn't matter — first match short-circuits.
 */
const ALLOW_PATTERNS: RegExp[] = [
  /^\/coming-soon$/,
  /^\/u\/[^/]+\/badge\.svg$/,
  /^\/api(\/|$)/,
  /^\/_next(\/|$)/,
  /^\/favicon\./,
  /^\/logo/,
  /^\/site\.webmanifest$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
];

/** Pure function — testable without Next.js runtime. */
export function shouldRedirect(pathname: string, comingSoon: boolean): boolean {
  if (!comingSoon) return false;
  return !ALLOW_PATTERNS.some((re) => re.test(pathname));
}

export function middleware(request: NextRequest) {
  const comingSoon = process.env.COMING_SOON?.trim() === "true";
  if (shouldRedirect(request.nextUrl.pathname, comingSoon)) {
    const url = request.nextUrl.clone();
    url.pathname = "/coming-soon";
    return NextResponse.redirect(url, 307);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all routes except Next.js internals and static assets.
     * Middleware still checks the allowlist above for belt-and-suspenders safety.
     */
    "/((?!_next/static|_next/image).*)",
  ],
};
