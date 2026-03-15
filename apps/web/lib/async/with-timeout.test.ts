import { describe, it, expect } from "vitest";
import { withTimeout, TimeoutError, DB_TIMEOUT_MS } from "./with-timeout";

describe("withTimeout", () => {
  it("resolves when the promise completes within the timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 1000);
    expect(result).toBe("ok");
  });

  it("throws TimeoutError when the promise exceeds the timeout", async () => {
    // Use a never-resolving promise and a very short real timeout
    const never = new Promise<string>(() => {});

    await expect(withTimeout(never, 10)).rejects.toThrow(TimeoutError);
  });

  it("includes timeout duration in error message", async () => {
    const never = new Promise<string>(() => {});

    await expect(withTimeout(never, 15)).rejects.toThrow(
      /timed out after 15ms/i,
    );
  });

  it("uses a custom label in the error message when provided", async () => {
    const never = new Promise<string>(() => {});

    await expect(
      withTimeout(never, 10, "dbGetAdminUsers"),
    ).rejects.toThrow(/dbGetAdminUsers timed out/i);
  });

  it("propagates the original error when the promise rejects before timeout", async () => {
    const failing = Promise.reject(new Error("db connection failed"));

    await expect(withTimeout(failing, 5000)).rejects.toThrow(
      "db connection failed",
    );
  });

  it("TimeoutError is an instance of Error", () => {
    const err = new TimeoutError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TimeoutError);
    expect(err.name).toBe("TimeoutError");
  });

  it("exports DB_TIMEOUT_MS as 10_000", () => {
    expect(DB_TIMEOUT_MS).toBe(10_000);
  });
});
