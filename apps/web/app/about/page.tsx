import { Navbar } from "@/components/Navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Chapa, the developer impact badge platform. Discover how Impact Score v3 works and what data we analyze.",
  openGraph: {
    title: "About Chapa",
    description:
      "Learn about Chapa, the developer impact badge platform. Discover how Impact Score v3 works.",
  },
  twitter: {
    card: "summary",
    title: "About Chapa",
    description:
      "Learn about Chapa, the developer impact badge platform.",
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      <main id="main-content" className="relative mx-auto max-w-3xl px-6 pt-32 pb-24">
        <div className="relative">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-8 animate-fade-in-up">
            About Chapa<span className="text-amber animate-cursor-blink">_</span>
          </h1>

          <div className="space-y-6 text-text-secondary leading-relaxed animate-fade-in-up [animation-delay:150ms]">
            <p>
              Chapa generates a live, embeddable SVG badge that showcases your
              developer Impact Score from GitHub activity. It analyzes your last
              90 days of commits, pull requests, code reviews, and issues to
              produce a transparent, data-driven impact rating.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              How it works
            </h2>
            <p>
              Sign in with GitHub, and Chapa computes your Impact Score v3 — a
              base score (0-100), a confidence rating, and a tier. The badge
              updates daily and can be embedded in your README, portfolio, or
              resume.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              Open and transparent
            </h2>
            <p>
              Chapa only requests access to public GitHub data. The scoring
              methodology is documented and transparent. Confidence messaging
              is designed to surface patterns without making accusations.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              Contact
            </h2>
            <p>
              Questions or feedback? Reach us at{" "}
              <a
                href="mailto:support@chapa.thecreativetoken.com"
                className="text-amber hover:text-amber-light transition-colors"
              >
                support@chapa.thecreativetoken.com
              </a>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
