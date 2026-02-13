import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "@/styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import PostHogProvider from "@/components/PostHogProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { KeyboardShortcutsProvider } from "@/components/KeyboardShortcutsProvider";

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

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
  "https://chapa.thecreativetoken.com";

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
        url: "/logo-512.png",
        width: 512,
        height: 512,
        alt: "Chapa logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chapa — Developer Impact, Decoded",
    description:
      "Your developer impact, decoded into four dimensions. Live, embeddable SVG badge.",
    images: ["/logo-512.png"],
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
      <body className="bg-bg text-text-primary font-body antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Chapa",
              url: BASE_URL,
              description:
                "Your developer impact, decoded — Building, Guarding, Consistency, and Breadth from 12 months of GitHub activity. Live, embeddable SVG badge.",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
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
      </body>
    </html>
  );
}
