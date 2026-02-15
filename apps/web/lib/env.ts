/**
 * Centralized base URL accessor.
 *
 * Reads NEXT_PUBLIC_BASE_URL from the environment, trims whitespace, and
 * falls back to the production domain when the variable is unset or empty.
 */
export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    "https://chapa.thecreativetoken.com"
  );
}
