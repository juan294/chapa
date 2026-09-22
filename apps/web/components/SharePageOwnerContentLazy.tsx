"use client";

import dynamic from "next/dynamic";
import type { ScoreViewModel } from "@/lib/profile/score-view-model";
import type { ReceiptExplanation } from "@/lib/dashboard/receipt-explanation";
import type { ClientImpactV6Result, CraftResult, StatsData } from "@chapa/shared";
import type { TrendSummary } from "@/lib/history/trend";
import type { ClientSnapshotDiff } from "@/lib/history/diff";
import { useTranslation } from "@/lib/i18n";

/** Same visible fill as the route's `loading.tsx` breakdown skeleton. */
const BAR = "animate-pulse rounded bg-track";

/**
 * Placeholder while the owner-content chunk loads.
 *
 * LE-5-1 — this chunk mounts below a badge that is already on screen, and
 * its fallback used to be `BadgeSkeleton`: a second badge-shaped plate
 * captioned "Building the badge". In dev Turbopack compiles the chunk on
 * first demand, so the first owner visit drew a badge under the badge for
 * several seconds. The wait belongs to the breakdown, so the placeholder is
 * shaped like the breakdown and says only that it is loading.
 */
function OwnerContentFallback() {
  const { t } = useTranslation();

  return (
    <div role="status" aria-label={t("common.loading") as string} className="mb-12">
      <hr className="border-stroke mb-10" />
      <div className="rounded-[3px] border border-stroke bg-card p-8">
        <div className={`mb-6 h-4 w-36 ${BAR}`} />
        <div className="space-y-4">
          <div className={`h-5 w-full ${BAR}`} />
          <div className={`h-5 w-3/4 ${BAR}`} />
          <div className={`h-5 w-5/6 ${BAR}`} />
          <div className={`h-5 w-2/3 ${BAR}`} />
        </div>
      </div>
    </div>
  );
}

const SharePageOwnerContent = dynamic(
  () => import("./SharePageOwnerContent").then((m) => ({ default: m.SharePageOwnerContent })),
  { loading: () => <OwnerContentFallback /> },
);

interface Props {
  handle: string;
  stats: StatsData | null;
  // #1067 — the server passes a redacted PublicImpactV6Result (no
  // confidence/confidencePenalties keys) for non-owner visitors, and the
  // full ImpactV6Result for the owner.
  impact: ClientImpactV6Result | null;
  craftResult?: CraftResult | null;
  trend?: TrendSummary | null;
  diff?: ClientSnapshotDiff | null;
  // #1165 (FE-H2/UX-M5) — mechanically threaded through to
  // SharePageOwnerContent; see that component for details. This wrapper has
  // no logic of its own beyond the next/dynamic lazy split.
  isOwner?: boolean;
  embedMarkdown?: string;
  embedHtml?: string;
  receiptExplanation?: ReceiptExplanation | null;
  scoring?: ScoreViewModel | null;
}

export function SharePageOwnerContentLazy(props: Props) {
  return <SharePageOwnerContent {...props} />;
}
