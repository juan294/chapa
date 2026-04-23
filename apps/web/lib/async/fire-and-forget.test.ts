import { describe, expect, it, vi } from "vitest";
import { fireAndForget } from "./fire-and-forget";

describe("fireAndForget", () => {
  it("invokes onError when the promise rejects", async () => {
    const onError = vi.fn();

    fireAndForget(async () => {
      throw new Error("x");
    }, onError);

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  it("invokes onError when the callback throws synchronously", async () => {
    const onError = vi.fn();

    fireAndForget(() => {
      throw new Error("sync");
    }, onError);

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
    });
  });

  it("is a no-op on resolved promises", async () => {
    const onError = vi.fn();

    fireAndForget(async () => "ok", onError);

    await Promise.resolve();
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
  });
});
