"use client";

import { useMemo } from "react";
import { useClientFeatureFlags } from "@/components/ClientFeatureFlagsProvider";
import {
  toPublicVerificationRecord,
  type PublicVerificationRecord,
} from "@/lib/verification/types";
import {
  CURRENT_VERIFICATION_HASH_HEX_LENGTH,
  VERIFICATION_RECORD_TTL_DAYS,
} from "@/lib/verification/constants";
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

// Source: the public `about.verification.*` copy and lib/verification/hmac.ts.
// Keep the guarantees and limits aligned with that user-facing explanation.
const VERIFICATION_EXPLANATION = {
  algorithm: "HMAC-SHA256",
  howItWorks:
    `Current Chapa badges use a deterministic payload from the badge profile fields, sign it with a server-held secret key, and use the first ${CURRENT_VERIFICATION_HASH_HEX_LENGTH} hexadecimal characters (128 bits) as the verification code.`,
  proves: [
    "Only Chapa can issue the hash for the original signed payload because only the Chapa server knows the signing secret.",
    "Changing any field in that original payload would produce a different hash.",
    "The stored verification record exposes a subset of the original values for manual comparison and binds them to a specific date.",
  ],
  doesNotProve: [
    "This lookup does not recompute the HMAC from an SVG, and the stored record does not expose every signed payload field for manual comparison.",
    "It does not independently prove that the underlying platform data is accurate; Chapa trusts its platform data sources.",
    "It does not prevent someone from editing an SVG file; it makes changes to signed fields detectable.",
    `It is not a blockchain or permanent public ledger; verification records expire after ${VERIFICATION_RECORD_TTL_DAYS} days.`,
  ],
} as const;

export function VerifyPageWebMcpTools({
  hash,
  record,
}: VerifyPageWebMcpToolsProps) {
  const { webmcpEnabled } = useClientFeatureFlags();
  const tools = useMemo<WebMcpTool[]>(() => {
    if (!webmcpEnabled) return [];
    const publicRecord = toPublicVerificationRecord(record);

    const codeFormat = hash.length === CURRENT_VERIFICATION_HASH_HEX_LENGTH
      ? `Current ${CURRENT_VERIFICATION_HASH_HEX_LENGTH}-character verification code.`
      : `Verified legacy ${hash.length}-character verification code.`;

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
