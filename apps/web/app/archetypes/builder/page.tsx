import { Navbar } from "@/components/Navbar";
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { BUILDER_STATS, BUILDER_IMPACT } from "@/lib/render/archetypeDemoData";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Builder Archetype",
  description:
    "Builders are the shipping engine of every team. They turn ideas into merged pull requests, close issues, and move codebases forward.",
};

const badgeSvg = renderBadgeSvg(BUILDER_STATS, BUILDER_IMPACT, {
  includeGithubBranding: true,
  demoMode: true,
});

export default function BuilderPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <article className="animate-fade-in-up">
          {/* Terminal command */}
          <div className="flex items-center gap-2 mb-6 font-heading text-sm">
            <span className="text-terminal-dim select-none">$</span>
            <span className="text-text-secondary">chapa archetype builder</span>
          </div>

          <div className="pl-4 border-l border-stroke space-y-8">
            {/* Header */}
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
                The <span className="text-amber">Builder</span>
              </h1>
              <p className="text-text-secondary text-sm mt-2 font-heading">
                Dominant dimension: <span className="text-amber">Building</span>
              </p>
            </div>

            {/* Badge */}
            <div
              className="rounded-xl shadow-2xl shadow-black/30 overflow-hidden [&>svg]:w-full [&>svg]:h-auto"
              role="img"
              aria-label="Example Chapa badge for The Builder archetype"
              dangerouslySetInnerHTML={{ __html: badgeSvg }}
            />

            {/* Essay */}
            <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
              <p>
                Every codebase has a gravitational center, and more often than not, a Builder is
                standing at it. Builders are the shipping engine of a team. They take the backlog,
                the vague requirements, the half-formed ideas scribbled on a whiteboard, and they
                turn all of it into merged pull requests. When you look at a project&apos;s commit
                graph and see that steady upward trajectory of features landing, a Builder is
                usually the reason.
              </p>

              <p>
                What distinguishes a Builder from someone who simply writes a lot of code is
                <em> intent</em>. Builders don&apos;t just commit. They ship. Their pull requests get
                merged because they solve real problems. Their issues get closed because they
                follow through. The Building dimension in Chapa deliberately prioritizes outcomes
                over activity &mdash; merged PRs matter most, followed by closed issues, with
                raw commit volume weighted least.
              </p>

              <p>
                This means a developer who merges thoughtful pull requests will outscore one who
                pushes hundreds of micro-commits that never leave a feature branch. Builders understand
                that code has no value sitting in a branch. The goal is always the merge, the deploy,
                the user seeing the change.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                How Chapa identifies a Builder
              </h2>

              <p>
                To earn the Builder archetype, your Building dimension must be strong and your
                most dominant trait. The algorithm looks at your last 12 months of GitHub activity
                and evaluates the weight and frequency of your merged PRs, your issue closure rate,
                and your commit volume &mdash; all normalized so that early contributions count
                more and diminishing returns kick in naturally.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                What a Builder looks like in practice
              </h2>

              <p>
                Picture the developer who owns the sprint board. The one who picks up three tickets
                on Monday and has PRs open by Wednesday. They might not write the most elegant
                abstractions or the most thorough test suites, but when the team needs momentum,
                they deliver. Startups love Builders because velocity is oxygen in the early days.
                Mature teams rely on them to keep the feature roadmap moving when process overhead
                threatens to slow everything down.
              </p>

              <p>
                Builders often pair well with Guardians &mdash; the Builder ships fast, the Guardian
                reviews carefully, and together they find a rhythm that balances speed with quality.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                The Builder&apos;s radar shape
              </h2>

              <p>
                On the Chapa radar chart, a Builder&apos;s shape leans heavily toward the top
                (Building axis), often with moderate Consistency and Breadth, and a thinner Guarding
                profile. The visual signature is unmistakable: a diamond that points upward, like an
                arrow aimed at the next release.
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
