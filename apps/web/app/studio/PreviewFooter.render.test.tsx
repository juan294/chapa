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
      screen.getByText("VERIFIED · abc123 · 2026-08-26"),
    ).toBeDefined();
  });

  it("omits the verification strip when verification is null", () => {
    render(
      <PreviewFooter linkedPlatforms={["github"]} verification={null} />,
    );

    expect(screen.queryByText(/^VERIFIED/)).toBeNull();
  });
});
