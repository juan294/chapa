export interface VerificationRecord {
  handle: string;
  displayName?: string;
  adjustedComposite: number;
  confidence: number;
  tier: string;
  archetype: string;
  dimensions: {
    building: number;
    guarding: number;
    consistency: number;
    breadth: number;
  };
  commitsTotal: number;
  prsMergedCount: number;
  reviewsSubmittedCount: number;
  generatedAt: string; // YYYY-MM-DD
  profileType: string;
}
