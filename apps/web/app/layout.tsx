import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "@/styles/globals.css";
import { ClientInstrumentation } from "@/components/ClientInstrumentation";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ClientFeatureFlagsProvider } from "@/components/ClientFeatureFlagsProvider";
import { getBaseUrl } from "@/lib/env";
import { isStudioEnabledSync } from "@/lib/feature-flags-sync";
import { renderJsonLd } from "@/lib/jsonld";
import { LanguageProvider, LangSync } from "@/lib/i18n";
import { DEFAULT_LOCALE } from "@/lib/i18n/types";
// Server-only dictionary imports: this is a server component, so these never
// ship in the client JS bundle. Only the DEFAULT locale's dictionary is passed
// to the client LanguageProvider (serialized into the RSC payload); the other
// locale is loaded on-demand client-side only when the user switches (#862).
import { en } from "@/lib/i18n/dictionaries/en";
import { es } from "@/lib/i18n/dictionaries/es";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const BASE_URL = getBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Chapa — Developer Impact, Decoded",
    template: "%s — Chapa",
  },
  description:
    "Your developer impact, decoded into multiple dimensions — Delivery, Quality, Consistency, Breadth, and optional Craft — from 12 months of development activity. Live, embeddable SVG badge.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    siteName: "Chapa",
    title: "Chapa — Developer Impact, Decoded",
    description:
      "Your developer impact, decoded into multiple dimensions from 12 months of development activity. Live, embeddable SVG badge.",
    url: BASE_URL,
    images: [
      {
        url: "/og-image",
        width: 1200,
        height: 630,
        alt: "Chapa — Developer Impact, Decoded",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chapa — Developer Impact, Decoded",
    description:
      "Your developer impact, decoded into multiple dimensions. Live, embeddable SVG badge.",
    images: ["/og-image"],
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use sync env-var check instead of DB-backed async check to avoid
  // Upstash Redis fetch(no-store) calls that force dynamic rendering.
  const studioEnabled = isStudioEnabledSync();
  // Render at DEFAULT_LOCALE at build time so the layout never calls
  // cookies()/headers() — that would force every page into dynamic rendering and
  // defeat ISR on /about, /archetypes/*, etc. (#861). Pass ONLY the default
  // locale's dictionary to the client provider (serialized into the RSC payload,
  // never the shared JS bundle); the provider loads the other locale on-demand
  // client-side when the user switches, and LangSync keeps <html lang> in sync (#862).
  const locale = DEFAULT_LOCALE;
  const dictionary = locale === "es" ? es : en;

  return (
    <html
      lang={locale}
      className={`${jetbrainsMono.variable} ${plusJakarta.variable}`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <head>
        <link rel="preconnect" href="https://api.github.com" />
        <link rel="dns-prefetch" href="https://api.github.com" />
        <link rel="dns-prefetch" href="https://avatars.githubusercontent.com" />
      </head>
      <body className="bg-bg text-text-primary font-body antialiased">
        {/* SAFETY: JSON-LD from hardcoded constants — renderJsonLd escapes <, >, & to prevent </script> injection. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: renderJsonLd({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Chapa",
              url: BASE_URL,
              description:
                "Developer impact badge tool that analyzes 12 months of development activity across multiple dimensions — Delivery, Quality, Consistency, Breadth, and optional Craft — to generate a live, embeddable SVG badge with archetype classification and impact scoring.",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web",
              keywords:
                "developer metrics, developer impact score, GitHub profile badge, Bitbucket badge, Codeberg badge, GitLab badge, developer stats SVG, code review metrics, developer archetype, contribution analytics, open source metrics, multi-platform developer badge",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              featureList: [
                "Multi-dimension impact scoring (Delivery, Quality, Consistency, Breadth, optional Craft)",
                "Developer archetype classification (Builder, Quality Champion, Marathoner, Polymath, Artificer, Balanced, Emerging)",
                "Live embeddable SVG badge for READMEs and portfolios",
                "Activity timeline visualization",
                "Dynamic radar chart (pentagon or diamond)",
                "Badge visual customization via Creator Studio",
                "Cryptographic badge verification (HMAC-SHA256)",
                "Score history and trend tracking",
              ],
            })
          }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-lg focus:bg-amber focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:shadow-amber/25"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <LanguageProvider initialLocale={locale} dictionary={dictionary}>
            <LangSync />
            <ClientFeatureFlagsProvider studioEnabled={studioEnabled}>
              {children}
            </ClientFeatureFlagsProvider>
          </LanguageProvider>
        </ThemeProvider>
        <ClientInstrumentation />
      </body>
    </html>
  );
}
