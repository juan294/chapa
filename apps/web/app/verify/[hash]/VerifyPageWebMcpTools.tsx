"use client";

import { useMemo } from "react";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import {
  toPublicVerificationRecord,
  type PublicVerificationRecord,
} from "@/lib/verification/types";
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

type VerifyPageWebMcpToolsProps = { hash: string } & (
  | { version: "v7"; record?: never }
  | { version?: "v6"; record: PublicVerificationRecord }
);

export function VerifyPageWebMcpTools({
  hash,
  record,
  version = "v6",
}: VerifyPageWebMcpToolsProps) {
  const { webmcpEnabled } = useClientFeatureFlags();
  const tools = useMemo<WebMcpTool[]>(() => {
    if (!webmcpEnabled) return [];
    const publicRecord = record ? toPublicVerificationRecord(record) : null;

    const codeFormat = verificationCodeFormat(hash);

    return [
      {
        name: "get_verification_record",
        description:
          "Return the verification hash and record displayed on this page.",
        inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
        annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
        execute: async (_input, context) => {
          if (version !== "v7") return JSON.stringify({ version: "v6", hash, record: publicRecord });
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
          ...(version === "v7" ? RECEIPT_VERIFICATION_EXPLANATION : VERIFICATION_EXPLANATION),
          codeFormat,
        }),
      },
    ];
  }, [hash, record, version, webmcpEnabled]);

  useModelContextTools(tools, webmcpEnabled);
  return null;
}
