"use client";

import Link from "next/link";
import type { ImpactV4Result, StatsData } from "@chapa/shared";
import { DataSources } from "@/components/ImpactBreakdown";
import { ImpactDashboard } from "@/components/dashboard/ImpactDashboard";
import { CopyButton } from "@/components/CopyButton";
import { useSession } from "@/hooks/useSession";
import { useOwnerCacheWarm } from "@/hooks/useOwnerCacheWarm";

/**
 * Client-side component that handles owner-specific sections on the share page.
 *
 * Uses the shared `useSession()` hook to determine if the viewer is
 * the profile owner. This avoids redundant `/api/auth/session` fetches
 * when multiple components on the share page need session data.
 *
 * Sections rendered:
 * - Owner: DataSources, ImpactDashboard, Embed Snippets
 * - Visitor: "Discover your impact" CTA
 */

interface SharePageOwnerContentProps {
  handle: string;
  stats: StatsData | null;
  impact: ImpactV4Result | null;
}

export function SharePageOwnerContent({
  handle,
  stats,
  impact,
}: SharePageOwnerContentProps) {
  const { session, loading } = useSession();
  const isOwner = !loading && session?.login === handle;

  // Warm cache with OAuth data when owner visits (once per session)
  useOwnerCacheWarm(handle, isOwner);

  // Still loading session — show nothing to avoid layout shift
  if (loading) return null;

  const embedMarkdown = `![Chapa Badge](https://chapa.thecreativetoken.com/u/${handle}/badge.svg)`;
  const embedHtml = `<img src="https://chapa.thecreativetoken.com/u/${handle}/badge.svg" alt="Chapa Badge for ${handle}" width="600" height="315" />`;

  if (!isOwner) {
    return (
      <section className="mb-10 animate-fade-in-up [animation-delay:300ms]">
        <div className="rounded-2xl border border-stroke bg-card p-6 sm:p-8 text-center">
          <h2 className="font-heading text-lg sm:text-xl font-bold text-text-primary tracking-tight mb-2 text-balance">
            Curious what your developer impact looks like?
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-md mx-auto text-pretty">
            Decode your coding DNA in seconds. See your archetype, impact score, and how you compare.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-amber pl-6 pr-5 py-3 text-sm font-semibold text-white hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 transition-all"
          >
            Discover your impact
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <hr className="border-stroke mb-10" />

      {/* Data Sources */}
      {stats && (
        <section className="mb-10 animate-fade-in-up [animation-delay:260ms]">
          <DataSources stats={stats} handle={handle} />
        </section>
      )}

      <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-8 animate-fade-in-up [animation-delay:280ms]">
        Impact Breakdown
      </h2>

      {/* Impact Dashboard */}
      {impact && stats ? (
        <section className="mb-12 animate-fade-in-up [animation-delay:350ms]">
          <ImpactDashboard impact={impact} stats={stats} handle={handle} />
        </section>
      ) : (
        <section className="mb-12 animate-fade-in-up [animation-delay:350ms]">
          <div className="rounded-2xl border border-stroke bg-card p-8">
            <p className="text-text-secondary">
              Could not load impact data for this user. Try again later.
            </p>
          </div>
        </section>
      )}

      {/* Embed Snippets */}
      <section className="space-y-6 animate-fade-in-up [animation-delay:500ms]">
        <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary">
          Embed This Badge
        </h2>

        {/* Markdown snippet */}
        <div className="rounded-xl border border-stroke bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-stroke">
            <div className="w-2.5 h-2.5 rounded-full bg-terminal-red/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-terminal-yellow/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-terminal-green/60" />
            <span className="ml-2 text-xs text-terminal-dim font-heading">
              Markdown
            </span>
            <div className="ml-auto">
              <CopyButton text={embedMarkdown} />
            </div>
          </div>
          <div className="p-4 font-heading text-xs sm:text-sm leading-relaxed overflow-x-auto">
            <p className="text-text-primary/80 whitespace-nowrap">
              <span className="text-amber">{"![Chapa Badge]("}</span>
              <span className="text-text-secondary">
                {`https://chapa.thecreativetoken.com/u/${handle}/badge.svg`}
              </span>
              <span className="text-amber">{")"}</span>
            </p>
          </div>
        </div>

        {/* HTML snippet */}
        <div className="rounded-xl border border-stroke bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-stroke">
            <div className="w-2.5 h-2.5 rounded-full bg-terminal-red/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-terminal-yellow/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-terminal-green/60" />
            <span className="ml-2 text-xs text-terminal-dim font-heading">
              HTML
            </span>
            <div className="ml-auto">
              <CopyButton text={embedHtml} />
            </div>
          </div>
          <div className="p-4 font-heading text-xs sm:text-sm leading-relaxed overflow-x-auto">
            <p className="text-text-primary/80 whitespace-nowrap">
              <span className="text-amber">{"<img "}</span>
              <span className="text-text-secondary">{"src="}</span>
              <span className="text-amber/70">{`"https://chapa.thecreativetoken.com/u/${handle}/badge.svg"`}</span>
              <span className="text-text-secondary">{" alt="}</span>
              <span className="text-amber/70">{`"Chapa Badge for ${handle}"`}</span>
              <span className="text-text-secondary">{" width="}</span>
              <span className="text-amber/70">{'"600"'}</span>
              <span className="text-text-secondary">{" height="}</span>
              <span className="text-amber/70">{'"315"'}</span>
              <span className="text-amber">{" />"}</span>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
