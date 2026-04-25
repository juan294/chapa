// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/lib/verification/store", () => ({
  getVerificationRecord: vi.fn(),
}));

vi.mock("@/components/Navbar", () => ({
  Navbar: () => <nav data-testid="navbar">Navbar</nav>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { getVerificationRecord } from "@/lib/verification/store";
import VerifyPage, { generateMetadata } from "./page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const MOCK_RECORD = {
  handle: "testuser",
  displayName: "Test User",
  adjustedComposite: 72,
  confidence: 85,
  tier: "Gold",
  archetype: "Builder",
  dimensions: {
    delivery: 80,
    quality: 70,
    consistency: 65,
    breadth: 55,
  },
  commitsTotal: 420,
  prsMergedCount: 38,
  reviewsSubmittedCount: 15,
  generatedAt: "2026-03-22",
  profileType: "verified",
};

// ---------------------------------------------------------------------------
// generateMetadata — covers HASH_PATTERN true/false branches
// ---------------------------------------------------------------------------

describe("generateMetadata", () => {
  it("returns verified title for a valid 8-char hex hash", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ hash: "a1b2c3d4" }),
    });
    expect(meta.title).toContain("Verificar");
    expect(meta.title).toContain("a1b2c3d4");
  });

  it("returns invalid hash title for a non-hex hash", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ hash: "not-valid!" }),
    });
    expect(meta.title).toContain("Hash inválido");
  });

  it("disables robots indexing for all verify pages", async () => {
    const meta = await generateMetadata({
      params: Promise.resolve({ hash: "a1b2c3d4" }),
    });
    expect((meta.robots as { index: boolean }).index).toBe(false);
  });
});

describe("VerifyPage", () => {
  describe("invalid hash", () => {
    it("renders InvalidHashCard for non-hex characters", async () => {
      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "zzzzzzzz" }),
      });
      render(jsx);

      expect(screen.getByText("Hash inválido")).toBeDefined();
      expect(
        screen.getByText(
          "El hash de verificación debe tener 8, 16 o 32 caracteres hexadecimales.",
        ),
      ).toBeDefined();
      expect(screen.getByText("zzzzzzzz")).toBeDefined();
    });

    it("renders InvalidHashCard for wrong-length hash", async () => {
      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "abc" }),
      });
      render(jsx);

      expect(screen.getByText("Hash inválido")).toBeDefined();
    });
  });

  describe("valid hash, no record", () => {
    it("renders NotFoundCard when record is null", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(null);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4" }),
      });
      render(jsx);

      expect(screen.getByText("No encontrado")).toBeDefined();
      expect(
        screen.getByText("No se encontró ningún registro de verificación para este hash."),
      ).toBeDefined();
      expect(screen.getByText("a1b2c3d4")).toBeDefined();
    });
  });

  describe("valid hash with record", () => {
    it("renders VerifiedCard with developer info", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(MOCK_RECORD);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
      });
      render(jsx);

      expect(screen.getByText("Insignia verificada")).toBeDefined();
      expect(screen.getByText("@testuser")).toBeDefined();
      expect(screen.getByText("Test User")).toBeDefined();
    });

    it("displays impact score and tier", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(MOCK_RECORD);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
      });
      render(jsx);

      expect(screen.getByText("72")).toBeDefined();
      expect(screen.getByText("Gold")).toBeDefined();
      expect(screen.getByText("Builder")).toBeDefined();
    });

    it("displays all four dimensions", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(MOCK_RECORD);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
      });
      render(jsx);

      expect(screen.getByText("delivery")).toBeDefined();
      expect(screen.getByText("80")).toBeDefined();
      expect(screen.getByText("quality")).toBeDefined();
      expect(screen.getByText("70")).toBeDefined();
      expect(screen.getByText("consistency")).toBeDefined();
      expect(screen.getByText("65")).toBeDefined();
      expect(screen.getByText("breadth")).toBeDefined();
      expect(screen.getByText("55")).toBeDefined();
    });

    it("displays key metrics", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(MOCK_RECORD);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
      });
      render(jsx);

      expect(screen.getByText("420")).toBeDefined();
      expect(screen.getByText("Commits")).toBeDefined();
      expect(screen.getByText("38")).toBeDefined();
      expect(screen.getByText("PRs fusionadas")).toBeDefined();
      expect(screen.getByText("15")).toBeDefined();
      expect(screen.getByText("Reviews")).toBeDefined();
    });

    it("shows generated date and View Badge link", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(MOCK_RECORD);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
      });
      render(jsx);

      expect(screen.getByText("Generado el 2026-03-22")).toBeDefined();
      const viewBadge = screen.getByText("Ver insignia");
      expect(viewBadge.closest("a")?.getAttribute("href")).toBe(
        "/u/testuser/badge.svg",
      );
    });

    it("links developer handle to share page", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue(MOCK_RECORD);

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
      });
      render(jsx);

      const handleLink = screen.getByText("@testuser");
      expect(handleLink.closest("a")?.getAttribute("href")).toBe(
        "/u/testuser",
      );
    });

    it("omits display name row when not provided", async () => {
      vi.mocked(getVerificationRecord).mockResolvedValue({
        ...MOCK_RECORD,
        displayName: undefined,
      });

      const jsx = await VerifyPage({
        params: Promise.resolve({ hash: "a1b2c3d4e5f6a7b8" }),
      });
      render(jsx);

      expect(screen.queryByText("Name")).toBeNull();
    });
  });
});
