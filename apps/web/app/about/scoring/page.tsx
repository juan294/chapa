import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
import { isScoringPageEnabled } from "@/lib/feature-flags";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scoring Methodology",
  description:
    "How Chapa decodes your developer impact. Every dimension, weight, cap, and confidence penalty explained with full rationale.",
  openGraph: {
    title: "Chapa Scoring Methodology",
    description:
      "Full transparency on how the four-dimension Impact Profile is calculated. Every weight and decision explained.",
  },
  twitter: {
    card: "summary",
    title: "Chapa Scoring Methodology",
    description:
      "Full transparency on how the Impact Profile is calculated.",
  },
};

/* ---------------------------------------------------------------------- */
/* Reusable sub-components                                                 */
/* ---------------------------------------------------------------------- */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading text-xl sm:text-2xl font-semibold text-text-primary tracking-tight pt-8 pb-2">
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-heading text-lg font-medium text-text-primary tracking-tight pt-4 pb-1">
      {children}
    </h3>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-stroke">
            {headers.map((h) => (
              <th
                key={h}
                className="text-left py-2 px-3 font-heading text-text-primary font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-stroke/50">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`py-2 px-3 ${j === 0 ? "text-text-primary font-medium" : "text-text-secondary"}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Page                                                                    */
/* ---------------------------------------------------------------------- */

export default function ScoringMethodologyPage() {
  if (!isScoringPageEnabled()) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      <main
        id="main-content"
        className="relative mx-auto max-w-3xl px-6 pt-32 pb-24"
      >
        <div className="relative">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-4 animate-fade-in-up">
            Scoring Methodology
            <span className="text-amber animate-cursor-blink">_</span>
          </h1>

          <p className="text-text-secondary text-lg mb-8 animate-fade-in-up [animation-delay:100ms]">
            Full transparency on how Chapa decodes your developer impact.
            Every weight, cap, and decision is explained here.
          </p>

          <div className="space-y-2 text-text-secondary leading-relaxed animate-fade-in-up [animation-delay:200ms]">
            {/* ---------------------------------------------------------- */}
            {/* Philosophy                                                  */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>Philosophy</SectionHeading>
            <p>
              AI-assisted development makes traditional volume metrics — commits,
              lines of code, PR counts — increasingly meaningless. A single
              number that blends everything together hides the difference between
              a prolific code shipper and a dedicated reviewer.
            </p>
            <p>
              Impact v4 replaces that single number with a{" "}
              <strong className="text-text-primary">
                multi-dimensional impact breakdown
              </strong>
              : four independent dimension scores (each 0-100), a developer
              archetype, a composite score, and a confidence rating. Each
              contribution style can shine on its own terms.
            </p>

            {/* ---------------------------------------------------------- */}
            {/* Normalization                                               */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>Normalization</SectionHeading>
            <p>
              Most raw metrics are transformed using{" "}
              <strong className="text-text-primary">
                logarithmic normalization
              </strong>{" "}
              to reward genuine contribution while making gaming impractical:
            </p>
            <div className="my-4 rounded-lg border border-stroke bg-card p-4 font-heading text-sm text-text-primary">
              f(x, cap) = ln(1 + min(x, cap)) / ln(1 + cap)
            </div>
            <p>
              This produces a value between 0 and 1. The logarithmic curve means
              early contributions add significant value, but volume beyond the
              cap has zero effect. Pushing 1,000 commits does not produce a
              score 10x higher than 100 commits.
            </p>

            {/* ---------------------------------------------------------- */}
            {/* Caps                                                        */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>Signal caps</SectionHeading>
            <p>
              Each signal has a cap — the point beyond which additional volume
              adds nothing. This is the primary anti-gaming mechanism.
            </p>
            <Table
              headers={["Signal", "Cap", "Rationale"]}
              rows={[
                [
                  "Commits",
                  "600",
                  "~1.6/day average is strong; more adds no extra credit",
                ],
                [
                  "PR Weight",
                  "120",
                  "Weighted by complexity, not count; cap prevents inflation",
                ],
                [
                  "Reviews",
                  "180",
                  "Encourages collaboration without requiring extreme volume",
                ],
                [
                  "Issues",
                  "80",
                  "Meaningful issue resolution, not ticket churn",
                ],
                [
                  "Repos",
                  "15",
                  "Cross-project work beyond 15 repos is fully credited",
                ],
                [
                  "Stars",
                  "500",
                  "Community recognition; most abundant social signal",
                ],
                [
                  "Forks",
                  "200",
                  "People building on your work; less common than stars",
                ],
                [
                  "Watchers",
                  "100",
                  "Active repo followers; least common community signal",
                ],
              ]}
            />

            {/* ---------------------------------------------------------- */}
            {/* The four dimensions                                         */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>The four dimensions</SectionHeading>
            <p>
              Each dimension is scored 0-100 independently. A dimension returns
              0 when its primary signal is completely absent.
            </p>

            {/* Building */}
            <SubHeading>Building — shipping meaningful changes</SubHeading>
            <Table
              headers={["Signal", "Weight", "Rationale"]}
              rows={[
                [
                  "PR Weight",
                  "70%",
                  "Merged PRs weighted by file count and line changes are the strongest signal of meaningful code shipped",
                ],
                [
                  "Issues Closed",
                  "20%",
                  "Resolving issues shows end-to-end ownership from problem to solution",
                ],
                [
                  "Commits",
                  "10%",
                  "Raw commit count is the weakest signal — easy to inflate, so it gets the lowest weight",
                ],
              ]}
            />
            <p>
              PR weight is not a simple count. Each merged PR is weighted by its
              size and complexity, capped at 3.0 per PR to prevent a single
              massive PR from dominating.
            </p>

            {/* Guarding */}
            <SubHeading>
              Guarding — reviewing and quality gatekeeping
            </SubHeading>
            <Table
              headers={["Signal", "Weight", "Rationale"]}
              rows={[
                [
                  "Reviews Submitted",
                  "60%",
                  "The core signal — how much time you spend reviewing others' code",
                ],
                [
                  "Review-to-PR Ratio",
                  "25%",
                  "A high ratio means you review more than you ship, signaling a quality-focused role. Capped at 5:1",
                ],
                [
                  "Inverse Micro-commit Ratio",
                  "15%",
                  "Low micro-commit ratio indicates thoughtful, well-structured changes rather than many tiny commits",
                ],
              ]}
            />
            <p>
              Returns 0 if you have zero reviews. Solo developers who never
              review are not penalized — their composite score excludes Guarding
              entirely and averages the remaining three dimensions.
            </p>

            {/* Consistency */}
            <SubHeading>
              Consistency — reliable, sustained contributions
            </SubHeading>
            <Table
              headers={["Signal", "Weight", "Rationale"]}
              rows={[
                [
                  "Active Days / 365",
                  "50%",
                  "The most direct measure of sustained contribution — how many days out of the year you were active",
                ],
                [
                  "Heatmap Evenness",
                  "35%",
                  "Measures how evenly activity is distributed across weeks. A steady rhythm scores higher than concentrated bursts",
                ],
                [
                  "Inverse Burst Activity",
                  "15%",
                  "Penalizes high max-commits-in-10-minutes. Steady work patterns produce higher consistency scores",
                ],
              ]}
            />
            <p>
              Heatmap evenness uses the inverted coefficient of variation across
              weekly totals. Perfectly uniform activity scores 1.0; a single
              burst week scores ~0.2.
            </p>

            {/* Breadth */}
            <SubHeading>Breadth — cross-project influence</SubHeading>
            <Table
              headers={["Signal", "Weight", "Rationale"]}
              rows={[
                [
                  "Repos Contributed",
                  "35%",
                  "The most direct measure of cross-project work — how many different repos you actively contributed to",
                ],
                [
                  "Inverse Top-repo Share",
                  "25%",
                  "Rewards diverse contribution across repos rather than concentration in one. If 95% of your work is in one repo, this approaches 0",
                ],
                [
                  "Stars",
                  "15%",
                  "Broadest community recognition signal. High star counts reliably indicate work that resonated with a wide audience",
                ],
                [
                  "Forks",
                  "10%",
                  "Deeper engagement than stars — someone intends to build on your work. Narrower and noisier signal (people fork for many reasons)",
                ],
                [
                  "Watchers",
                  "5%",
                  "Most passive community signal. Indicates ongoing interest but weakest indicator of actual influence",
                ],
                [
                  "Docs-only PR Ratio",
                  "10%",
                  "Documentation contributions show breadth of involvement beyond code",
                ],
              ]}
            />
            <p>
              The community signals (stars, forks, watchers) follow a deliberate
              hierarchy:{" "}
              <strong className="text-text-primary">
                broad recognition &gt; active reuse intent &gt; passive interest
              </strong>
              . Stars are the most abundant and reliable indicator of influence.
              Forks represent deeper but noisier engagement. Watchers are the
              smallest population and most passive signal.
            </p>

            {/* ---------------------------------------------------------- */}
            {/* Archetypes                                                  */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>Developer archetypes</SectionHeading>
            <p>
              Your archetype is derived from the shape of your dimension
              profile. It tells you what kind of developer you are, not how good
              you are.
            </p>
            <Table
              headers={["Archetype", "Rule", "What it means"]}
              rows={[
                [
                  "Emerging",
                  "Average < 40 OR no dimension >= 50",
                  "Getting started or light activity period",
                ],
                [
                  "Balanced",
                  "All dimensions within 15 pts AND avg >= 60",
                  "Well-rounded contributor across all areas",
                ],
                [
                  "Polymath",
                  "Breadth is highest AND >= 70",
                  "Cross-project influence is your strongest suit",
                ],
                [
                  "Guardian",
                  "Guarding is highest AND >= 70",
                  "You spend significant time reviewing and gatekeeping quality",
                ],
                [
                  "Marathoner",
                  "Consistency is highest AND >= 70",
                  "Your most notable trait is sustained, reliable contribution",
                ],
                [
                  "Builder",
                  "Building is highest AND >= 70",
                  "You ship a high volume of meaningful code changes",
                ],
              ]}
            />
            <p>
              Tie-breaking priority: Polymath &gt; Guardian &gt; Marathoner &gt;
              Builder. If no specific archetype matches (highest dimension &lt;
              70 and not Balanced), the fallback is Emerging.
            </p>

            {/* ---------------------------------------------------------- */}
            {/* Composite score and tiers                                   */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>Composite score and tiers</SectionHeading>
            <p>
              The composite score is the average of all four dimensions (or
              three for solo developers who have zero reviews), rounded to an
              integer. It is then adjusted by confidence:
            </p>
            <div className="my-4 rounded-lg border border-stroke bg-card p-4 font-heading text-sm text-text-primary">
              adjustedScore = compositeScore × (0.85 + 0.15 × confidence / 100)
            </div>
            <p>
              At full confidence (100), there is no reduction. At minimum
              confidence (50), the reduction is only 7.5% — deliberate and
              gentle.
            </p>
            <Table
              headers={["Tier", "Score Range", "Description"]}
              rows={[
                [
                  "Emerging",
                  "0 – 39",
                  "Getting started or light activity period",
                ],
                [
                  "Solid",
                  "40 – 69",
                  "Consistent, meaningful contributions",
                ],
                [
                  "High",
                  "70 – 84",
                  "Strong impact across multiple dimensions",
                ],
                [
                  "Elite",
                  "85 – 100",
                  "Exceptional breadth and depth of contribution",
                ],
              ]}
            />

            {/* ---------------------------------------------------------- */}
            {/* Confidence system                                           */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>Confidence system</SectionHeading>
            <p>
              Confidence (50-100) measures{" "}
              <strong className="text-text-primary">signal clarity</strong>, not
              morality. A low confidence score never accuses wrongdoing — it
              simply means the data patterns make it harder to assess impact
              precisely.
            </p>
            <p>
              Confidence starts at 100 and can be reduced by detected patterns:
            </p>
            <Table
              headers={["Pattern", "Penalty", "Trigger", "What it means"]}
              rows={[
                [
                  "Burst activity",
                  "-15",
                  "20+ commits in a 10-minute window",
                  "Activity concentrated in short bursts reduces timing confidence",
                ],
                [
                  "Micro-commits",
                  "-10",
                  "60%+ of commits are very small",
                  "Many tiny changes reduce signal clarity",
                ],
                [
                  "Generated changes",
                  "-15",
                  "20,000+ lines changed AND fewer than 3 reviews",
                  "Large volume with limited review suggests possible automation",
                ],
                [
                  "Low collaboration",
                  "-10",
                  "10+ PRs merged AND 1 or fewer reviews given",
                  "Significant output without peer interaction",
                ],
                [
                  "Single repo focus",
                  "-5",
                  "95%+ of activity in one repo AND only 1 repo",
                  "Less cross-project signal (not bad, just less diverse data)",
                ],
                [
                  "Supplemental data",
                  "-5",
                  "Includes merged EMU account data",
                  "Data from a linked account that cannot be independently verified",
                ],
              ]}
            />
            <p>
              The confidence floor is{" "}
              <strong className="text-text-primary">50</strong>. No combination
              of penalties can push confidence below 50. All messaging is
              non-accusatory — we describe patterns, not intent.
            </p>

            {/* ---------------------------------------------------------- */}
            {/* What we don't use                                           */}
            {/* ---------------------------------------------------------- */}
            <SectionHeading>What we deliberately exclude</SectionHeading>
            <p>
              Some signals are intentionally left out of scoring:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong className="text-text-primary">Followers</strong> — a
                social metric with no correlation to engineering output
              </li>
              <li>
                <strong className="text-text-primary">Lines of code</strong> —
                easily gamed; used only for confidence heuristics, never for
                dimension scoring
              </li>
              <li>
                <strong className="text-text-primary">
                  Private repo names
                </strong>{" "}
                — we track repo count, not identities. Your private repos are
                never exposed
              </li>
            </ul>

            {/* ---------------------------------------------------------- */}
            {/* CTA                                                         */}
            {/* ---------------------------------------------------------- */}
            <div className="mt-16 rounded-xl border border-stroke bg-card p-6 sm:p-8">
              <h2 className="font-heading text-xl font-semibold text-text-primary tracking-tight mb-3">
                Help us improve this
              </h2>
              <p className="mb-4">
                We believe scoring methodology should be a conversation, not a
                black box. If you have ideas on how to make this fairer, more
                accurate, or more transparent — we want to hear from you.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="https://x.com/juang294"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-amber px-6 py-3 text-sm font-semibold text-white hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 transition-all"
                >
                  Reach out on X (@juang294)
                </a>
                <a
                  href="mailto:support@chapa.thecreativetoken.com"
                  className="inline-flex items-center justify-center rounded-lg border border-stroke px-6 py-3 text-sm font-medium text-text-secondary hover:border-amber/20 hover:text-text-primary transition-all"
                >
                  Email support@chapa.thecreativetoken.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <GlobalCommandBar />
    </div>
  );
}
