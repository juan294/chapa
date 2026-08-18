/**
 * Shared session shape + Redis key for the CLI device-authorization flow
 * (`/api/cli/auth/poll` + `/api/cli/auth/approve`).
 *
 * Both routes read and write the same `cli:device:<sessionId>` Redis entry, so
 * the shape and key builder are centralized here to keep them from drifting —
 * a mismatch (or a route that blindly overwrites fields the other route relies
 * on) silently breaks the device-binding guarantee. See `poll/route.ts` for the
 * full RFC 8628-style device_code design (#869) and BE-H3/SE-H1 (#1078/#1097)
 * for the approval read-modify-write fix that this type supports.
 */
export interface CliDeviceSession {
  status: "pending" | "approved";
  handle?: string;
  /** RFC 8628-style high-entropy secret (BE-M2 #869). Only the originating CLI device
   *  should possess this. Offered on the first poll. Absent on sessions created
   *  before this hardening. */
  deviceCode?: string;
  /** Set true once a poll has echoed back the correct {@link deviceCode}, proving the
   *  client actually possesses it. ONLY once confirmed is device_code enforced on
   *  subsequent polls. This keeps existing (legacy) CLI binaries — which never echo
   *  the code — fully working via sessionId only. See enforcement logic in poll/route.ts. */
  deviceCodeConfirmed?: boolean;
}

/** Redis key for a CLI device-authorization session. */
export function cliDeviceSessionKey(sessionId: string): string {
  return `cli:device:${sessionId}`;
}
