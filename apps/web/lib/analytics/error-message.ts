/** Convert an unknown rejection reason to text without throwing. */
export function messageFromReason(reason: unknown): string {
  if (typeof reason === "string") return reason;

  try {
    if (reason instanceof Error) return reason.message;
  } catch {
    // Continue through the failure-proof fallbacks below.
  }

  try {
    const serialized = JSON.stringify(reason);
    if (serialized !== undefined) return serialized;
  } catch {
    // Some values have a throwing toJSON implementation.
  }

  try {
    return String(reason);
  } catch {
    return "Unknown error";
  }
}
