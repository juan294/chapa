// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/lib/i18n/provider";
import { es } from "@/lib/i18n/dictionaries/es";

vi.mock("@/lib/env", () => ({
  getBaseUrl: () => "https://studio.test",
}));

import { PreviewFooter } from "./PreviewFooter";

afterEach(cleanup);

describe("PreviewFooter", () => {
  it("renders platform logos in canonical order and shows the configured host", () => {
    const { container } = render(
      <PreviewFooter
        linkedPlatforms={["gitlab", "github", "codeberg", "bitbucket"]}
        verification={null}
      />,
    );

    expect(
      Array.from(container.querySelectorAll("[data-platform]")).map((logo) =>
        logo.getAttribute("data-platform"),
      ),
    ).toEqual(["github", "bitbucket", "codeberg", "gitlab"]);
    expect(screen.getByText("studio.test")).toBeDefined();
    expect(screen.queryByText("https://studio.test")).toBeNull();
  });

  it("uses the localized accessible label for the platform group", () => {
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <PreviewFooter linkedPlatforms={["github"]} verification={null} />
      </LanguageProvider>,
    );

    expect(
      screen.getByRole("group", { name: "Plataformas conectadas" }),
    ).toBeDefined();
  });

  it("renders the verification strip when verification is present", () => {
    render(
      <PreviewFooter
        linkedPlatforms={["github"]}
        verification={{ hash: "abc123", date: "2026-08-26" }}
      />,
    );

    expect(
      screen.getByLabelText("Verified · abc123 · 2026-08-26"),
    ).toBeDefined();
  });

  it("keeps four platforms and full verification values accessible at 320px", () => {
    const hash = "0123456789abcdef0123456789abcdef";
    const { container } = render(
      <div style={{ width: 320 }}>
        <PreviewFooter
          linkedPlatforms={["gitlab", "github", "codeberg", "bitbucket"]}
          verification={{ hash, date: "2026-08-26" }}
        />
      </div>,
    );

    const layout = container.querySelector("footer > div")!;
    expect(layout.className).toContain("flex-col");
    expect(layout.className).toContain("sm:flex-row");

    const host = screen.getByText("studio.test");
    expect(host.className).toContain("truncate");
    expect(host.getAttribute("aria-label")).toBe("studio.test");

    const hashNode = screen.getByText(hash);
    expect(hashNode.className).toContain("break-all");
    expect(
      screen.getByLabelText(`Verified · ${hash} · 2026-08-26`),
    ).toBeDefined();
  });

  it("localizes visible branding and verification copy", () => {
    render(
      <LanguageProvider initialLocale="es" dictionary={es}>
        <PreviewFooter
          linkedPlatforms={["github"]}
          verification={{ hash: "abc123", date: "2026-08-26" }}
        />
      </LanguageProvider>,
    );

    expect(
      screen.getByText("Forjada con propósito. Impulsada por la curiosidad."),
    ).toBeDefined();
    expect(screen.getByText("VERIFICADA")).toBeDefined();
  });

  it("omits the verification strip when verification is null", () => {
    render(
      <PreviewFooter linkedPlatforms={["github"]} verification={null} />,
    );

    expect(screen.queryByText(/^VERIFIED/)).toBeNull();
  });
});
