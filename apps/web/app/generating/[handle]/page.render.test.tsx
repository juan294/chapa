// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const { mockNotFound } = vi.hoisted(() => ({
  mockNotFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

vi.mock("@/lib/validation", () => ({
  isValidHandle: vi.fn((h: string) => /^[a-zA-Z0-9-]+$/.test(h)),
}));

vi.mock("./GeneratingProgress", () => ({
  GeneratingProgress: ({ handle }: { handle: string }) => (
    <div data-testid="generating-progress">{handle}</div>
  ),
}));

// Mock getServerLocale + getServerT to return English without needing Next.js headers()
vi.mock("@/lib/i18n/server", async () => {
  const { en } = await import("@/lib/i18n/dictionaries/en");
  function deepGet(obj: Record<string, unknown>, key: string): unknown {
    const parts = key.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || typeof current !== "object" || Array.isArray(current)) return key;
      current = (current as Record<string, unknown>)[part];
      if (current === undefined) return key;
    }
    return current;
  }
  return {
    getServerLocale: vi.fn().mockResolvedValue("en"),
    getServerT: vi.fn().mockImplementation(() => (key: string) =>
      deepGet(en as unknown as Record<string, unknown>, key)
    ),
  };
});

import GeneratingPage, { generateMetadata } from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GeneratingPage render", () => {
  it("renders GeneratingProgress for valid handle", async () => {
    const page = await GeneratingPage({
      params: Promise.resolve({ handle: "testuser" }),
      searchParams: Promise.resolve({}),
    });
    render(page);
    expect(screen.getByTestId("generating-progress")).toBeDefined();
    expect(screen.getByText("testuser")).toBeDefined();
  });

  it("calls notFound for invalid handle", async () => {
    await GeneratingPage({
      params: Promise.resolve({ handle: "invalid handle!" }),
      searchParams: Promise.resolve({}),
    });
    expect(mockNotFound).toHaveBeenCalled();
  });
});

describe("generateMetadata", () => {
  it("returns metadata with handle in title", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ handle: "testuser" }),
      searchParams: Promise.resolve({}),
    });
    // English: generation.metadataTitle = 'Generating badge'
    expect(metadata.title).toBe("Generating badge — @testuser");
  });

  it("sets robots noindex", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ handle: "testuser" }),
      searchParams: Promise.resolve({}),
    });
    expect(metadata.robots).toEqual({ index: false });
  });
});
