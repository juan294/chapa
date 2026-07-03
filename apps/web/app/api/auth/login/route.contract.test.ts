import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { invokeJson } from "@/test/contract/invoke";

import { GET } from "./route";

describe("GET /api/auth/login contract", () => {
  const oldClientId = process.env.GITHUB_CLIENT_ID;
  const oldBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  beforeAll(() => {
    process.env.GITHUB_CLIENT_ID = "contract-github-client-id";
    process.env.NEXT_PUBLIC_BASE_URL = "https://contract.test";
  });

  afterAll(() => {
    if (oldClientId === undefined) {
      delete process.env.GITHUB_CLIENT_ID;
    } else {
      process.env.GITHUB_CLIENT_ID = oldClientId;
    }
    if (oldBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_BASE_URL;
    } else {
      process.env.NEXT_PUBLIC_BASE_URL = oldBaseUrl;
    }
  });

  it("redirects to GitHub OAuth and stores state cookies", async () => {
    const response = await invokeJson(GET, {
      method: "GET",
      path: "/api/auth/login?redirect=%2Fu%2Foctocat",
    });

    expect(response.status).toBe(307);
    expect(String(response.body)).toBe("");
  });
});
