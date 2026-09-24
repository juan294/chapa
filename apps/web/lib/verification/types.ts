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
      envelope: Awaited<ReturnType<typeof import("@chapa/shared").sealRegisteredScoreReceipt>>;
    };
