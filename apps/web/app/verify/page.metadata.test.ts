import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/i18n/server", () => ({
  getServerLocale: vi.fn().mockResolvedValue("en"),
  getServerT: vi.fn().mockReturnValue((key: string) => key),
}));

vi.mock("@/components/Navbar", () => ({ Navbar: () => null }));
vi.mock("@/lib/i18n", () => ({ DEFAULT_LOCALE: "es", LocaleSync: () => null }));
vi.mock("./VerifyForm", () => ({ VerifyForm: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VerifyInputPage generateMetadata", () => {
  it("returns title, description, and robots noindex for default locale", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata();
    expect(meta.title).toBeTruthy();
    expect(meta.description).toBeTruthy();
    expect((meta.robots as { index: boolean }).index).toBe(false);
  });

  it("returns metadata when lang param is provided", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata();
    expect(meta.title).toBeTruthy();
  });

  it("declares its own canonical path instead of inheriting the bare origin (#1065 / FE-H1)", async () => {
    const { generateMetadata } = await import("./page");
    const meta = await generateMetadata();
    expect(meta.alternates).toEqual({ canonical: "/verify" });
  });
});
