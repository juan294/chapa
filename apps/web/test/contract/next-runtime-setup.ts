import { vi } from "vitest";

// Next belongs to the web workspace. Register these mocks from here so they
// resolve the same package as app imports; the repository root has no Next
// dependency. Run before the root setup imports Supabase -> with-timeout.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (cb: () => void | Promise<void>) => {
      void cb();
    },
  };
});

vi.mock("next/cache", () => ({
  unstable_cache: <Args extends unknown[], Result>(
    fn: (...args: Args) => Result,
  ) => fn,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
