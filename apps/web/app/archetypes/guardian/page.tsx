export const revalidate = 604800;

import { Navbar } from "@/components/Navbar";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { GUARDIAN_STATS, GUARDIAN_IMPACT } from "@/lib/render/archetypeDemoData";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Quality Champion Archetype",
  description:
    "Quality Champions are the engineering discipline leaders. On teams, they review pull requests and catch bugs. Solo, they write descriptive PRs, use feature branches, and link issues. Either way, they raise the bar.",
};

const badgeSvg = renderBadgeSvg(GUARDIAN_STATS, GUARDIAN_IMPACT, {
  includeBranding: true,
  demoMode: true,
});

export default function GuardianPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <article className="animate-fade-in-up">
          {/* Terminal command */}
          <div className="flex items-center gap-2 mb-6 font-heading text-sm">
            <span className="text-terminal-dim select-none">$</span>
            <span className="text-text-secondary">chapa archetype guardian</span>
          </div>

          <div className="pl-4 border-l border-stroke space-y-8">
            {/* Header */}
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
                The <span className="text-archetype-guardian">Quality Champion</span>
              </h1>
              <p className="text-text-secondary text-sm mt-2 font-heading">
                Dominant dimension: <span className="text-archetype-guardian">Quality</span>
              </p>
            </div>

            {/* Badge */}
            {/* SAFETY: SVG is server-rendered by renderBadgeSvg() from hardcoded archetype demo data — no user input reaches this point. See lib/render/escape.ts for escaping. */}
            <div
              className="rounded-xl shadow-2xl shadow-black/30 overflow-hidden [&>svg]:w-full [&>svg]:h-auto"
              role="img"
              aria-label="Example Chapa badge for The Quality Champion archetype"
              dangerouslySetInnerHTML={{ __html: badgeSvg }}
            />

            {/* Essay */}
            <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
              <p>
                Software teams talk a lot about shipping, but rarely about the people who make sure
                what ships actually works. Quality Champions are those people. On teams, they live
                in the pull request review queue. They read diffs the way editors read manuscripts
                &mdash; not just for correctness, but for clarity, maintainability, and the subtle
                ways that today&apos;s shortcut becomes next quarter&apos;s outage.
              </p>

              <p>
                But quality isn&apos;t only a team activity. In the era of AI-assisted development,
                many capable engineers work solo &mdash; building side projects, maintaining open-source
                libraries, or freelancing. Their engineering discipline shows up differently: descriptive
                PR bodies, feature branches instead of pushing to main, issues linked to code changes,
                and clean commit histories. These habits protect a codebase whether one person works
                on it or a hundred.
              </p>

              <p>
                The Quality dimension in Chapa adapts to how you work. For collaborative developers,
                it measures review behavior &mdash; how many reviews you submit, the ratio of reviews
                to your own PRs, and code hygiene signals. For solo developers, it measures
                engineering discipline &mdash; PR descriptions, feature branch usage, issue linkage,
                and commit cleanliness.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                How Chapa identifies a Quality Champion
              </h2>

              <p>
                To earn the Quality Champion archetype, your Quality dimension must be your strongest
                and score at least 60. This applies to both collaborative and solo profiles &mdash;
                a solo developer with disciplined PR habits can absolutely be a Quality Champion.
              </p>

              <p>
                Pure reviewers who rarely open their own PRs aren&apos;t penalized. The algorithm
                recognizes that some senior engineers spend most of their time in review, and that
                contribution is immensely valuable even if it produces no commits of its own.
              </p>

              <h3 className="font-heading text-sm text-text-primary tracking-tight pt-2">
                Key signals (collaborative)
              </h3>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">PRIMARY</span>
                  <span className="text-text-secondary text-sm">Code reviews submitted &mdash; time invested in others&apos; work.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">SECONDARY</span>
                  <span className="text-text-secondary text-sm">Review-to-PR ratio &mdash; how much review vs. own shipping.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">SUPPORTING</span>
                  <span className="text-text-secondary text-sm">Batch size &mdash; fraction of PRs in the reviewable sweet spot (20-500 lines).</span>
                </div>
              </div>

              <h3 className="font-heading text-sm text-text-primary tracking-tight pt-2">
                Key signals (solo)
              </h3>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">PRIMARY</span>
                  <span className="text-text-secondary text-sm">PR description rate &mdash; how often you document what a PR does and why.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">SECONDARY</span>
                  <span className="text-text-secondary text-sm">Feature branch rate &mdash; using branches instead of pushing directly to main.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">SUPPORTING</span>
                  <span className="text-text-secondary text-sm">Issue linkage and commit cleanliness &mdash; connecting code to tracked work.</span>
                </div>
              </div>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                What a Quality Champion looks like in practice
              </h2>

              <p>
                On teams, Quality Champions are often the senior engineers, the tech leads, the staff
                developers who have shifted from writing features to multiplying the effectiveness of
                everyone around them. They&apos;re the reason your team catches the SQL injection
                before it hits production. They&apos;re the reason the junior developer&apos;s second
                PR is dramatically better than their first.
              </p>

              <p>
                Solo Quality Champions are the developers who treat their own codebase with the same
                rigor a team lead would. Every PR has a description. Every feature starts on a branch.
                Issues are linked, commits are clean. These habits compound &mdash; a year from now,
                their git history tells a story anyone can follow.
              </p>

              <p>
                In open-source projects, Quality Champions are the maintainers who triage issues, review
                community contributions, and set the quality bar that defines the project&apos;s
                reputation. Without them, codebases drift toward entropy.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                The Quality Champion&apos;s radar shape
              </h2>

              <p>
                On the Chapa radar chart, a Quality Champion&apos;s shape extends strongly to the right
                (Quality axis). The visual is a diamond that leans sideways &mdash; wide where
                quality matters, narrow where raw shipping volume might be thinner. It&apos;s the
                shape of someone who makes everyone else&apos;s code better.
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
      <GlobalCommandBarLazy />
    </div>
  );
}
