// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { StatusCallout } from "./StatusCallout";

describe("StatusCallout", () => {
  it("uses terminal-red semantics for errors", () => {
    render(
      <StatusCallout
        variant="error"
        title="Error"
        description="Something failed"
      />,
    );

    const callout = screen.getByRole("alert");
    expect(callout.className).toContain("border-terminal-red/30");
    expect(callout.className).toContain("bg-terminal-red/10");
    expect(screen.getByText("Error").className).toContain("text-terminal-red");
  });

  it("uses complement semantics for verification states", () => {
    render(
      <StatusCallout
        variant="verification"
        title="Verified"
        description="Trust state"
      />,
    );

    const callout = screen.getByRole("status");
    expect(callout.className).toContain("border-complement/30");
    expect(callout.className).toContain("bg-complement/10");
    expect(screen.getByText("Verified").className).toContain("text-complement");
  });

  // #1183 (UX-M10, second half) — Wave 2 kept the site's verification UI on
  // teal rather than carrying the badge's VERIFICATION_CORAL onto it: coral
  // only clears large/bold-text AA contrast on a light background (not
  // normal body text), and sits close enough to terminal-red in hue that the
  // gap narrows to an unsafe margin on light theme for colorblind users. This
  // guard keeps "verified" and "error" on structurally distinct token
  // families so a future edit can't accidentally converge them.
  it("keeps verification and error variants on distinct color families (#1183)", () => {
    // Scoped to this render's own container — this test file doesn't run
    // Testing Library's DOM cleanup between cases, so prior tests' "Verified"
    // / "status" nodes are still present in `screen` at this point.
    const { container } = render(
      <StatusCallout
        variant="verification"
        title="Verified"
        description="Trust state"
      />,
    );
    const verificationTitle = within(container).getByText("Verified").className;
    expect(verificationTitle).toContain("text-complement");
    expect(verificationTitle).not.toContain("terminal-red");
    expect(verificationTitle).not.toContain("coral");
  });
});
