/** Supported platform identifiers */
export type Platform = "github" | "bitbucket" | "codeberg" | "gitlab";

/** Linked platform record (returned from DB, tokens excluded) */
export interface LinkedPlatform {
  platform: Platform;
  remoteLogin: string;
  connectedAt: string; // ISO timestamp
}
