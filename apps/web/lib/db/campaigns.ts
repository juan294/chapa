/**
 * Supabase data access — email campaigns.
 *
 * This file is a stable re-export barrel.  The implementation has been split
 * into cohesive sub-modules under `campaigns/`:
 *
 *   campaigns/types.ts  — shared types, constants, validation, row mappers
 *   campaigns/crud.ts   — campaign CRUD (get/create/update/delete)
 *   campaigns/sends.ts  — send lifecycle (create, claim, ack, stats)
 *   campaigns/index.ts  — barrel re-export (this file delegates here)
 *
 * All external imports (`@/lib/db/campaigns`) continue to resolve here
 * without any changes at the call sites.
 */

export type {
  CampaignType,
  CampaignStatus,
  CampaignSendStatus,
  Campaign,
  CampaignSend,
  CampaignSendStats,
} from "./campaigns/index";

export {
  CampaignRowSchema,
  CampaignSendRowSchema,
  mapCampaignRow,
  mapSendRow,
  dbGetCampaigns,
  dbGetCampaign,
  dbCreateCampaign,
  dbUpdateCampaign,
  dbClaimCampaignForSending,
  dbReleaseCampaignClaim,
  dbDeleteCampaign,
  dbGetActiveEngagementCampaign,
  dbCreateCampaignSends,
  dbGetPendingSends,
  dbClaimPendingSends,
  dbAcknowledgeCampaignSends,
  dbMarkSendsSent,
  dbMarkSendsFailed,
  dbRequeueSends,
  dbGetCampaignStats,
} from "./campaigns/index";
