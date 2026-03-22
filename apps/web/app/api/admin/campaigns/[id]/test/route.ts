import { type NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/auth/admin-route";
import { requireSession } from "@/lib/auth/require-session";
import { dbGetCampaign } from "@/lib/db/campaigns";
import { getResend } from "@/lib/email/resend";
import { buildEmailContent, EMAIL_FROM } from "@/lib/email/campaigns";
import {
  buildAnnouncementHtml,
  buildAnnouncementText,
} from "@/lib/email/templates/announcement";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Replace {{var}} placeholders with sample values for test emails. */
function interpolate(template: string, handle: string): string {
  const vars: Record<string, string> = {
    handle,
    delta: "+12",
    tier_from: "Solid",
    tier_to: "High",
    archetype_from: "Balanced",
    archetype_to: "Builder",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key as string] ?? "");
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const authError = await adminAuth(request);
  if (authError) return authError;

  // Parse body
  let email: string;
  let handle: string | undefined;
  try {
    const body = await request.json();
    email = typeof body.email === "string" ? body.email.trim() : "";
    handle = typeof body.handle === "string" ? body.handle.trim() : undefined;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 },
    );
  }

  if (!email) {
    return NextResponse.json(
      { error: "Missing required field: email" },
      { status: 400 },
    );
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Invalid email address" },
      { status: 400 },
    );
  }

  // Fetch campaign
  const { id } = await params;
  const campaign = await dbGetCampaign(id);
  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get Resend client
  const resend = getResend();
  if (!resend) {
    return NextResponse.json(
      { error: "Email service unavailable" },
      { status: 500 },
    );
  }

  // Use provided handle or fall back to session login
  const { session } = requireSession(request);
  const recipientHandle = handle || session!.login;

  // For engagement campaigns, interpolate placeholders with sample values
  const interpolated = campaign.type === "engagement"
    ? {
        ...campaign,
        subject: interpolate(campaign.subject, recipientHandle),
        headline: interpolate(campaign.headline, recipientHandle),
        bodyText: interpolate(campaign.bodyText, recipientHandle),
        features: campaign.features.map((f) => ({
          text: interpolate(f.text, recipientHandle),
        })),
      }
    : campaign;

  // Build email content using the same template as real sends
  const content = buildEmailContent(interpolated, recipientHandle);
  const html = buildAnnouncementHtml(content);
  const text = buildAnnouncementText(content);

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: `[TEST] ${interpolated.subject}`,
      html,
      text,
    });

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to send test email" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: `Test email sent to ${email}`,
      emailId: data.id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
