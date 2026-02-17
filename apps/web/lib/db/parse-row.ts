/**
 * Runtime row validation for Supabase query results.
 *
 * Replaces unsafe `as unknown as RowType` casts with a runtime check
 * that verifies required fields exist before returning a typed object.
 * Returns null (single) or filters out invalid entries (array) instead
 * of blindly trusting the shape of the data from the database.
 */

/**
 * Validate that a value is a non-null object containing all required keys.
 * Returns the value typed as T if valid, or null otherwise.
 *
 * Nullable column values (null) are allowed — only missing keys and
 * undefined values are rejected, since those indicate a schema mismatch.
 *
 * @param value - The raw query result (unknown shape from Supabase)
 * @param requiredKeys - Keys that must be present and not undefined
 * @param label - Optional label for warning logs (e.g. table name)
 */
export function parseRow<T extends object>(
  value: unknown,
  requiredKeys: readonly (keyof T & string)[],
  label?: string,
): T | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    if (label) {
      console.warn(`[db] ${label}: expected row object, got ${value === null ? "null" : typeof value}`);
    }
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of requiredKeys) {
    if (!(key in record) || record[key] === undefined) {
      if (label) {
        console.warn(`[db] ${label}: row missing required key "${key}"`);
      }
      return null;
    }
  }

  return value as T;
}

/**
 * Validate an array of rows, filtering out any that fail validation.
 * Returns an empty array if the input is null/undefined.
 *
 * @param values - The raw array from Supabase (may contain nulls)
 * @param requiredKeys - Keys that must be present on each valid row
 * @param label - Optional label for warning logs
 */
export function parseRows<T extends object>(
  values: unknown[] | null | undefined,
  requiredKeys: readonly (keyof T & string)[],
  label?: string,
): T[] {
  if (!values) return [];

  return values
    .map((v) => parseRow<T>(v, requiredKeys, label))
    .filter((v): v is T => v !== null);
}
