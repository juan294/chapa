import { Navbar } from "@/components/Navbar";
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { GUARDIAN_STATS, GUARDIAN_IMPACT } from "@/lib/render/archetypeDemoData";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Guardian Archetype",
  description:
    "Guardians are the quality gatekeepers. They review pull requests, catch bugs before they ship, and raise the bar for everyone around them.",
};

const badgeSvg = renderBadgeSvg(GUARDIAN_STATS, GUARDIAN_IMPACT, {
  includeGithubBranding: true,
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
                The <span className="text-archetype-guardian">Guardian</span>
              </h1>
              <p className="text-text-secondary text-sm mt-2 font-heading">
                Dominant dimension: <span className="text-archetype-guardian">Guarding</span>
              </p>
            </div>

            {/* Badge */}
            <div
              className="rounded-xl shadow-2xl shadow-black/30 overflow-hidden [&>svg]:w-full [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: badgeSvg }}
            />

            {/* Essay */}
            <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
              <p>
                Software teams talk a lot about shipping, but rarely about the people who make sure
                what ships actually works. Guardians are those people. They live in the pull request
                review queue. They read diffs the way editors read manuscripts &mdash; not just for
                correctness, but for clarity, maintainability, and the subtle ways that today&apos;s
                shortcut becomes next quarter&apos;s outage.
              </p>

              <p>
                The Guarding dimension in Chapa measures review behavior, not just review count.
                It considers how many reviews you submit, the ratio of reviews to your own PRs,
                and code hygiene signals. A developer who reviews multiple PRs for every one they
                open scores higher than someone who rubber-stamps approvals to unblock the pipeline.
              </p>

              <p>
                This is intentional. The best code reviewers don&apos;t just click &ldquo;Approve.&rdquo;
                They leave comments that teach. They catch race conditions that tests miss. They
                ask the question that makes the author realize the entire approach needs rethinking
                &mdash; and they do it with enough tact that the author is grateful rather than
                defensive.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                How Chapa identifies a Guardian
              </h2>

              <p>
                To earn the Guardian archetype, your Guarding dimension must be strong and your
                most dominant trait. There&apos;s an important constraint: the Guardian archetype
                is only available to collaborative profiles. If you work solo and have zero code
                reviews, Chapa won&apos;t assign you as a Guardian &mdash; because guarding is
                fundamentally a team activity.
              </p>

              <p>
                Pure reviewers who rarely open their own PRs aren&apos;t penalized. The algorithm
                recognizes that some senior engineers spend most of their time in review, and that
                contribution is immensely valuable even if it produces no commits of its own.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                What a Guardian looks like in practice
              </h2>

              <p>
                Guardians are often the senior engineers, the tech leads, the staff developers who
                have shifted from writing features to multiplying the effectiveness of everyone
                around them. They&apos;re the reason your team catches the SQL injection before it
                hits production. They&apos;re the reason the junior developer&apos;s second PR is
                dramatically better than their first.
              </p>

              <p>
                In open-source projects, Guardians are the maintainers who triage issues, review
                community contributions, and set the quality bar that defines the project&apos;s
                reputation. Without them, codebases drift toward entropy.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                The Guardian&apos;s radar shape
              </h2>

              <p>
                On the Chapa radar chart, a Guardian&apos;s shape extends strongly to the right
                (Guarding axis). The visual is a diamond that leans sideways &mdash; wide where
                quality matters, narrow where raw shipping volume might be thinner. It&apos;s the
                shape of someone who makes everyone else&apos;s code better.
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
