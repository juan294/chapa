import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dbGetUsersWithEmail } from "@/lib/db/users";
import { getResend } from "@/lib/email/resend";
import {
  ensureSegment,
  addContact,
  markUnsubscribed,
} from "@/lib/email/audience";

export const maxDuration = 300;

const BATCH_SIZE = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf-8");
    const bufB = Buffer.from(b, "utf-8");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

async function processInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<unknown>,
): Promise<PromiseSettledResult<unknown>[]> {
  const results: PromiseSettledResult<unknown>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

interface Contact {
  id: string;
  email: string;
  unsubscribed: boolean;
}

async function listAllContacts(): Promise<Contact[]> {
  const resend = getResend();
  if (!resend) return [];

  const all: Contact[] = [];
  let cursor: string | undefined;

  try {
    for (;;) {
      const opts: { limit: number; after?: string } = { limit: 100 };
      if (cursor) opts.after = cursor;

      const { data, error } = await resend.contacts.list(opts);
      if (error || !data) break;

      for (const c of data.data) {
        all.push({
          id: c.id,
          email: c.email,
          unsubscribed: c.unsubscribed,
        });
      }

      if (!data.has_more) break;
      cursor = data.data[data.data.length - 1]?.id;
      if (!cursor) break;
    }
  } catch (error) {
    console.error(
      "[sync-audience] listAllContacts error:",
      (error as Error).message,
    );
  }

  return all;
}

// ---------------------------------------------------------------------------
// GET /api/cron/sync-audience
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token || !safeEqual(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure segment exists
  const segmentId = await ensureSegment();
  if (!segmentId) {
    return NextResponse.json({
      status: "skipped",
      reason: "no_segment",
    });
  }

  // Get eligible users from DB and existing contacts from Resend
  const [users, existingContacts] = await Promise.all([
    dbGetUsersWithEmail(),
    listAllContacts(),
  ]);

  const existingByEmail = new Map(existingContacts.map((c) => [c.email, c]));
  const eligibleEmails = new Set(users.map((u) => u.email));

  // Determine operations
  const toAdd = users.filter((u) => !existingByEmail.has(u.email));
  const toMarkUnsubscribed = existingContacts.filter(
    (c) => !c.unsubscribed && !eligibleEmails.has(c.email),
  );

  // Process in batches
  const addResults = await processInBatches(toAdd, BATCH_SIZE, (user) =>
    addContact(user.email, {
      firstName: user.displayName ?? undefined,
      handle: user.handle,
    }),
  );

  const unsubResults = await processInBatches(
    toMarkUnsubscribed,
    BATCH_SIZE,
    (contact) => markUnsubscribed(contact.email),
  );

  const added = addResults.filter((r) => r.status === "fulfilled").length;
  const unsubscribed = unsubResults.filter(
    (r) => r.status === "fulfilled",
  ).length;

  return NextResponse.json({
    status: "ok",
    synced: added,
    unsubscribed,
    totalEligible: users.length,
    totalContacts: existingContacts.length,
  });
}
