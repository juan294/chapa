import { describe, it, expect, vi } from "vitest";
import { NextResponse } from "next/server";
import { withTimeout, dbTimeoutOr504, TimeoutError, DB_TIMEOUT_MS, EMAIL_SEND_TIMEOUT_MS } from "./with-timeout";

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

  it("exports EMAIL_SEND_TIMEOUT_MS as 10_000", () => {
    expect(EMAIL_SEND_TIMEOUT_MS).toBe(10_000);
  });

  it("clears the internal timer when the promise resolves before timeout", async () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    await withTimeout(Promise.resolve("fast"), 60_000);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

describe("dbTimeoutOr504", () => {
  it("returns the resolved value on success", async () => {
    const result = await dbTimeoutOr504(Promise.resolve("data"), "test");
    expect(result).toBe("data");
  });

  it("returns a 504 NextResponse on timeout", async () => {
    vi.useFakeTimers();
    const never = new Promise<string>(() => {});
    const resultPromise = dbTimeoutOr504(never, "test");
    await vi.advanceTimersByTimeAsync(DB_TIMEOUT_MS + 1);
    const result = await resultPromise;
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(504);
    vi.useRealTimers();
  });

  it("re-throws non-timeout errors", async () => {
    const failing = Promise.reject(new Error("db crash"));
    await expect(dbTimeoutOr504(failing, "test")).rejects.toThrow("db crash");
  });
});
