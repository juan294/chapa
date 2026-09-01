"use client";

import { useMemo } from "react";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import {
  toPublicVerificationRecord,
  type PublicVerificationRecord,
} from "@/lib/verification/types";
import {
  VERIFICATION_EXPLANATION,
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

interface VerifyPageWebMcpToolsProps {
  hash: string;
  record: PublicVerificationRecord;
}

export function VerifyPageWebMcpTools({
  hash,
  record,
}: VerifyPageWebMcpToolsProps) {
  const { webmcpEnabled } = useClientFeatureFlags();
  const tools = useMemo<WebMcpTool[]>(() => {
    if (!webmcpEnabled) return [];
    const publicRecord = toPublicVerificationRecord(record);

    const codeFormat = verificationCodeFormat(hash);

    return [
      {
        name: "get_verification_record",
        description:
          "Return the verification hash and record displayed on this page.",
        inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
        annotations: WEBMCP_READ_ONLY_UNTRUSTED_ANNOTATIONS,
        execute: () => JSON.stringify({ hash, record: publicRecord }),
      },
      {
        name: "explain_verification",
        description:
          "Explain how Chapa badge verification works, including its guarantees and limits.",
        inputSchema: WEBMCP_EMPTY_INPUT_SCHEMA,
        annotations: WEBMCP_READ_ONLY_ANNOTATIONS,
        execute: () => JSON.stringify({
          ...VERIFICATION_EXPLANATION,
          codeFormat,
        }),
      },
    ];
  }, [hash, record, webmcpEnabled]);

  useModelContextTools(tools, webmcpEnabled);
  return null;
}
