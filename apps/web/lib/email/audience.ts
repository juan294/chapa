/**
 * Resend Audience (Segment) & Contact management.
 *
 * Manages the "Chapa Users" segment and its contacts in Resend.
 * Used for email campaign targeting and audience sync.
 */

import { getResend } from "./resend";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEGMENT_NAME = "Chapa Users";

// ---------------------------------------------------------------------------
// Cached segment ID — avoids repeated API calls
// ---------------------------------------------------------------------------

let _cachedSegmentId: string | null | undefined;

// ---------------------------------------------------------------------------
// Segment management
// ---------------------------------------------------------------------------

/**
 * Auto-creates or finds the "Chapa Users" segment.
 * Caches the result for the lifetime of the process.
 * Returns the segment ID or null on failure.
 */
export async function ensureSegment(): Promise<string | null> {
  if (_cachedSegmentId !== undefined) return _cachedSegmentId;

  const resend = getResend();
  if (!resend) return null;

  try {
    // Try to find existing segment by name
    const { data: listData, error: listError } = await resend.segments.list();

    if (listError) {
      console.error("[audience] Failed to list segments:", listError.message);
      return null;
    }

    const existing = listData.data.find((s) => s.name === SEGMENT_NAME);
    if (existing) {
      _cachedSegmentId = existing.id;
      return existing.id;
    }

    // Create new segment
    const { data: createData, error: createError } =
      await resend.segments.create({ name: SEGMENT_NAME });

    if (createError) {
      console.error(
        "[audience] Failed to create segment:",
        createError.message,
      );
      return null;
    }

    _cachedSegmentId = createData.id;
    return createData.id;
  } catch (error) {
    console.error(
      "[audience] ensureSegment error:",
      (error as Error).message,
    );
    return null;
  }
}

/** Convenience alias for `ensureSegment()`. */
export const getSegmentId = ensureSegment;

// ---------------------------------------------------------------------------
// Contact management
// ---------------------------------------------------------------------------

/**
 * Add a contact to the "Chapa Users" segment.
 * If the contact already exists (409 conflict), updates it instead.
 * Returns the contact ID or null on failure.
 */
export async function addContact(
  email: string,
  opts?: { firstName?: string; handle?: string },
): Promise<string | null> {
  const resend = getResend();
  if (!resend) return null;

  const segmentId = await ensureSegment();
  if (!segmentId) return null;

  try {
    const { data, error } = await resend.contacts.create({
      email,
      firstName: opts?.firstName ?? opts?.handle ?? undefined,
      unsubscribed: false,
      segments: [{ id: segmentId }],
    });

    if (error) {
      // Contact already exists — update instead
      if (error.statusCode === 409) {
        return updateContact(email, { unsubscribed: false });
      }
      console.error("[audience] Failed to add contact:", error.message);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error("[audience] addContact error:", (error as Error).message);
    return null;
  }
}

/**
 * Update an existing contact's properties.
 * Returns the contact ID or null on failure.
 */
export async function updateContact(
  email: string,
  opts: { firstName?: string | null; unsubscribed?: boolean },
): Promise<string | null> {
  const resend = getResend();
  if (!resend) return null;

  try {
    const { data, error } = await resend.contacts.update({
      email,
      ...opts,
    });

    if (error) {
      console.error("[audience] Failed to update contact:", error.message);
      return null;
    }

    return data.id;
  } catch (error) {
    console.error("[audience] updateContact error:", (error as Error).message);
    return null;
  }
}

/**
 * Remove a contact from Resend entirely.
 * Returns true on success, false on failure.
 */
export async function removeContact(email: string): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  try {
    const { error } = await resend.contacts.remove({ email });

    if (error) {
      console.error("[audience] Failed to remove contact:", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[audience] removeContact error:", (error as Error).message);
    return false;
  }
}

/**
 * Mark a contact as unsubscribed in Resend.
 * Returns the contact ID or null on failure.
 */
export async function markUnsubscribed(
  email: string,
): Promise<string | null> {
  return updateContact(email, { unsubscribed: true });
}

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

/** @internal — exported for tests only. Resets the cached segment ID. */
export function _resetSegmentCache(): void {
  _cachedSegmentId = undefined;
}
