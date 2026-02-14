/**
 * TEMPORARY diagnostic endpoint — checks each gate of notifyFirstBadge().
 * Remove after debugging is complete.
 */

import { NextResponse } from "next/server";
import { cacheGet } from "@/lib/cache/redis";
import { getResend } from "@/lib/email/resend";

export async function GET() {
  const handle = "juan294";
  const key = `badge:notified:${handle}`;

  const rawKey = process.env.RESEND_API_KEY;

  const gates = {
    gate1_vercelEnv: process.env.VERCEL_ENV,
    gate1_passes: process.env.VERCEL_ENV === "production",
    gate2_redisKey: key,
    gate2_alreadyNotified: await cacheGet<boolean>(key),
    gate2_passes: !(await cacheGet<boolean>(key)),
    gate3_resendClient: getResend() !== null,
    gate3_resendKeyDefined: rawKey !== undefined,
    gate3_resendKeyLength: rawKey?.length ?? 0,
    gate3_resendKeyPrefix: rawKey?.slice(0, 5) ?? "N/A",
    gate3_resendKeyTrimmedLength: rawKey?.trim()?.length ?? 0,
    gate4_supportEmail: !!process.env.SUPPORT_FORWARD_EMAIL?.trim(),
    gate4_emailLength: process.env.SUPPORT_FORWARD_EMAIL?.trim()?.length ?? 0,
  };

  return NextResponse.json(gates);
}
