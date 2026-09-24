"use client";

import { useMemo } from "react";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import {
  VERIFICATION_EXPLANATION,
  RECEIPT_VERIFICATION_EXPLANATION,
  verificationCodeFormat,
} from "@/lib/webmcp/catalog";
import {
  WEBMCP_EMPTY_INPUT_SCHEMA,
  WEBMCP_READ_ONLY_ANNOTATIONS,
  WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
} from "@/lib/webmcp/shared-tools";
import {
  useModelContextTools,
  type WebMcpTool,
} from "@/lib/webmcp/use-model-context-tools";

/**
 * #1335 phase 5 — `verification_records` and the legacy static-record mode
 * are retired. Every hash (a v7 receipt token, or a well-formed legacy code
 * that now answers 410 `retired_v6_code`) is resolved the same way: a live
 * `GET /api/verify/<hash>` call. There is nothing left to embed at render
 * time, so this component takes only the hash and whether it parses as a
 * v7 token (which only changes which explanation is returned).
 */
export function VerifyPageWebMcpTools({ hash, isV7 }: { hash: string; isV7: boolean }) {
  const { webmcpEnabled } = useClientFeatureFlags();
  const tools = useMemo<WebMcpTool[]>(() => {
    if (!webmcpEnabled) return [];
    const codeFormat = verificationCodeFormat(hash);

    return [
      {
        name: "get_verification_record",
        description:
          "Return the verification result displayed on this page.",
        inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
        annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
        execute: async (_input, context) => {
          try {
            const response = await fetch(`/api/verify/${hash}`, { cache: "no-store", signal: context.signal });
            if (response.ok || response.status === 410) return JSON.stringify(await response.json());
            return JSON.stringify({ error: "Verification is unavailable. Reload the page or retry later; no current verification success is claimed." });
          } catch { return JSON.stringify({ error: "Verification could not be checked. Retry later; no cached receipt is returned." }); }
        },
      },
      {
        name: "explain_verification",
        description:
          "Explain how Chapa badge verification works, including its guarantees and limits.",
        inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
        annotations: WEBMCP_READ_ONLY_ANNOTATIONS,
        execute: () => JSON.stringify({
          ...(isV7 ? RECEIPT_VERIFICATION_EXPLANATION : VERIFICATION_EXPLANATION),
          codeFormat,
        }),
      },
    ];
  }, [hash, isV7, webmcpEnabled]);

  useModelContextTools(tools, webmcpEnabled);
  return null;
}
