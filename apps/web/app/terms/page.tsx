import { Navbar } from "@/components/Navbar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Chapa",
  description: "Terms of Service for Chapa, the developer impact badge platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg bg-grid-warm">
      <Navbar />

      <main id="main-content" className="relative mx-auto max-w-3xl px-6 pt-32 pb-24">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute top-1/4 right-1/4 h-96 w-96 rounded-full bg-amber/[0.03] blur-[150px]" />
        </div>

        <div className="relative">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-8 animate-fade-in-up">
            Terms of <span className="text-amber">Service</span>
          </h1>

          <div className="space-y-6 text-text-secondary leading-relaxed animate-fade-in-up [animation-delay:150ms]">
            <p className="text-xs text-text-secondary/60">
              Last updated: February 2026
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using Chapa, you agree to be bound by these Terms
              of Service. If you do not agree, please do not use the service.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              2. Description of Service
            </h2>
            <p>
              Chapa provides a developer impact scoring and badge generation
              service using publicly available GitHub data. The service is
              provided &quot;as is&quot; without warranties of any kind.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              3. GitHub Data Usage
            </h2>
            <p>
              Chapa accesses your public GitHub profile and activity data
              through the GitHub API. We only request read access to public
              information. We do not access private repositories or private
              profile data.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              4. User Conduct
            </h2>
            <p>
              You agree not to misuse the service, including but not limited to:
              attempting to manipulate scores, abusing API rate limits, or using
              the service for any unlawful purpose.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              5. Limitation of Liability
            </h2>
            <p>
              Chapa and its creators shall not be liable for any indirect,
              incidental, or consequential damages arising from the use of the
              service.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              6. Changes to Terms
            </h2>
            <p>
              We reserve the right to modify these terms at any time. Continued
              use of the service after changes constitutes acceptance of the
              new terms.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              7. Contact
            </h2>
            <p>
              For questions about these terms, contact us at{" "}
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
