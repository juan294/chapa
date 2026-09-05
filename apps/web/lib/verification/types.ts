export interface VerificationRecord {
  handle: string;
  displayName?: string;
  adjustedComposite: number;
  confidence: number;
  tier: string;
  archetype: string;
  dimensions: {
    delivery: number;
    quality: number;
    consistency: number;
    breadth: number;
  };
  commitsTotal: number;
  prsMergedCount: number;
  reviewsSubmittedCount: number;
  generatedAt: string; // YYYY-MM-DD
  profileType: string;
}

export type PublicVerificationRecord = Omit<VerificationRecord, "confidence">;

export function toPublicVerificationRecord(
  record: PublicVerificationRecord & Partial<Pick<VerificationRecord, "confidence">>,
): PublicVerificationRecord {
  const publicRecord = { ...record };
  delete publicRecord.confidence;
  return publicRecord;
}

/** Issuance, signature authentication and source truth are deliberately separate. */
export type ReceiptVerificationV7 =
  | { version: "v7"; status: "revoked"; revisionId: string; signatureAuthenticated: false }
  | {
      version: "v7";
      status: "current" | "superseded" | "retracted";
      revisionId: string;
      issuanceRecorded: true;
      signatureAuthenticated: boolean;
      keyVersion: string;
      arithmetic: "offline_replay_available";
      sourceEvidence: "not_verified";
      envelope: Awaited<ReturnType<typeof import("@chapa/shared").sealScoreReceipt>>;
    };
