// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
