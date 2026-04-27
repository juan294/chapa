export const revalidate = 604800;

import { Navbar } from "@/components/Navbar";
import { GlobalCommandBarLazy } from "@/components/GlobalCommandBarLazy";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { ARTIFICER_STATS, ARTIFICER_IMPACT } from "@/lib/render/archetypeDemoData";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Artificer Archetype",
  description:
    "Artificers embrace AI tools to amplify their craft, achieving higher output while maintaining quality through deliberate human-AI collaboration.",
};

const badgeSvg = renderBadgeSvg(ARTIFICER_STATS, ARTIFICER_IMPACT, {
  includeBranding: true,
  demoMode: true,
});

export default function ArtificerPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <article className="animate-fade-in-up">
          {/* Terminal command */}
          <div className="flex items-center gap-2 mb-6 font-heading text-sm">
            <span className="text-terminal-dim select-none">$</span>
            <span className="text-text-secondary">chapa archetype artificer</span>
          </div>

          <div className="pl-4 border-l border-stroke space-y-8">
            {/* Header */}
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
                The <span className="text-amber">Artificer</span>
              </h1>
              <p className="text-text-secondary text-sm mt-2 font-heading">
                Dominant dimension: <span className="text-amber">Craft</span>
              </p>
            </div>

            {/* Badge */}
            {/* SAFETY: SVG is server-rendered by renderBadgeSvg() from hardcoded archetype demo data — no user input reaches this point. See lib/render/escape.ts for escaping. */}
            <div
              className="rounded-xl shadow-2xl shadow-black/30 overflow-hidden [&>svg]:w-full [&>svg]:h-auto"
              role="img"
              aria-label="Example Chapa badge for The Artificer archetype"
              dangerouslySetInnerHTML={{ __html: badgeSvg }}
            />

            {/* Essay */}
            <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
              <p>
                Software development has always been a craft of leverage &mdash; compilers, frameworks,
                version control, each layer letting one person accomplish what once required many. The
                Artificer represents the latest evolution of that principle. They are developers who
                have learned to wield AI coding assistants not as a crutch, but as a multiplier. Where
                others type, the Artificer orchestrates. Where others context-switch between documentation
                and editor, the Artificer holds a conversation with a tool that already understands the
                codebase. The result is not less skill, but more of it &mdash; applied across a wider
                surface in less time.
              </p>

              <p>
                What makes an Artificer distinct from someone who merely uses AI tools is intentionality.
                Chapa&apos;s Craft dimension does not reward raw output &mdash; it rewards deliberate,
                quality-sustained output that emerges from human-AI collaboration. An Artificer reviews
                what their tools produce. They steer sessions toward architectural goals, catch hallucinated
                logic before it reaches a pull request, and use the time they save to invest in code
                review, documentation, and test coverage. The collaboration is genuine: the human provides
                judgment, context, and taste; the AI provides speed, recall, and tireless iteration. Neither
                alone would produce the same result.
              </p>

              <p>
                This archetype challenges the assumption that high throughput implies low quality. An
                Artificer&apos;s badge often shows a prominent Craft spike alongside respectable Delivery
                and Quality scores &mdash; evidence that they are not cutting corners, but finding better
                paths. As AI tools become part of every developer&apos;s toolkit, the Artificer archetype
                recognizes those who adopted early, adopted well, and proved that the future of software
                is not human or machine, but human <em>with</em> machine, each making the other better.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                How Chapa identifies an Artificer
              </h2>

              <p>
                To earn the Artificer archetype, your Craft dimension must be your strongest trait.
                Craft is a special fifth dimension that activates when Chapa detects AI tool usage data
                &mdash; session counts, tool call volumes, and collaboration patterns. The algorithm
                evaluates not just how much you use AI tools, but how effectively: high output with
                sustained quality signals genuine craft, while volume without substance does not.
              </p>

              <h3 className="font-heading text-sm text-text-primary tracking-tight pt-2">
                Key signals
              </h3>
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">PRIMARY</span>
                  <span className="text-text-secondary text-sm">AI tool session volume and depth &mdash; sustained, multi-session collaboration.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">SECONDARY</span>
                  <span className="text-text-secondary text-sm">Quality maintenance &mdash; output quality stays high despite increased throughput.</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                  <span className="text-amber font-heading text-sm shrink-0 sm:w-36">SUPPORTING</span>
                  <span className="text-text-secondary text-sm">Delivery uplift &mdash; merged PRs and closed issues reflect amplified productivity.</span>
                </div>
              </div>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                What an Artificer looks like in practice
              </h2>

              <p>
                Picture the developer who opens their AI assistant first thing in the morning, not to
                generate boilerplate, but to reason through a complex migration strategy. They pair
                with the tool on test scaffolding, use it to explore unfamiliar APIs, and lean on it
                for code review suggestions before their human teammates even see the PR. Their commit
                history shows a consistent rhythm of well-structured, well-tested contributions &mdash;
                the kind of output that looks effortless but is actually the product of a carefully
                tuned workflow.
              </p>

              <p>
                Artificers pair naturally with every other archetype. They complement Builders by
                sustaining velocity without burning out, support Quality Champions by catching issues
                earlier in the cycle, and extend Polymaths by making it feasible to contribute
                meaningfully across even more repositories.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                The Artificer&apos;s radar shape
              </h2>

              <p>
                On the Chapa radar chart, an Artificer&apos;s shape is a pentagon with a distinctive
                spike toward the Craft axis. The other four dimensions are typically well-rounded &mdash;
                Artificers tend to be competent across the board, with Craft pulling the shape into
                a clear asymmetry that signals their defining trait: the ability to accomplish more
                through deliberate human-AI partnership.
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
