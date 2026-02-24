/** Supported platform identifiers */
export type Platform = "github" | "bitbucket";

/** Linked platform record (returned from DB, tokens excluded) */
export interface LinkedPlatform {
  platform: Platform;
  remoteLogin: string;
  connectedAt: string; // ISO timestamp
}
