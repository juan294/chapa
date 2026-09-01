"use client";

import { useMemo } from "react";
import {
  type ClientImpactV6Result,
  type CraftResult,
  type StatsData,
} from "@chapa/shared";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import type { ClientSnapshotDiff } from "@/lib/history/diff";
import type { TrendSummary } from "@/lib/history/trend";
import { useTranslation } from "@/lib/i18n";
import { isValidHandle } from "@/lib/validation";
import {
  COMPARE_PROFILES_INPUT_SCHEMA,
  compareDimensions,
  publicStats,
} from "@/lib/webmcp/catalog";
import {
  createExplainDimensionTool,
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
  impact: ClientImpactV6Result;
  stats: StatsData;
  verification: PublicVerification | null;
  trend: TrendSummary | null;
  diff: ClientSnapshotDiff | null;
  craftResult?: CraftResult | null;
  embedMarkdown: string;
  embedHtml: string;
}

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
  impact,
  stats,
  verification,
  trend,
  diff,
  craftResult = null,
  embedMarkdown,
  embedHtml,
}: SharePageWebMcpToolsProps) {
  const { webmcpEnabled } = useClientFeatureFlags();
  const { t } = useTranslation();

  const tools = useMemo<WebMcpTool[]>(() => {
    if (!webmcpEnabled) return [];

    const getImpactProfile: WebMcpTool = {
      name: "get_impact_profile",
      description: "Return the public impact profile shown in the current page render.",
      inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
      annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
      execute: () => JSON.stringify({
        handle,
        impact,
        stats: publicStats(stats),
        verification,
        trend,
        diff,
        freshness: {
          source: "current page render",
          statsFetchedAt: stats.fetchedAt,
          impactComputedAt: impact.computedAt,
        },
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
        if (!response.ok) {
          return `Badge verification is unavailable right now (HTTP ${response.status}).`;
        }
        const body = await readJson(response);
        if (!body) return "Badge verification returned an unreadable response.";
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

    const explainDimension = createExplainDimensionTool({
      impact,
      stats,
      craftResult,
      t,
      annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
    });

    const compareProfiles: WebMcpTool = {
      name: "compare_profiles",
      description: "Compare this impact profile with another public GitHub handle.",
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
          return `No public impact profile was found for @${otherHandle}. A profile is generated on first visit: ask the user to open https://chapa.thecreativetoken.com/u/${otherHandle} once, then retry this comparison.`;
        }
        if (response.status === 429) {
          return "Profile comparison is temporarily rate limited. Please try again later.";
        }
        if (!response.ok) {
          return `Profile comparison is unavailable right now (HTTP ${response.status}).`;
        }

        const other = await readJson(response);
        const otherDimensions = other?.dimensions;
        const otherScore = typeof other?.displayScore === "number"
          ? other.displayScore
          : other?.adjustedComposite;
        if (
          !other ||
          !isWebMcpRecord(otherDimensions) ||
          typeof otherScore !== "number"
        ) {
          return "The comparison profile returned an unreadable response.";
        }

        return JSON.stringify({
          current: {
            handle,
            score: impact.adjustedComposite,
            tier: impact.tier,
            dimensions: impact.dimensions,
          },
          other: {
            handle: typeof other.handle === "string" ? other.handle : otherHandle,
            score: otherScore,
            tier: typeof other.displayTier === "string"
              ? other.displayTier
              : other.tier,
            dimensions: otherDimensions,
          },
          differences: {
            score: otherScore - impact.adjustedComposite,
            dimensions: compareDimensions(impact.dimensions, otherDimensions),
          },
        });
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
      explainDimension,
      compareProfiles,
      getEmbedSnippet,
    ];
  }, [
    craftResult,
    diff,
    embedHtml,
    embedMarkdown,
    handle,
    impact,
    stats,
    t,
    trend,
    verification,
    webmcpEnabled,
  ]);

  useModelContextTools(tools, webmcpEnabled);
  return null;
}
