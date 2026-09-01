"use client";

import { useMemo } from "react";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import { isValidHandle } from "@/lib/validation";
import {
  FIND_PROFILE_INPUT_SCHEMA,
  PRODUCTION_BASE_URL,
  SITE_CAPABILITIES,
} from "@/lib/webmcp/catalog";
import {
  isWebMcpRecord,
  WEBMCP_EMPTY_INPUT_SCHEMA,
  WEBMCP_READ_ONLY_ANNOTATIONS,
} from "@/lib/webmcp/shared-tools";
import {
  invalidInput,
  useModelContextTools,
  type WebMcpTool,
} from "@/lib/webmcp/use-model-context-tools";

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
        execute: () => JSON.stringify(SITE_CAPABILITIES),
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
