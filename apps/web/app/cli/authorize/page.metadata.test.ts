import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@/lib/auth/session", () => ({
  getOptionalServerSessionFromHeaders: vi.fn().mockReturnValue(null),
  getSessionSecret: vi.fn().mockReturnValue("secret"),
}));
vi.mock("@/lib/env", () => ({ getBaseUrl: vi.fn().mockReturnValue("https://example.com") }));
vi.mock("@/lib/i18n/server", () => ({
  getServerLocale: vi.fn().mockResolvedValue("en"),
  getServerT: vi.fn().mockReturnValue((key: string) => key),
}));
vi.mock("@/lib/i18n", () => ({ LocaleSync: () => null }));
vi.mock("./AuthorizeClient", () => ({ AuthorizeClient: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CliAuthorizePage generateMetadata", () => {
  it("returns title and robots noindex", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({}) });
    // getServerT is mocked to return the key itself, so this also confirms
    // generateMetadata reads the cliAuthorize.metadataTitle key (not some
    // other key) to build the page title.
    expect(meta.title).toBe("cliAuthorize.metadataTitle");
    expect((meta.robots as { index: boolean }).index).toBe(false);
  });

  it("returns metadata when lang param is provided", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata({ searchParams: Promise.resolve({ lang: "en" }) });
    expect(meta.title).toBeTruthy();
  });
});

describe("CliAuthorizePage — missing session render path", () => {
  it("renders missing-session UI when no session param is provided", async () => {
    const { default: CliAuthorizePage } = await import("./page");
    const jsx = await CliAuthorizePage({ searchParams: Promise.resolve({}) });
    expect(jsx).toBeDefined();
  });
});
