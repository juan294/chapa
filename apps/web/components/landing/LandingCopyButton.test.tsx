// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LandingCopyButton } from "./LandingCopyButton";
vi.mock("@/lib/analytics/posthog", () => ({ trackEvent: vi.fn() }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("LandingCopyButton", () => {
  it("copies the same illustrative snippet from pointer and command and reports failures", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<LandingCopyButton text="example Markdown" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("example Markdown"));
    writeText.mockRejectedValueOnce(new Error("denied"));
    const complete = vi.fn();
    fireEvent(window, new CustomEvent("chapa:landing-copy", { detail: { complete } }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith(false));
    expect(screen.getByRole("status").textContent).toContain("Failed");
  });
});
