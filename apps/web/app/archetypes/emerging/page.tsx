import { Navbar } from "@/components/Navbar";
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { EMERGING_STATS, EMERGING_IMPACT } from "@/lib/render/archetypeDemoData";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Emerging Archetype",
  description:
    "Emerging developers are at the beginning of their contribution journey. Their profile is still taking shape, with growth potential in every dimension.",
};

const badgeSvg = renderBadgeSvg(EMERGING_STATS, EMERGING_IMPACT, {
  includeGithubBranding: true,
  demoMode: true,
});

export default function EmergingPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <article className="animate-fade-in-up">
          {/* Terminal command */}
          <div className="flex items-center gap-2 mb-6 font-heading text-sm">
            <span className="text-terminal-dim select-none">$</span>
            <span className="text-text-secondary">chapa archetype emerging</span>
          </div>

          <div className="pl-4 border-l border-stroke space-y-8">
            {/* Header */}
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
                The <span className="text-archetype-emerging">Emerging</span>
              </h1>
              <p className="text-text-secondary text-sm mt-2 font-heading">
                Dominant dimension: <span className="text-archetype-emerging">None yet &mdash; profile still forming</span>
              </p>
            </div>

            {/* Badge */}
            {/* SAFETY: SVG is server-rendered by renderBadgeSvg() from hardcoded archetype demo data — no user input reaches this point. See lib/render/escape.ts for escaping. */}
            <div
              className="rounded-xl shadow-2xl shadow-black/30 overflow-hidden [&>svg]:w-full [&>svg]:h-auto"
              role="img"
              aria-label="Example Chapa badge for The Emerging archetype"
              dangerouslySetInnerHTML={{ __html: badgeSvg }}
            />

            {/* Essay */}
            <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
              <p>
                Every developer starts somewhere. The Emerging archetype is where Chapa puts
                profiles that haven&apos;t yet accumulated enough activity to reveal a clear
                pattern. This isn&apos;t a judgment &mdash; it&apos;s a snapshot. You&apos;re
                early in your contribution history, or your GitHub activity in the last 12 months
                has been light, and the algorithm doesn&apos;t have enough signal to classify you
                with confidence.
              </p>

              <p>
                Chapa assigns Emerging when overall activity is low and no clear pattern has
                formed. At that point, the data is too sparse for any archetype label to be
                meaningful. Rather than guess, the system acknowledges that your profile is
                still taking shape.
              </p>

              <p>
                The Emerging classification is also the fallback. If the algorithm runs through
                every archetype rule &mdash; Balanced, Polymath, Guardian, Marathoner, Builder
                &mdash; and none of them match, Emerging is what you get. This can happen even
                with moderate activity if your contributions are spread in a way that doesn&apos;t
                trigger any specific archetype threshold.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                How Chapa identifies an Emerging developer
              </h2>

              <p>
                Emerging is evaluated <em>first</em> in the archetype pipeline, before any
                specific archetype check. If overall activity is too low, the algorithm
                short-circuits and assigns Emerging immediately. This prevents low-confidence
                data from producing misleading archetype labels. Better to say &ldquo;we don&apos;t
                know yet&rdquo; than to say something wrong.
              </p>

              <p>
                The confidence score for Emerging profiles is typically low, and the system may
                flag reasons like &ldquo;limited contribution history&rdquo; or &ldquo;insufficient
                data for reliable scoring.&rdquo; These are informational, never accusatory &mdash;
                Chapa is designed to explain, not to blame.
              </p>

              <h3 className="font-heading text-sm text-text-primary tracking-tight pt-2">
                Key signals
              </h3>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">TRIGGER</span>
                  <span className="text-text-secondary text-sm">Overall activity below threshold &mdash; not enough data for a confident label.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">FALLBACK</span>
                  <span className="text-text-secondary text-sm">No specific archetype pattern matches &mdash; assigned when all other rules fail.</span>
                </div>
              </div>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                What an Emerging developer looks like in practice
              </h2>

              <p>
                Emerging profiles belong to a wide range of people. New developers writing their
                first pull requests. Experienced engineers who just joined GitHub after years on
                internal tools. Developers returning from a long break. Students building their
                first open-source contributions. People who primarily code on platforms Chapa
                doesn&apos;t track yet.
              </p>

              <p>
                The Emerging label is temporary by nature. A few months of consistent activity,
                a handful of merged PRs, or broadening into more repositories can quickly
                shift a profile into Builder, Marathoner, or any other archetype. The heatmap
                on an Emerging badge is often sparse &mdash; a few scattered squares rather than
                a dense pattern &mdash; but those squares represent the beginning of a trajectory.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                The Emerging radar shape
              </h2>

              <p>
                On the Chapa radar chart, an Emerging developer&apos;s shape is small and close
                to the center &mdash; a compact polygon that hasn&apos;t yet expanded outward in
                any direction. It&apos;s not a limitation. It&apos;s a starting point. Every
                Builder, Guardian, Marathoner, and Polymath once had a radar chart that looked
                exactly like this.
              </p>
            </div>

            {/* Links */}
            <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
              <Link
                href="/#features"
                className="font-heading text-sm text-amber hover:text-amber-light transition-colors"
              >
                &larr; Back to features
              </Link>
              <Link
                href="/about/scoring"
                className="font-heading text-sm text-text-secondary hover:text-amber transition-colors"
              >
                Full scoring methodology &rarr;
              </Link>
            </div>
          </div>
        </article>
      </main>
      <GlobalCommandBar />
    </div>
  );
}
