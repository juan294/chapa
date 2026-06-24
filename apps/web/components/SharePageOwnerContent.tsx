"use client";

import Link from "next/link";
import { useState } from "react";
import type { ImpactV6Result, StatsData } from "@chapa/shared";
import { DataSources } from "@/components/ImpactBreakdown";
import { ImpactDashboard } from "@/components/dashboard/ImpactDashboard";
import { ScoreExplanationPanel } from "@/components/dashboard/ScoreExplanationPanel";
import { CopyButton } from "@/components/CopyButton";
import { useSession } from "@/hooks/useSession";
import { useOwnerCacheWarm } from "@/hooks/useOwnerCacheWarm";
import { useTranslation } from "@/lib/i18n";

/**
 * Client-side component that renders public share-page sections plus owner-only
 * cache warming.
 *
 * Uses the shared `useSession()` hook to determine if the viewer is
 * the profile owner. This avoids redundant `/api/auth/session` fetches
 * when multiple components on the share page need session data.
 *
 * Sections rendered:
 * - Public: DataSources, ImpactDashboard, Embed Snippets
 * - Owner-only: OAuth-backed cache warm
 * - Visitor: i18n-aware acquisition CTA
 */

function EmptyImpactState({ handle }: { handle: string }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleRegenerate() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/refresh?handle=${encodeURIComponent(handle)}`, {
        method: "POST",
      });
      if (res.ok) {
        setStatus("success");
        setTimeout(() => window.location.reload(), 800);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="mb-12 animate-fade-in-up motion-reduce:animate-none [animation-delay:350ms]">
      <div className="rounded-2xl border border-stroke bg-card p-8 space-y-4">
        <p className="text-text-secondary text-sm">
          {t('shareOwner.emptyState') as string}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={status === "loading" || status === "success"}
            aria-busy={status === "loading"}
            aria-label={status === "loading" ? (t('shareOwner.ariaBusy') as string) : undefined}
            className="inline-flex items-center gap-2 rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-white transition-all motion-reduce:transition-none hover:bg-amber-light disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "loading"
              ? t('shareOwner.regenerating') as string
              : status === "success"
                ? t('shareOwner.ready') as string
                : t('shareOwner.regenerate') as string}
          </button>
          {status === "error" && (
            <p className="text-terminal-red text-xs">
              {t('shareOwner.regenerateError') as string}{" "}
              <a
                href={`mailto:support@thecreativetoken.com?subject=Badge%20data%20issue%20for%20%40${encodeURIComponent(handle)}`}
                className="underline hover:text-terminal-red/80 transition-colors motion-reduce:transition-none"
              >
                {t('shareOwner.contactSupport') as string}
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

interface SharePageOwnerContentProps {
  handle: string;
  stats: StatsData | null;
  impact: ImpactV6Result | null;
}

export function SharePageOwnerContent({
  handle,
  stats,
  impact,
}: SharePageOwnerContentProps) {
  const { t } = useTranslation();
  const { session, loading } = useSession();
  const isOwner = !loading && session?.login === handle;
  const isVisitor = !loading && !isOwner;

  // Warm cache with OAuth data when owner visits (once per session)
  useOwnerCacheWarm(handle, isOwner);

  const badgeUrl = `https://chapa.thecreativetoken.com/u/${handle}/badge.svg`;
  const badgeAlt = t('shareOwner.badgeAlt') as string;
  const badgeAltOf = t('shareOwner.badgeAltOf') as string;
  const embedMarkdown = `![${badgeAlt}](${badgeUrl})`;
  const embedHtml = `<img src="${badgeUrl}" alt="${badgeAltOf} ${handle}" width="600" height="315" />`;

  return (
    <>
      <hr className="border-stroke mb-10" />

      {/* Data Sources */}
      {stats && (
        <section className="mb-10 animate-fade-in-up motion-reduce:animate-none [animation-delay:260ms]">
          <DataSources stats={stats} handle={handle} />
        </section>
      )}

      <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary mb-8 animate-fade-in-up motion-reduce:animate-none [animation-delay:280ms]">
        {t('shareOwner.impactBreakdown') as string}
      </h2>

      {/* Impact Dashboard */}
      {impact && stats ? (
        <section className="mb-12 animate-fade-in-up motion-reduce:animate-none [animation-delay:350ms]">
          <ImpactDashboard impact={impact} stats={stats} handle={handle} />
        </section>
      ) : (
        <EmptyImpactState handle={handle} />
      )}

      {impact && stats && (
        <section className="mb-12 animate-fade-in-up motion-reduce:animate-none [animation-delay:430ms]">
          <ScoreExplanationPanel impact={impact} stats={stats} isOwner={isOwner} />
        </section>
      )}

      {/* Embed Snippets */}
      <section className="space-y-6 animate-fade-in-up motion-reduce:animate-none [animation-delay:500ms]">
        <h2 className="font-heading text-xs tracking-[0.2em] uppercase text-text-secondary">
          {t('shareOwner.embedBadge') as string}
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
              <span className="text-amber">{`![${badgeAlt}](`}</span>
              <span className="text-text-secondary">
                {badgeUrl}
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
              <span className="text-amber/70">{`"${badgeUrl}"`}</span>
              <span className="text-text-secondary">{" alt="}</span>
              <span className="text-amber/70">{`"${badgeAltOf} ${handle}"`}</span>
              <span className="text-text-secondary">{" width="}</span>
              <span className="text-amber/70">{'"600"'}</span>
              <span className="text-text-secondary">{" height="}</span>
              <span className="text-amber/70">{'"315"'}</span>
              <span className="text-amber">{" />"}</span>
            </p>
          </div>
        </div>
      </section>

      {isVisitor && (
        <section className="mt-10 animate-fade-in-up motion-reduce:animate-none [animation-delay:560ms]">
          <div className="rounded-2xl border border-stroke bg-card p-6 sm:p-8 text-center">
            <h2 className="font-heading text-lg sm:text-xl font-bold text-text-primary tracking-tight mb-2 text-balance">
              {t('shareVisitor.title') as string}
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-6 max-w-md mx-auto text-pretty">
              {t('shareVisitor.description') as string}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-amber pl-6 pr-5 py-3 text-sm font-semibold text-white hover:bg-amber-light hover:shadow-xl hover:shadow-amber/25 transition-all motion-reduce:transition-none"
            >
              {t('shareVisitor.cta') as string}
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
