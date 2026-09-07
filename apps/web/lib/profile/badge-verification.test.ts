import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./score-model", () => ({ readRenderableReceipt: vi.fn() }));
vi.mock("./public-profile", () => ({ getPublicProfileVerification: vi.fn() }));
vi.mock("@/lib/verification/receipt-token", () => ({ deriveReceiptVerificationTokenV7: vi.fn() }));

import { readRenderableReceipt } from "./score-model";
import { getPublicProfileVerification } from "./public-profile";
import { deriveReceiptVerificationTokenV7 } from "@/lib/verification/receipt-token";
import { resolveBadgeVerification } from "./badge-verification";

const profile = (policyVersion: "v6" | "v7") => ({
  stats: { handle: "alice" },
  displayImpact: {},
  statsComplete: true,
  scoring: { policyVersion },
}) as unknown as Parameters<typeof resolveBadgeVerification>[0];

beforeEach(() => {
  vi.mocked(readRenderableReceipt).mockReset();
  vi.mocked(getPublicProfileVerification).mockReset();
  vi.mocked(deriveReceiptVerificationTokenV7).mockReset();
});

describe("resolveBadgeVerification", () => {
  it("attests a v6 badge with the v6 HMAC record", async () => {
    vi.mocked(getPublicProfileVerification).mockReturnValue({ hash: "abc123", date: "2026-09-01" });

    expect(await resolveBadgeVerification(profile("v6"))).toEqual({ hash: "abc123", date: "2026-09-01" });
    expect(readRenderableReceipt).not.toHaveBeenCalled();
  });

  it("attests a v7 badge with its receipt token, never the v6 HMAC", async () => {
    vi.mocked(readRenderableReceipt).mockResolvedValue({
      receipt: { receipt: { window: { referenceDate: "2026-09-01" } } },
    } as never);
    vi.mocked(deriveReceiptVerificationTokenV7).mockResolvedValue("v7.rev.sig");

    expect(await resolveBadgeVerification(profile("v7"))).toEqual({ hash: "v7.rev.sig", date: "2026-09-01" });
    // The failure this guards: a v7 badge carrying a link that resolves to a
    // record of v6 dimensions, tier, archetype and confidence.
    expect(getPublicProfileVerification).not.toHaveBeenCalled();
  });

  it("shows no strip rather than a token that resolves to nothing", async () => {
    vi.mocked(readRenderableReceipt).mockResolvedValue({
      receipt: { receipt: { window: { referenceDate: "2026-09-01" } } },
    } as never);
    vi.mocked(deriveReceiptVerificationTokenV7).mockResolvedValue(null);

    expect(await resolveBadgeVerification(profile("v7"))).toBeNull();
  });

  it("shows no strip for a v7 profile whose receipt cannot be read", async () => {
    vi.mocked(readRenderableReceipt).mockResolvedValue(null);

    expect(await resolveBadgeVerification(profile("v7"))).toBeNull();
    expect(getPublicProfileVerification).not.toHaveBeenCalled();
  });
});
