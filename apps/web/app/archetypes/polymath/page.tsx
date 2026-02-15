import { Navbar } from "@/components/Navbar";
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { POLYMATH_STATS, POLYMATH_IMPACT } from "@/lib/render/archetypeDemoData";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Polymath Archetype",
  description:
    "Polymaths spread their impact across many projects and domains. They contribute to diverse repositories, write documentation, and influence the broader ecosystem.",
};

const badgeSvg = renderBadgeSvg(POLYMATH_STATS, POLYMATH_IMPACT, {
  includeGithubBranding: true,
  demoMode: true,
});

export default function PolymathPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <article className="animate-fade-in-up">
          {/* Terminal command */}
          <div className="flex items-center gap-2 mb-6 font-heading text-sm">
            <span className="text-terminal-dim select-none">$</span>
            <span className="text-text-secondary">chapa archetype polymath</span>
          </div>

          <div className="pl-4 border-l border-stroke space-y-8">
            {/* Header */}
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
                The <span className="text-terminal-yellow">Polymath</span>
              </h1>
              <p className="text-text-secondary text-sm mt-2 font-heading">
                Dominant dimension: <span className="text-terminal-yellow">Breadth</span>
              </p>
            </div>

            {/* Badge */}
            {/* SAFETY: SVG is server-rendered by renderBadgeSvg() from hardcoded archetype demo data — no user input reaches this point. See lib/render/escape.ts for escaping. */}
            <div
              className="rounded-xl shadow-2xl shadow-black/30 overflow-hidden [&>svg]:w-full [&>svg]:h-auto"
              role="img"
              aria-label="Example Chapa badge for The Polymath archetype"
              dangerouslySetInnerHTML={{ __html: badgeSvg }}
            />

            {/* Essay */}
            <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
              <p>
                Some developers go deep. Polymaths go wide. They&apos;re the ones with
                contributions scattered across 10 different repositories, pull requests that range
                from backend API changes to documentation fixes to DevOps pipeline improvements.
                Their GitHub profile reads less like a specialist&apos;s resume and more like a map
                of everywhere interesting things are happening.
              </p>

              <p>
                The Breadth dimension in Chapa captures this cross-project influence through
                multiple signals: how many repositories you contribute to, how evenly your work
                is distributed across them, your community reach through stars and forks, and
                whether you write documentation. Raw repo count matters, but concentration matters
                too. Contributing to many repos with no single repo dominating scores higher than
                contributing to the same number of repos where most of the work is in one.
              </p>

              <p>
                The documentation signal is unique to the Polymath. Chapa specifically tracks PRs
                that only touch documentation files, because writing docs is one of the clearest
                markers of someone who cares about the ecosystem beyond their own code. Polymaths
                don&apos;t just build features; they make those features understandable to the next
                person.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                How Chapa identifies a Polymath
              </h2>

              <p>
                To earn the Polymath archetype, your Breadth dimension must be strong and your
                most dominant trait. Cross-project influence is rare and valuable, so the
                algorithm gives it special consideration when multiple dimensions are close.
              </p>

              <p>
                All breadth signals are normalized with diminishing returns &mdash; having one
                viral repository won&apos;t automatically make you a Polymath. The algorithm
                values genuine diversity of contribution over raw popularity metrics.
              </p>

              <h3 className="font-heading text-sm text-text-primary tracking-tight pt-2">
                Key signals
              </h3>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">PRIMARY</span>
                  <span className="text-text-secondary text-sm">Repositories contributed to &mdash; how many different projects you touch.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">SECONDARY</span>
                  <span className="text-text-secondary text-sm">Distribution evenness &mdash; spreading work across repos, not concentrating it.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">SUPPORTING</span>
                  <span className="text-text-secondary text-sm">Community signals (stars, forks) and documentation contributions.</span>
                </div>
              </div>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                What a Polymath looks like in practice
              </h2>

              <p>
                Polymaths are often the glue developers &mdash; the engineers who move between
                teams, fix things that fall through organizational cracks, and connect people who
                should be talking to each other. They&apos;re the staff engineer who submits a PR
                to the design system on Monday, reviews a database migration on Tuesday, and writes
                an RFC for a new logging standard on Wednesday.
              </p>

              <p>
                In open source, Polymaths are the prolific contributors who show up in unexpected
                places. They file thoughtful issues on projects they don&apos;t own. They submit
                typo fixes to documentation they read once. They fork interesting repos not to
                compete but to experiment, and sometimes those experiments become PRs that the
                maintainers never expected.
              </p>

              <p>
                The value of a Polymath is often invisible in traditional metrics. Lines of code
                don&apos;t capture the developer who noticed that two teams were solving the same
                problem independently and connected them. Commit counts don&apos;t measure the
                person who improved the onboarding docs so thoroughly that the next three hires
                ramped up twice as fast.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                The Polymath&apos;s radar shape
              </h2>

              <p>
                On the Chapa radar chart, a Polymath&apos;s shape extends strongly to the left
                (Breadth axis), often with decent Building and Consistency scores creating a wide,
                wing-like silhouette. It&apos;s the radar shape of someone whose impact can&apos;t
                be measured by looking at any single repository.
              </p>
            </div>

            {/* Links */}
            <div className="pt-4 flex flex-wrap items-center gap-4">
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
