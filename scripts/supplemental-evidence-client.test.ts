import { describe, expect, it, vi } from "vitest";
import { buildSupplementalFixture, sendSupplementalEvidence } from "./supplemental-evidence-client";
import { parseSupplementalEvidenceV2 } from "../apps/web/lib/platform/evidence-aging";
const reference = "2026-09-05T12:00:00.000Z";
describe("supplemental producer fixture", () => {
  it("is deterministic and accepted by the real v2 parser", () => {
    const value = buildSupplementalFixture("alice", "alice-work", reference);
    expect(buildSupplementalFixture("alice", "alice-work", reference)).toEqual(value);
    expect(parseSupplementalEvidenceV2(value, "alice", reference)).toEqual(value);
    expect(value.events[0]?.actorId).toBe(value.source.subjectId);
  });
  it("cannot construct a primary-account or future-free ambiguous fixture", () => {
    expect(() => buildSupplementalFixture("alice", "alice", reference)).toThrow();
    expect(() => buildSupplementalFixture("alice", "alice-work", "2026-09-05")).toThrow();
  });
  it("sends to the chosen endpoint once and never follows a credential-bearing redirect", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, persisted: true }), { status: 200 }));
    const body = buildSupplementalFixture("alice", "alice-work", reference);
    expect(await sendSupplementalEvidence("http://127.0.0.1:3000", "cli-private", body, fetcher)).toEqual({ success: true, persisted: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe("http://127.0.0.1:3000/api/supplemental");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: "POST", redirect: "error", headers: { Authorization: "Bearer cli-private" }, body: JSON.stringify(body) });
  });
  it.each(["http://user:pass@localhost:3000", "http://example.com", "https://example.com/?token=x", "https://example.com/#fragment"])('rejects unsafe endpoint configuration %s', async endpoint => {
    const fetcher = vi.fn();
    await expect(sendSupplementalEvidence(endpoint, "cli-private", {}, fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not expose the token or private server error body on failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("private server detail", { status: 503 }));
    await expect(sendSupplementalEvidence("http://localhost:3000", "cli-private", {}, fetcher)).rejects.toThrow("Supplemental upload failed (503)");
  });
});
