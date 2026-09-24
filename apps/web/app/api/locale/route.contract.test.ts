import { beforeEach, describe, expect, it, vi } from "vitest";
import { bodyAsRecord, invokeJson } from "@/test/contract/invoke";

const { mockWriteLocaleCookie } = vi.hoisted(() => ({
  mockWriteLocaleCookie: vi.fn(async () => undefined),
}));

vi.mock("@/lib/i18n/cookie", () => ({
  writeLocaleCookie: mockWriteLocaleCookie,
}));

import { POST } from "./route";

describe("POST /api/locale contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a valid locale and returns ok", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/locale",
      body: { locale: "es" },
    });

    expect(response.status).toBe(200);
    expect(bodyAsRecord(response).ok).toBe(true);
    expect(mockWriteLocaleCookie).toHaveBeenCalledWith("es");
  });

  it("rejects an unsupported locale without writing a cookie", async () => {
    const response = await invokeJson(POST, {
      method: "POST",
      path: "/api/locale",
      body: { locale: "fr" },
    });

    expect(response.status).toBe(400);
    expect(mockWriteLocaleCookie).not.toHaveBeenCalled();
  });
});
