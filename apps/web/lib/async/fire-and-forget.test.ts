import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireAndForget } from "./fire-and-forget";

describe("fireAndForget", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

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

  it("logs via the default onError when no handler is supplied and the promise rejects", async () => {
    const error = new Error("default-async");

    fireAndForget(async () => {
      throw error;
    });

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("[fire-and-forget]", error);
    });
  });

  it("logs via the default onError when no handler is supplied and the callback throws synchronously", async () => {
    const error = new Error("default-sync");

    fireAndForget(() => {
      throw error;
    });

    await vi.waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("[fire-and-forget]", error);
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
