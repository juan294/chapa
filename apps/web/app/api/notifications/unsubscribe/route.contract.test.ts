import { describe, expect, it, vi } from "vitest";
import { generateUnsubscribeToken } from "@/lib/auth/unsubscribe-token";
import { invokeJson } from "@/test/contract/invoke";

const { mockDbGetUserEmail, mockDbUpdateEmailNotifications, mockMarkUnsubscribed } =
  vi.hoisted(() => ({
    mockDbGetUserEmail: vi.fn(async () => ({ email: "octocat@example.com" })),
    mockDbUpdateEmailNotifications: vi.fn(async () => true),
    mockMarkUnsubscribed: vi.fn(async () => undefined),
  }));

vi.mock("@/lib/db/users", () => ({
  dbGetUserEmail: mockDbGetUserEmail,
  dbUpdateEmailNotifications: mockDbUpdateEmailNotifications,
}));

vi.mock("@/lib/email/audience", () => ({
  markUnsubscribed: mockMarkUnsubscribed,
}));

import { GET } from "./route";

describe("GET /api/notifications/unsubscribe contract", () => {
  it("rejects missing handle without a 5xx", async () => {
    const response = await invokeJson(GET, {
      method: "GET",
      path: "/api/notifications/unsubscribe",
    });

    expect(response.status).toBe(400);
  });

  it("updates notification preferences for a valid unsubscribe token", async () => {
    const secret = process.env.NEXTAUTH_SECRET ?? "";
    const token = generateUnsubscribeToken("octocat", secret);
    const response = await invokeJson(GET, {
      method: "GET",
      path: `/api/notifications/unsubscribe?handle=octocat&token=${encodeURIComponent(token)}`,
    });

    expect(response.status).toBe(200);
    expect(String(response.body)).toContain("Unsubscribed");
    expect(mockDbUpdateEmailNotifications).toHaveBeenCalledWith("octocat", false);
  });
});
