// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import SharePageLoading from "./loading";

afterEach(cleanup);

// #1109 (UX-H3): the aria-label and sr-only text must come from the i18n
// dictionary, not a hardcoded English literal. This is a static server
// component (no client hooks, matching app/loading.tsx's "lightweight
// implementation" invariant), so it always renders the DEFAULT_LOCALE
// ('es', #861) dictionary's text.
describe("SharePageLoading render — i18n (#1109)", () => {
  it("renders the DEFAULT_LOCALE (Spanish) aria-label and sr-only text", () => {
    render(<SharePageLoading />);
    expect(screen.getByRole("status", { name: "Cargando" })).toBeDefined();
    expect(screen.getByText("Cargando...")).toBeDefined();
  });
});
