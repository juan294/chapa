// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ClientFeatureFlagsProvider,
  useClientFeatureFlags,
} from "./ClientFeatureFlagsProvider";

vi.mock("@/lib/feature-flags-sync", () => ({
  isStudioEnabledSync: vi.fn(() => true),
}));

function FlagProbe() {
  const { studioEnabled } = useClientFeatureFlags();
  return <div>{studioEnabled ? "studio-on" : "studio-off"}</div>;
}

describe("ClientFeatureFlagsProvider", () => {
  it("uses the server-resolved Studio flag from context", () => {
    render(
      <ClientFeatureFlagsProvider studioEnabled={false}>
        <FlagProbe />
      </ClientFeatureFlagsProvider>,
    );

    expect(screen.getByText("studio-off")).toBeTruthy();
  });

  it("falls back to the sync env check outside the provider", () => {
    render(<FlagProbe />);

    expect(screen.getByText("studio-on")).toBeTruthy();
  });
});
