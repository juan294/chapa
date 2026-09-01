/**
 * Barrel re-export for the campaigns DB layer.
 *
 * All external importers use `@/lib/db/campaigns` — this index keeps that
 * path stable while the implementation is split into cohesive sub-modules:
 *
 *   types.ts  — shared types, constants, validation, row mappers
 *   crud.ts   — campaign CRUD (get/create/update/delete + active engagement)
 *   sends.ts  — send lifecycle (create, claim, ack, stats)
 */

export type {
  CampaignType,
  Campaign,
  CampaignSendStats,
} from "./types";

export {
  CampaignRowSchema,
  CampaignSendRowSchema,
  mapCampaignRow,
  mapSendRow,
} from "./types";

export {
  dbGetCampaigns,
  dbGetCampaign,
  dbCreateCampaign,
  dbUpdateCampaign,
  dbClaimCampaignForSending,
  dbReleaseCampaignClaim,
  dbDeleteCampaign,
  dbGetActiveEngagementCampaign,
} from "./crud";

export {
  CampaignStatsReadError,
  dbCreateCampaignSends,
  dbGetPendingSends,
  dbClaimPendingSends,
  dbReleaseCampaignSendLease,
  dbAcknowledgeCampaignSends,
  dbMarkSendsSent,
  dbMarkSendsFailed,
  dbGetCampaignStats,
} from "./sends";
