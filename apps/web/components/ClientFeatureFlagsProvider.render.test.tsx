// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ClientFeatureFlagsProvider,
  useClientFeatureFlags,
} from "./ClientFeatureFlagsProvider";

vi.mock("@/lib/feature-flags-sync", () => ({
  isStudioEnabledSync: vi.fn(() => true),
  isInsightsEnabledSync: vi.fn(() => false),
  isBitbucketEnabledSync: vi.fn(() => false),
  isCodebergEnabledSync: vi.fn(() => false),
  isGitlabEnabledSync: vi.fn(() => false),
}));

function FlagProbe() {
  const { studioEnabled, bitbucketEnabled } = useClientFeatureFlags();
  return (
    <div>
      {studioEnabled ? "studio-on" : "studio-off"}
      {bitbucketEnabled ? " bitbucket-on" : " bitbucket-off"}
    </div>
  );
}

describe("ClientFeatureFlagsProvider", () => {
  it("uses the server-resolved Studio flag from context", () => {
    render(
      <ClientFeatureFlagsProvider
        flags={{
          studioEnabled: false,
          insightsEnabled: false,
          bitbucketEnabled: true,
          codebergEnabled: false,
          gitlabEnabled: false,
        }}
      >
        <FlagProbe />
      </ClientFeatureFlagsProvider>,
    );

    expect(screen.getByText(/studio-off/)).toBeTruthy();
    expect(screen.getByText(/bitbucket-on/)).toBeTruthy();
  });

  it("falls back to the sync env check outside the provider", () => {
    render(<FlagProbe />);

    expect(screen.getByText(/studio-on/)).toBeTruthy();
  });
});
