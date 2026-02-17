import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import PostHogProvider from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { KeyboardShortcutsProvider } from "@/components/KeyboardShortcutsProvider";
import { getBaseUrl } from "@/lib/env";

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
    "Your developer impact, decoded into four dimensions — Building, Guarding, Consistency, Breadth — from 12 months of GitHub activity. Live, embeddable SVG badge.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  openGraph: {
    type: "website",
    siteName: "Chapa",
    title: "Chapa — Developer Impact, Decoded",
    description:
      "Your developer impact, decoded into four dimensions from 12 months of GitHub activity. Live, embeddable SVG badge.",
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
      "Your developer impact, decoded into four dimensions. Live, embeddable SVG badge.",
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
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} ${plusJakarta.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://api.github.com" />
        <link rel="dns-prefetch" href="https://api.github.com" />
        <link rel="dns-prefetch" href="https://avatars.githubusercontent.com" />
        <link rel="preconnect" href="https://eu.i.posthog.com" />
        <link rel="dns-prefetch" href="https://eu.i.posthog.com" />
      </head>
      <body className="bg-bg text-text-primary font-body antialiased">
        {/* SAFETY: JSON-LD structured data from hardcoded constants — no user input. JSON.stringify escapes special characters. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "Chapa",
              url: BASE_URL,
              description:
                "Developer impact badge tool that analyzes 12 months of GitHub activity across four dimensions — Building, Guarding, Consistency, and Breadth — to generate a live, embeddable SVG badge with archetype classification and impact scoring.",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web",
              keywords:
                "GitHub developer metrics, developer impact score, GitHub profile badge, GitHub stats SVG, code review metrics, developer archetype, contribution analytics, open source metrics",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              featureList: [
                "Four-dimension impact scoring (Building, Guarding, Consistency, Breadth)",
                "Developer archetype classification (Builder, Guardian, Marathoner, Polymath, Balanced, Emerging)",
                "Live embeddable SVG badge for GitHub README",
                "52-week contribution heatmap",
                "Four-axis radar chart visualization",
                "Badge visual customization via Creator Studio",
                "Cryptographic badge verification (HMAC-SHA256)",
                "Score history and trend tracking",
              ],
            }),
          }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-full focus:border focus:border-amber/20 focus:bg-amber/10 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-amber"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <PostHogProvider>
            <KeyboardShortcutsProvider>{children}</KeyboardShortcutsProvider>
          </PostHogProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
