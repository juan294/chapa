/** Supported platform identifiers */
export type Platform = "github" | "bitbucket" | "codeberg" | "gitlab";

/** Linked platform record (returned from DB, tokens excluded) */
export interface LinkedPlatform {
  platform: Platform;
  remoteLogin: string;
  connectedAt: string; // ISO timestamp
  /** True when the connection's refresh grant is known dead (a definitive
   * revoke) or its refresh barrier can never be taken over again, and the
   * owner must reconnect through the normal OAuth flow to restore it (#1332).
   * Never true for `github` (no refresh barrier applies to it). */
  needsReconnect: boolean;
}
