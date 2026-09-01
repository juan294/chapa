"use client";

import { useMemo } from "react";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import { isValidHandle } from "@/lib/validation";
import {
  isWebMcpRecord,
  WEBMCP_EMPTY_INPUT_SCHEMA,
  WEBMCP_READ_ONLY_ANNOTATIONS,
} from "@/lib/webmcp/shared-tools";
import { SITE_TOOL_MAP } from "@/lib/webmcp/site-tool-map";
import {
  invalidInput,
  useModelContextTools,
  type WebMcpTool,
} from "@/lib/webmcp/use-model-context-tools";

const PRODUCTION_BASE_URL = "https://chapa.thecreativetoken.com";

const FIND_PROFILE_INPUT_SCHEMA = {
  type: "object",
  properties: {
    handle: { type: "string" },
  },
  required: ["handle"],
  additionalProperties: false,
};

export function LandingWebMcpTools() {
  const { webmcpEnabled } = useClientFeatureFlags();
  const tools = useMemo<WebMcpTool[]>(() => {
    if (!webmcpEnabled) return [];

    return [
      {
        name: "get_site_capabilities",
        description:
          "Describe Chapa and list the WebMCP tools each page registers.",
        inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
        annotations: WEBMCP_READ_ONLY_ANNOTATIONS,
        execute: () => JSON.stringify({
          whatIsChapa:
            "Chapa turns developer activity into a live, verifiable Impact Profile and embeddable badge that summarizes delivery, quality, consistency, breadth, and optional craft.",
          toolMap: SITE_TOOL_MAP,
          entryPoints: {
            demoStudio: `${PRODUCTION_BASE_URL}/studio?demo=1`,
            profile: `${PRODUCTION_BASE_URL}/u/<handle>`,
            scoringMethodology: `${PRODUCTION_BASE_URL}/about/scoring`,
            llmsTxt: `${PRODUCTION_BASE_URL}/llms.txt`,
          },
          boundaries: [
            "Login uses GitHub OAuth and only a human can complete it.",
            "Configuration saves are proposed by agents and confirmed by a human on-page.",
            "Tools register per page; navigate to a route to use its tools.",
          ],
        }),
      },
      {
        name: "find_profile",
        description:
          "Resolve a GitHub handle to its Chapa profile and badge URLs.",
        inputSchema: FIND_PROFILE_INPUT_SCHEMA,
        annotations: WEBMCP_READ_ONLY_ANNOTATIONS,
        execute: (inputs) => {
          const handle = isWebMcpRecord(inputs) &&
              typeof inputs.handle === "string"
            ? inputs.handle.trim()
            : "";
          if (!isValidHandle(handle)) {
            return invalidInput(
              "find_profile",
              "handle must be a public GitHub handle",
            );
          }

          const encodedHandle = encodeURIComponent(handle);
          return JSON.stringify({
            handle,
            sharePageUrl: `${PRODUCTION_BASE_URL}/u/${encodedHandle}`,
            badgeSvgUrl:
              `${PRODUCTION_BASE_URL}/u/${encodedHandle}/badge.svg`,
            notes: [
              "The profile is generated on first visit if it does not exist yet.",
              "Opening the share page registers six more tools, including get_impact_profile and get_embed_snippet.",
            ],
          });
        },
      },
    ];
  }, [webmcpEnabled]);

  useModelContextTools(tools, webmcpEnabled);
  return null;
}
