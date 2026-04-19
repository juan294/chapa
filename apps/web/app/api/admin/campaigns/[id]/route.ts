import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import {
  type Campaign,
  dbGetCampaign,
  dbUpdateCampaign,
  dbDeleteCampaign,
} from "@/lib/db/campaigns";
import { cacheDel } from "@/lib/cache/redis";

const ENGAGEMENT_CACHE_KEY = "campaign:active-engagement";

/** Allowed PATCH fields — never includes status, sentCount, etc. */
const ALLOWED_PATCH_FIELDS = [
  "name",
  "subject",
  "previewText",
  "headline",
  "bodyText",
  "features",
  "ctaText",
  "ctaUrl",
] as const;
type AllowedPatchField = (typeof ALLOWED_PATCH_FIELDS)[number];

function isValidCtaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const authError = await adminAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const campaign = await dbGetCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const authError = await adminAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const campaign = await dbGetCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: "Can only edit draft campaigns" },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // SE-L1: validate ctaUrl when provided
  if (body.ctaUrl !== undefined) {
    if (typeof body.ctaUrl !== "string" || !isValidCtaUrl(body.ctaUrl)) {
      return NextResponse.json(
        { error: "Invalid ctaUrl: must be an http or https URL" },
        { status: 400 },
      );
    }
  }

  // BE-H4: whitelist — only forward safe content fields to the DB layer
  const updates: Partial<Pick<Campaign, AllowedPatchField>> = {};
  for (const field of ALLOWED_PATCH_FIELDS) {
    if (field in body) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updates as any)[field] = body[field];
    }
  }

  const ok = await dbUpdateCampaign(id, updates);
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 },
    );
  }

  // BE-M17: invalidate engagement campaign cache so changes are visible immediately
  await cacheDel(ENGAGEMENT_CACHE_KEY);

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const authError = await adminAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const ok = await dbDeleteCampaign(id);
  if (!ok) {
    return NextResponse.json(
      { error: "Can only delete draft campaigns" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true });
}
