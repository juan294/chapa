import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth/cron";
import { dbGetUsersWithEmail } from "@/lib/db/users";
import { getResend } from "@/lib/email/resend";
import {
  ensureSegment,
  addContact,
  markUnsubscribed,
} from "@/lib/email/audience";
import { fireAndForget } from "@/lib/async/fire-and-forget";
import { processInBatches } from "@/lib/async/process-in-batches";
import { cacheGet, cacheSet } from "@/lib/cache/redis";
import { withTimeout } from "@/lib/async/with-timeout";
import { withErrorCapture } from "@/lib/analytics/server-errors";
import { log } from "@/lib/log";

export const maxDuration = 300;

const BATCH_SIZE = 5;
const CONTACTS_CACHE_KEY = "sync-audience:contacts";
const CONTACTS_CACHE_TTL = 3600; // 1h — avoids repeated Resend API calls across same-day cron retries
const HEARTBEAT_KEY = "cron:lastrun:sync-audience";
const HEARTBEAT_TTL_SECONDS = 60 * 60 * 48;

interface Contact {
  id: string;
  email: string;
  unsubscribed: boolean;
}

const LIST_CONTACTS_TIMEOUT_MS = 30_000;

async function listAllContacts(): Promise<Contact[]> {
  const cached = await cacheGet<Contact[]>(CONTACTS_CACHE_KEY).catch(() => null);
  if (cached) return cached;

  const resend = getResend();
  if (!resend) return [];

  const contacts = await withTimeout(
    listAllContactsInner(resend),
    LIST_CONTACTS_TIMEOUT_MS,
    "listAllContacts",
  ).catch((error) => {
    log("error", "[sync-audience] listAllContacts error", { route: "/api/cron/sync-audience", error: (error as Error).message });
    return [];
  });

  fireAndForget(
    () => cacheSet(CONTACTS_CACHE_KEY, contacts, CONTACTS_CACHE_TTL),
    () => undefined,
  );
  return contacts;
}

async function listAllContactsInner(
  resend: ReturnType<typeof getResend> & object,
): Promise<Contact[]> {
  const all: Contact[] = [];
  let cursor: string | undefined;

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

  return all;
}

// ---------------------------------------------------------------------------
// GET /api/cron/sync-audience
// ---------------------------------------------------------------------------

export const GET = withErrorCapture("/api/cron/sync-audience", async (request: NextRequest) => {
  const denied = verifyCronSecret(request);
  if (denied) return denied;

  // Ensure segment exists
  const segmentId = await ensureSegment();
  if (!segmentId) {
    await cacheSet(HEARTBEAT_KEY, Date.now(), HEARTBEAT_TTL_SECONDS);
    return NextResponse.json({
      status: "skipped",
      reason: "no_segment",
    });
  }

  // Get eligible users from DB and existing contacts from Resend.
  // Promise.allSettled ensures one failure doesn't block the other.
  const [usersResult, contactsResult] = await Promise.allSettled([
    dbGetUsersWithEmail(),
    listAllContacts(),
  ]);
  const users = usersResult.status === "fulfilled" ? usersResult.value : [];
  const existingContacts =
    contactsResult.status === "fulfilled" ? contactsResult.value : [];

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

  const added = addResults.succeeded.length;
  const unsubscribed = unsubResults.succeeded.length;

  await cacheSet(HEARTBEAT_KEY, Date.now(), HEARTBEAT_TTL_SECONDS);

  return NextResponse.json({
    status: "ok",
    synced: added,
    unsubscribed,
    totalEligible: users.length,
    totalContacts: existingContacts.length,
  });
});
