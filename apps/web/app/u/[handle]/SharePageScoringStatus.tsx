import { getServerT } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Locale } from "@/lib/i18n";
import { renderBadgeStatusSvg, buildBadgeStatusStrings, buildBadgeUnavailableStrings, type BadgeStatusState, type NonReadyScoringStatus } from "@/lib/render/badge-state";
import { InlineBadgeSvg } from "@/components/badge/InlineBadgeSvg";
import { BadgeToolbar } from "@/components/BadgeToolbar";
import { resolveBadgeConfigSnapshot } from "@/lib/render/badge-config";
import { SharePageHeader } from "./SharePageHeader";
import { ScoringStatusPanel } from "@/app/settings/ScoringStatusPanel";
import { SiteFooter } from "@/components/SiteFooter";

const VISITOR_KEYS: Record<BadgeStatusState, string> = {
  collecting: "scoring.status.visitorCollecting",
  action_needed: "scoring.status.visitorActionNeeded",
  unregistered: "scoring.status.visitorUnregistered",
  unavailable: "scoring.status.visitorUnavailable",
};

/**
 * The share page's content when there is no receipt to draw yet (#1335
 * phase 4) — a handle that is collecting evidence, paused on an owner
 * action, has never signed up, or (`status: null`) whose scoring-status
 * authority read itself failed. Rendered by `SharePageContent` in place
 * of the normal materialize/breakdown pipeline: there is no score to
 * fetch or explain, so this is a deliberately smaller subtree, not a
 * variant of `SharePageOwnerContent`.
 *
 * Visitors see the badge state plus one sentence. The owner sees the full
 * per-provider `ScoringStatusPanel` — the same component `/settings` uses,
 * given the exact status this page already resolved (no second fetch) —
 * except for `status: null`, where there is no real `ScoringStatus` to
 * detail, so the owner sees the same one-sentence message as a visitor.
 */
export async function SharePageScoringStatus({
  handle,
  locale,
  status,
  badgeState,
  isOwner,
}: {
  handle: string;
  locale: Locale;
  status: NonReadyScoringStatus | null;
  badgeState: BadgeStatusState;
  isOwner: boolean;
}) {
  const t = getServerT(locale);
  const configSnapshot = await resolveBadgeConfigSnapshot(handle);
  const svg = renderBadgeStatusSvg(badgeState, {
    handle,
    percent: status?.kind === "collecting" ? status.percent : undefined,
    config: configSnapshot.config,
    disableAnimation: false,
    strings: status
      ? buildBadgeStatusStrings((key) => t(key) as string, status, interpolate)
      : buildBadgeUnavailableStrings((key) => t(key) as string),
  });
  const badgeLabelId = `share-badge-status-label-${handle}`;

  return (
    <div className="relative mx-auto max-w-4xl px-4 sm:px-6 pt-20 pb-16 sm:pt-24 sm:pb-24">
      <SharePageHeader handle={handle} displayLabel={handle} />

      <div className="mb-4 animate-scale-in motion-reduce:animate-none [animation-delay:200ms]">
        <div className="relative rounded-[3px] border border-stroke bg-card p-4">
          <div
            role="img"
            aria-labelledby={badgeLabelId}
            className="w-full overflow-hidden [&_svg]:w-full [&_svg]:h-auto [&_svg]:block"
          >
            <span id={badgeLabelId} className="sr-only">
              {t(VISITOR_KEYS[badgeState]) as string}
            </span>
            <InlineBadgeSvg svg={svg} />
          </div>
        </div>
      </div>

      <div className="relative z-30 flex justify-end mb-10 animate-fade-in-up motion-reduce:animate-none [animation-delay:250ms]">
        <BadgeToolbar handle={handle} isOwner={isOwner} />
      </div>

      {isOwner && status ? (
        <ScoringStatusPanel initialStatus={status} />
      ) : (
        <p className="text-sm text-text-secondary text-pretty" data-testid="share-status-visitor-sentence">
          {t(VISITOR_KEYS[badgeState]) as string}
        </p>
      )}

      <div className="pb-16 mt-16">
        <SiteFooter t={t} />
      </div>
    </div>
  );
}
