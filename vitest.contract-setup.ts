import { beforeAll, vi } from "vitest";
import { _resetClient as resetSupabaseClient } from "@/lib/db/supabase";
import { redisFake } from "@/test/contract/redis-fake";

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXTAUTH_SECRET",
  "CHAPA_VERIFICATION_SECRET",
  "CRON_SECRET",
  "ADMIN_SECRET",
] as const;

for (const name of REQUIRED_ENV) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Missing required contract-test env var: ${name}`);
  }
}

process.env.NEXT_PUBLIC_INSIGHTS_ENABLED ??= "true";
process.env.NEXT_PUBLIC_STUDIO_ENABLED ??= "true";
process.env.NEXT_PUBLIC_BITBUCKET_ENABLED ??= "true";
process.env.NEXT_PUBLIC_CODEBERG_ENABLED ??= "true";
process.env.NEXT_PUBLIC_GITLAB_ENABLED ??= "true";

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

vi.mock("@/lib/cache/redis", () => redisFake);

vi.mock("@/lib/feature-flags", () => ({
  isStudioEnabled: vi.fn(async () => true),
  isBitbucketEnabled: vi.fn(async () => true),
  isCodebergEnabled: vi.fn(async () => true),
  isGitlabEnabled: vi.fn(async () => true),
  isInsightsEnabled: vi.fn(async () => true),
  isExperimentsEnabled: vi.fn(async () => true),
  isAgentEnabled: vi.fn(async () => false),
  isStudioEnabledSync: vi.fn(() => true),
  isBitbucketEnabledSync: vi.fn(() => true),
  isCodebergEnabledSync: vi.fn(() => true),
  isGitlabEnabledSync: vi.fn(() => true),
  isInsightsEnabledSync: vi.fn(() => true),
  invalidateFeatureFlagCache: vi.fn(),
  _resetFlagCache: vi.fn(),
}));

beforeAll(() => {
  resetSupabaseClient();
  redisFake.__reset();
});
