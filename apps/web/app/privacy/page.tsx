import { Navbar } from "@/components/Navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Chapa. Learn how we handle your GitHub data, session storage, and analytics.",
  openGraph: {
    title: "Privacy Policy — Chapa",
    description:
      "Privacy Policy for Chapa. Learn how we handle your GitHub data, session storage, and analytics.",
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg bg-grid-warm">
      <Navbar />

      <main id="main-content" className="relative mx-auto max-w-3xl px-6 pt-32 pb-24">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute bottom-1/4 left-1/4 h-96 w-96 rounded-full bg-amber/[0.03] blur-[150px]" />
        </div>

        <div className="relative">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-8 animate-fade-in-up">
            Privacy <span className="text-amber">Policy</span>
          </h1>

          <div className="space-y-6 text-text-secondary leading-relaxed animate-fade-in-up [animation-delay:150ms]">
            <p className="text-xs text-text-secondary/60">
              Last updated: February 2026
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              1. Information We Collect
            </h2>
            <p>
              When you sign in with GitHub, we receive your public profile
              information (username, display name, avatar URL) and a
              time-limited access token to fetch your public activity data.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              2. How We Use Your Information
            </h2>
            <p>
              We use your GitHub activity data solely to compute your Impact
              Score and generate your badge. We cache computed scores for up to
              24 hours to reduce API calls. We do not sell, share, or transfer
              your data to third parties.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              3. Data Storage
            </h2>
            <p>
              Session data is stored in an encrypted HTTP-only cookie in your
              browser. Cached scores are stored in Upstash Redis with a 24-hour
              TTL and are automatically deleted after expiration.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              4. Analytics
            </h2>
            <p>
              We use PostHog for basic, privacy-friendly analytics (page views
              and key events). No personal information is sent to analytics
              services.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              5. Your Rights
            </h2>
            <p>
              You can sign out at any time to clear your session. You can revoke
              Chapa&apos;s access to your GitHub account through your GitHub
              settings under &quot;Authorized OAuth Apps.&quot;
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              6. Contact
            </h2>
            <p>
              For privacy-related inquiries, contact us at{" "}
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
