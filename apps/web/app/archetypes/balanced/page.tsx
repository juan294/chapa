import { Navbar } from "@/components/Navbar";
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { BALANCED_STATS, BALANCED_IMPACT } from "@/lib/render/archetypeDemoData";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Balanced Archetype",
  description:
    "Balanced developers score well across all four dimensions without a single standout. They are versatile, well-rounded contributors who strengthen every part of a team.",
};

const badgeSvg = renderBadgeSvg(BALANCED_STATS, BALANCED_IMPACT, {
  includeGithubBranding: true,
  demoMode: true,
});

export default function BalancedPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <article className="animate-fade-in-up">
          {/* Terminal command */}
          <div className="flex items-center gap-2 mb-6 font-heading text-sm">
            <span className="text-terminal-dim select-none">$</span>
            <span className="text-text-secondary">chapa archetype balanced</span>
          </div>

          <div className="pl-4 border-l border-stroke space-y-8">
            {/* Header */}
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
                The <span className="text-text-primary">Balanced</span>
              </h1>
              <p className="text-text-secondary text-sm mt-2 font-heading">
                Dominant dimension: <span className="text-text-primary">None &mdash; all dimensions closely matched</span>
              </p>
            </div>

            {/* Badge */}
            <div
              className="rounded-xl shadow-2xl shadow-black/30 overflow-hidden [&>svg]:w-full [&>svg]:h-auto"
              role="img"
              aria-label="Example Chapa badge for The Balanced archetype"
              dangerouslySetInnerHTML={{ __html: badgeSvg }}
            />

            {/* Essay */}
            <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
              <p>
                Not every great developer has a spike. Some are great precisely because they
                don&apos;t. The Balanced archetype represents developers whose radar chart forms
                something close to a circle &mdash; no dramatic peaks, no deep valleys, just
                consistent capability across every dimension Chapa measures.
              </p>

              <p>
                The Balanced archetype triggers when all four dimensions (Building, Guarding,
                Consistency, Breadth) are closely matched and collectively strong. This is harder
                than it sounds. Most developers naturally gravitate toward one style of
                contribution. Maintaining high scores in shipping, reviewing, showing up
                consistently, <em>and</em> working across multiple projects requires a rare kind
                of discipline.
              </p>

              <p>
                Balanced developers defy easy categorization, and that&apos;s the point. They&apos;re
                not the fastest shipper, the most rigorous reviewer, the most consistent committer,
                or the broadest contributor. They&apos;re all of these things at once, in measure.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                How Chapa identifies a Balanced developer
              </h2>

              <p>
                The algorithm evaluates Balanced <em>before</em> checking for specific archetypes.
                If your dimensions are tightly clustered and collectively strong, you&apos;re
                classified as Balanced regardless of which individual dimension is technically
                highest. This prevents the system from forcing a specialization label onto someone
                whose strength is precisely their lack of specialization.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                What a Balanced developer looks like in practice
              </h2>

              <p>
                Balanced developers are often the most adaptable people on a team. They&apos;re
                the engineer who can pick up whatever needs doing &mdash; ship a feature on Monday,
                spend Tuesday in code review, fix a CI pipeline on Wednesday, and contribute to a
                new repo on Thursday. They don&apos;t have a &ldquo;thing.&rdquo; Their thing is
                being useful everywhere.
              </p>

              <p>
                In smaller teams and startups, Balanced profiles are especially valuable. When
                you don&apos;t have the luxury of dedicated specialists for every function, the
                person who can context-switch across building, reviewing, and maintaining is
                the one who keeps everything moving.
              </p>

              <p>
                Senior engineers who have grown out of their original specialization often end up
                here. They started as Builders or Guardians, but years of experience taught them
                to contribute across every dimension. The Balanced archetype captures that maturity.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                The Balanced radar shape
              </h2>

              <p>
                On the Chapa radar chart, a Balanced developer&apos;s shape is the closest thing
                to a diamond you&apos;ll see &mdash; roughly equal reach in all four directions.
                It&apos;s the visual signature of a developer who doesn&apos;t lean, doesn&apos;t
                specialize, and doesn&apos;t leave gaps. Quiet, complete, and hard to replace.
              </p>
            </div>

            {/* Back link */}
            <div className="pt-4">
              <Link
                href="/#features"
                className="font-heading text-sm text-amber hover:text-amber-light transition-colors"
              >
                &larr; Back to features
              </Link>
            </div>
          </div>
        </article>
      </main>
      <GlobalCommandBar />
    </div>
  );
}
