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
