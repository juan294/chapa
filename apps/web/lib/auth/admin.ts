/**
 * Admin role identification.
 *
 * Uses `ADMIN_HANDLES` env var (comma-separated GitHub handles, server-side only).
 * Comparison is case-insensitive since GitHub handles are case-insensitive.
 */

export function isAdminHandle(handle: string): boolean {
  if (!handle) return false;
  const raw = process.env.ADMIN_HANDLES?.trim();
  if (!raw) return false;

  const admins = raw.split(",").map((h) => h.trim().toLowerCase());
  return admins.includes(handle.toLowerCase());
}
