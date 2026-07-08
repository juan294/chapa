import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { DEMO_STATS, DEMO_IMPACT } from "@/lib/render/demoData";
import { LandingPageClient } from "./LandingPageClient";

// #982 — the landing page must be statically renderable so the highest-traffic
// route stays CDN/ISR-cacheable. It therefore reads no cookies, headers, or
// request query params at render time: locale is applied client-side by the
// LanguageProvider (via useTranslation in LandingPageClient), and the OAuth
// error / ?lang= query params are read client-side from window.location.
export const dynamic = "force-static";
export const revalidate = 3600;

const demoBadgeSvg = renderBadgeSvg(DEMO_STATS, DEMO_IMPACT, {
  includeBranding: true,
  demoMode: true,
});

export default function Home() {
  return <LandingPageClient demoBadgeSvg={demoBadgeSvg} />;
}
