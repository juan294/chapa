import { Navbar } from "@/components/Navbar";
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about Chapa — developer impact, decoded. Discover how the four-dimension scoring model works and what data we analyze.",
  openGraph: {
    title: "About Chapa",
    description:
      "Learn about Chapa — developer impact, decoded. Four dimensions that show what kind of developer you are.",
  },
  twitter: {
    card: "summary",
    title: "About Chapa",
    description:
      "Learn about Chapa — developer impact, decoded.",
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
              When AI writes most code, traditional volume metrics — commits,
              LOC, PR counts — become meaningless. What matters is <em>how</em>{" "}
              you contribute, not <em>how much</em> code you produce.
            </p>

            <p>
              Chapa generates a live, embeddable SVG badge that decodes your
              developer impact from GitHub activity. It analyzes your
              last 12 months across four independent dimensions to show what kind
              of developer you are.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              Four dimensions
            </h2>
            <p>
              <strong className="text-text-primary">Building</strong> — shipping meaningful changes
              (PRs merged, issues closed).{" "}
              <strong className="text-text-primary">Guarding</strong> — reviewing and quality
              gatekeeping.{" "}
              <strong className="text-text-primary">Consistency</strong> — reliable, sustained
              contributions over time.{" "}
              <strong className="text-text-primary">Breadth</strong> — cross-project influence and
              diversity of work. Each dimension is scored 0-100 independently.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              Developer archetypes
            </h2>
            <p>
              Your dimension profile shape determines your archetype: Builder,
              Guardian, Marathoner, Polymath, Balanced, or Emerging. The
              archetype is shown as the primary label on your badge, with a
              composite score and tier as secondary context.
            </p>

            <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight pt-4">
              Privacy and fairness
            </h2>
            <p>
              Chapa only requests access to public GitHub data. Confidence
              messaging is designed to surface patterns without making
              accusations. The scoring model is built to reward genuine
              contribution and resist gaming — volume alone does not
              determine your score.
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

      <GlobalCommandBar />
    </div>
  );
}
