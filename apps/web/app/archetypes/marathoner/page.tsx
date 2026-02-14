import { Navbar } from "@/components/Navbar";
import { GlobalCommandBar } from "@/components/GlobalCommandBar";
import { renderBadgeSvg } from "@/lib/render/BadgeSvg";
import { MARATHONER_STATS, MARATHONER_IMPACT } from "@/lib/render/archetypeDemoData";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Marathoner Archetype",
  description:
    "Marathoners show up every day. They value consistency over intensity, sustaining contributions across months rather than shipping in bursts.",
};

const badgeSvg = renderBadgeSvg(MARATHONER_STATS, MARATHONER_IMPACT, {
  includeGithubBranding: true,
  demoMode: true,
});

export default function MarathonerPage() {
  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <Navbar />
      <main id="main-content" className="mx-auto max-w-3xl px-6 pt-32 pb-16">
        <article className="animate-fade-in-up">
          {/* Terminal command */}
          <div className="flex items-center gap-2 mb-6 font-heading text-sm">
            <span className="text-terminal-dim select-none">$</span>
            <span className="text-text-secondary">chapa archetype marathoner</span>
          </div>

          <div className="pl-4 border-l border-stroke space-y-8">
            {/* Header */}
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl tracking-tight">
                The <span className="text-terminal-green">Marathoner</span>
              </h1>
              <p className="text-text-secondary text-sm mt-2 font-heading">
                Dominant dimension: <span className="text-terminal-green">Consistency</span>
              </p>
            </div>

            {/* Badge */}
            <div
              className="rounded-xl shadow-2xl shadow-black/30 overflow-hidden [&>svg]:w-full [&>svg]:h-auto"
              role="img"
              aria-label="Example Chapa badge for The Marathoner archetype"
              dangerouslySetInnerHTML={{ __html: badgeSvg }}
            />

            {/* Essay */}
            <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
              <p>
                There&apos;s a particular kind of developer who doesn&apos;t chase heroic sprints
                or all-night hackathons. They show up on Monday and commit. They show up on
                Thursday and review. They show up the week after vacation and pick up right where
                they left off. Marathoners understand something that most productivity advice
                misses: the compound effect of steady, sustained effort over time is more powerful
                than any burst of inspiration.
              </p>

              <p>
                The Consistency dimension in Chapa measures exactly this. It looks at how often
                you show up, how evenly your contributions are spread across weeks, and whether
                your work arrives in a measured cadence or frantic bursts. A developer who
                contributes steadily across the year with even weekly distribution will score far
                higher than one who crams all their work into a single month.
              </p>

              <p>
                Heatmap evenness is particularly revealing. Chapa looks at your year and evaluates
                how uniformly your contributions are distributed. A steady, even contribution
                pattern scores well. A single burst followed by silence does not. This isn&apos;t
                about punishing time off &mdash; it&apos;s about recognizing that sustainable
                pace is itself a skill.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                How Chapa identifies a Marathoner
              </h2>

              <p>
                To earn the Marathoner archetype, your Consistency dimension must be strong and
                your most dominant trait. The algorithm rewards developers who maintain a regular
                cadence of contributions without relying on burst activity. It specifically
                distinguishes between genuine sustained work and automated or batch activity
                patterns that inflate contribution counts artificially.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                What a Marathoner looks like in practice
              </h2>

              <p>
                Marathoners are the backbone of long-running projects. They&apos;re the maintainer
                who has committed to the same repo every week for two years. The engineer who never
                has a &ldquo;catch-up Monday&rdquo; because they were never behind. The open-source
                contributor whose green squares on GitHub form a nearly unbroken line across the
                calendar.
              </p>

              <p>
                Teams with Marathoners have a different feel. There&apos;s less panic before
                deadlines because work has been flowing in steadily. There are fewer knowledge silos
                because the Marathoner has touched the code recently enough to remember how it
                works. Technical debt gets addressed in small increments instead of requiring
                dedicated &ldquo;cleanup sprints&rdquo; that never quite happen.
              </p>

              <p>
                The Marathoner&apos;s superpower isn&apos;t speed or brilliance. It&apos;s
                reliability. In a world obsessed with 10x engineers and dramatic breakthroughs, the
                Marathoner quietly delivers more total value by simply never stopping.
              </p>

              <h2 className="font-heading text-lg text-text-primary tracking-tight pt-2">
                The Marathoner&apos;s radar shape
              </h2>

              <p>
                On the Chapa radar chart, a Marathoner&apos;s shape extends strongly downward
                (Consistency axis), forming a diamond that points toward the bottom. It&apos;s the
                visual signature of someone who treats development as a practice, not a performance
                &mdash; steady, deliberate, and always moving forward.
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
