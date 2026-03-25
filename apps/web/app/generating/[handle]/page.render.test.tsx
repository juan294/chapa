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

import GeneratingPage, { generateMetadata } from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("GeneratingPage render", () => {
  it("renders GeneratingProgress for valid handle", async () => {
    const page = await GeneratingPage({ params: Promise.resolve({ handle: "testuser" }) });
    render(page);
    expect(screen.getByTestId("generating-progress")).toBeDefined();
    expect(screen.getByText("testuser")).toBeDefined();
  });

  it("calls notFound for invalid handle", async () => {
    await GeneratingPage({ params: Promise.resolve({ handle: "invalid handle!" }) });
    expect(mockNotFound).toHaveBeenCalled();
  });
});

describe("generateMetadata", () => {
  it("returns metadata with handle in title", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ handle: "testuser" }) });
    expect(metadata.title).toBe("Generating badge — @testuser");
  });

  it("sets robots noindex", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ handle: "testuser" }) });
    expect(metadata.robots).toEqual({ index: false });
  });
});
