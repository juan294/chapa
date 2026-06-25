import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/lib/auth/admin-route";
import { dbGetCampaigns, dbCreateCampaign } from "@/lib/db/campaigns";
import type { CampaignType } from "@/lib/db/campaigns";
import { parseCampaignCreatePayload } from "@/lib/campaigns/payload";
import { withErrorCapture } from "@/lib/analytics/server-errors";

const VALID_TYPES: CampaignType[] = ["announcement", "engagement"];

// BE-M2 (#951): Zod schema for the POST body — validates structure before
// delegating to parseCampaignCreatePayload for business-level rules.
const CampaignCreateSchema = z.object({
  type: z.enum(["announcement", "engagement"]).optional(),
  name: z.string().min(1, "name is required"),
  subject: z.string().min(1, "subject is required"),
  previewText: z.string().optional().nullable(),
  headline: z.string().min(1, "headline is required"),
  bodyText: z.string().min(1, "bodyText is required"),
  features: z.array(z.object({ text: z.string().min(1) })).optional(),
  ctaText: z.string().min(1, "ctaText is required"),
  ctaUrl: z.string().min(1, "ctaUrl is required"),
});

export const GET = withErrorCapture("/api/admin/campaigns", async (request: NextRequest) => {
  const authError = await adminAuth(request);
  if (authError) return authError;

  const rawType = request.nextUrl.searchParams.get("type");
  const type = rawType && VALID_TYPES.includes(rawType as CampaignType)
    ? (rawType as CampaignType)
    : undefined;
  const campaigns = await dbGetCampaigns(undefined, type);
  return NextResponse.json({ campaigns });
});

export const POST = withErrorCapture("/api/admin/campaigns", async (request: NextRequest) => {
  const authError = await adminAuth(request);
  if (authError) return authError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Zod schema validates structural shape first.
  const zodResult = CampaignCreateSchema.safeParse(rawBody);
  if (!zodResult.success) {
    const firstIssue = zodResult.error.issues[0];
    // Format path as bracket notation for array indices (e.g. features[0].text)
    const field = firstIssue?.path.reduce<string>((acc, segment, i) => {
      if (typeof segment === "number") return `${acc}[${segment}]`;
      return i === 0 ? String(segment) : `${acc}.${String(segment)}`;
    }, "") ?? "body";
    const msg = firstIssue?.message ?? "Invalid request body";
    return NextResponse.json(
      { error: `Invalid ${field}: ${msg}` },
      { status: 400 },
    );
  }

  let campaign;
  try {
    campaign = parseCampaignCreatePayload(zodResult.data as Record<string, unknown>);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  const id = await dbCreateCampaign({
    type: campaign.type as CampaignType,
    name: campaign.name,
    subject: campaign.subject,
    previewText: campaign.previewText,
    headline: campaign.headline,
    bodyText: campaign.bodyText,
    features: campaign.features,
    ctaText: campaign.ctaText,
    ctaUrl: campaign.ctaUrl,
  });

  if (!id) {
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id }, { status: 201 });
});
