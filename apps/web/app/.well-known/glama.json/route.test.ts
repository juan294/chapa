import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /.well-known/glama.json", () => {
  it("returns the exact public Glama ownership claim", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      $schema: "https://glama.ai/mcp/schemas/connector.json",
      claim: "glama_claim_tNcnAmUfI8iOL5RmYytRi2DInoYveyVb",
    });
  });
});
