import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { DEMO_STATS, DEMO_IMPACT } from "@/lib/render/demoData";
import { LandingContent } from "../LandingContent";
import { getServerT } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/types";

// #982 / #1023 (FE-H1) — the landing page is statically generated for BOTH
// locales (see app/[locale]/layout.tsx's generateStaticParams), so it stays
// ISR/CDN-cacheable while rendering fully translated copy server-side with no
// client-side re-render/flash. The public, canonical URL stays `/` — the
// root `proxy.ts` rewrites the incoming request to this internal
// `/[locale]` route based on the `chapa-locale` cookie / Accept-Language.
export const dynamic = "force-static";
export const revalidate = 3600;

const demoBadgeSvg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
  includeBranding: true,
  demoMode: true,
});

export default async function Home({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = getServerT(locale);
  return <LandingContent demoBadgeSvg={demoBadgeSvg} t={t} />;
}
