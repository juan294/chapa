"use client";

import { useMemo } from "react";
import {
  type StatsData,
} from "@chapa/shared";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import type { ClientSnapshotDiff } from "@/lib/history/diff";
import type { TrendSummary } from "@/lib/history/trend";
import { publicScoreProjection, comparePublicScores, readPublicComparison } from "@/lib/profile/public-score-projection";
import { type ScoreViewModel } from "@/lib/profile/score-view-model";
import { isValidHandle } from "@/lib/validation";
import {
  COMPARE_PROFILES_INPUT_SCHEMA,
  publicStats,
} from "@/lib/webmcp/catalog";
import {
  isWebMcpRecord,
  WEBMCP_EMPTY_INPUT_SCHEMA,
  WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
} from "@/lib/webmcp/shared-tools";
import {
  invalidInput,
  useModelContextTools,
  type WebMcpTool,
} from "@/lib/webmcp/use-model-context-tools";

interface PublicVerification {
  hash: string;
  date: string;
}

interface SharePageWebMcpToolsProps {
  handle: string;
  /**
   * The resolved score model the badge on this page draws from (#1001/#1311,
   * LE-7-1, #1335 phase 5). It is a public projection: nothing owner-only
   * (confidence, penalties) lives on it.
   */
  scoring: ScoreViewModel;
  stats: StatsData;
  verification: PublicVerification | null;
  trend: TrendSummary | null;
  diff: ClientSnapshotDiff | null;
  embedMarkdown: string;
  embedHtml: string;
}

const HEADLINE_NOTE =
  "score and tier are the headline the badge draws; null when the badge shows an evidence range or the live profile could not be materialized. The stored trend snapshot's smoothed composite is never reported as the score.";

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await response.json();
    return isWebMcpRecord(body) ? body : null;
  } catch {
    return null;
  }
}

export function SharePageWebMcpTools({
  handle,
  scoring,
  stats,
  verification,
  trend,
  diff,
  embedMarkdown,
  embedHtml,
}: SharePageWebMcpToolsProps) {
  const { webmcpEnabled } = useClientFeatureFlags();

  const tools = useMemo<WebMcpTool[]>(() => {
    if (!webmcpEnabled) return [];

    const projection = publicScoreProjection(scoring);

    const getImpactProfile: WebMcpTool = {
      name: "get_impact_profile",
      description:
        "Return the public impact profile shown in the current page render. displayScore and displayTier are the headline the badge draws (displayScore is null for an evidence range).",
      inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
      annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
      execute: () => JSON.stringify({
        handle,
        ...projection,
        displayTier: projection.tier,
        stats: publicStats(stats),
        verification,
        trend,
        diff,
        freshness: {
          source: "current page render",
          statsFetchedAt: stats.fetchedAt,
        },
        note: HEADLINE_NOTE,
      }),
    };

    const getImpactHistory: WebMcpTool = {
      name: "get_impact_history",
      description: "Return the public impact snapshots and trend for this profile.",
      inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
      annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
      execute: async (_inputs, { signal }) => {
        const response = await fetch(
          `/api/history/${encodeURIComponent(handle)}?include=snapshots,trend`,
          { signal },
        );
        if (response.status === 404) {
          return `No impact history was found for @${handle}.`;
        }
        if (response.status === 429) {
          return "Impact history is temporarily rate limited. Please try again later.";
        }
        if (!response.ok) {
          return `Impact history is unavailable right now (HTTP ${response.status}).`;
        }
        const body = await response.text();
        return body || "Impact history returned an empty response.";
      },
    };

    const verifyBadge: WebMcpTool = {
      name: "verify_badge",
      description: "Check the live verification record for the badge on this profile.",
      inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
      annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
      execute: async (_inputs, { signal }) => {
        if (!verification) {
          return "This profile has no verification record yet.";
        }
        const response = await fetch(
          `/api/verify/${encodeURIComponent(verification.hash)}`,
          { signal },
        );
        if (response.status === 404) {
          return "This badge's verification record could not be found.";
        }
        if (response.status === 429) {
          return "Badge verification is temporarily rate limited. Please try again later.";
        }
        if (!response.ok && response.status !== 410) {
          return `Badge verification is unavailable right now (HTTP ${response.status}).`;
        }
        const body = await readJson(response);
        if (!body) return "Badge verification returned an unreadable response.";
        if (body.version === "v7" || body.version === "v7.2") return JSON.stringify(body);
        if (response.status === 410) return "Badge verification returned an unreadable revoked response.";
        const publicRecord = isWebMcpRecord(body.data)
          ? Object.fromEntries(
              Object.entries(body.data).filter(([key]) => key !== "confidence"),
            )
          : body.data;
        return JSON.stringify({
          status: body.status,
          record: publicRecord,
          verifyUrl: body.verifyUrl,
        });
      },
    };

    const compareProfiles: WebMcpTool = {
      name: "compare_profiles",
      description:
        "Compare this impact profile with another existing public Chapa profile, identified by GitHub handle.",
      inputSchema: COMPARE_PROFILES_INPUT_SCHEMA,
      annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
      execute: async (inputs, { signal }) => {
        const otherHandle = isWebMcpRecord(inputs) && typeof inputs.other_handle === "string"
          ? inputs.other_handle.trim()
          : "";
        if (!isValidHandle(otherHandle)) {
          return invalidInput(
            "compare_profiles",
            "other_handle must be a public GitHub handle",
          );
        }

        const response = await fetch(
          `/api/profile/${encodeURIComponent(otherHandle)}`,
          { signal },
        );
        if (response.status === 404) {
          return `No public Chapa impact profile exists for @${otherHandle}. Its owner must sign in to Chapa before this handle can be compared.`;
        }
        if (response.status === 429) {
          return "Profile comparison is temporarily rate limited. Please try again later.";
        }
        if (!response.ok) {
          return `Profile comparison is unavailable right now (HTTP ${response.status}).`;
        }

        const other = await readJson(response);
        const unavailableComparison = () => JSON.stringify({ current: { handle, ...projection, score: projection.displayScore },
          other: { handle: otherHandle, score: null, tier: null, scoring: null }, status: "not_comparable", reason: "unavailable", differences: null });
        if (!other || !isWebMcpRecord(other.scoring)) return unavailableComparison();
        const otherProjection = readPublicComparison(other);
        if (!otherProjection) return unavailableComparison();
        const comparison = comparePublicScores(projection, otherProjection);
        return JSON.stringify({ ...comparison,
          current: { handle, ...comparison.current, score: comparison.current.displayScore },
          other: { handle: typeof other.handle === "string" ? other.handle : otherHandle, ...comparison.other, score: comparison.other.displayScore },
          note: HEADLINE_NOTE });
      },
    };

    const getEmbedSnippet: WebMcpTool = {
      name: "get_embed_snippet",
      description:
        "Return ready-to-paste Markdown and HTML snippets that embed this " +
        "profile's live badge, for example in a GitHub README.",
      inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
      annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
      execute: () => JSON.stringify({
        handle,
        markdown: embedMarkdown,
        html: embedHtml,
        note: "The badge image is live; embed it once and it stays current.",
      }),
    };

    return [
      getImpactProfile,
      getImpactHistory,
      verifyBadge,
      compareProfiles,
      getEmbedSnippet,
    ];
  }, [
    diff,
    embedHtml,
    embedMarkdown,
    handle,
    scoring,
    stats,
    trend,
    verification,
    webmcpEnabled,
  ]);

  useModelContextTools(tools, webmcpEnabled);
  return null;
}
