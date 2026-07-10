/**
 * Shared test helper for asserting a mocked `next/dynamic()` loader
 * resolves to the expected component.
 *
 * Import from "../lib/test-helpers/dynamic-mock" (relative) in any test file
 * that mocks `next/dynamic` with `vi.fn(...)`.
 */

import { vi, type Mock } from "vitest";

export async function resolveDynamicLoader<T>(
  dynamicFn: unknown,
  index = 0,
): Promise<T> {
  const call = vi.mocked(dynamicFn as Mock).mock.calls[index];
  if (!call) throw new Error("dynamic() was not called");
  const loader = call[0] as () => Promise<{ default: T }>;
  const resolved = await loader();
  return resolved.default;
}
