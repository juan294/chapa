import { describe, expect, it, vi } from "vitest";
import { after, NextResponse } from "next/server";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

describe("contract Next runtime stubs resolve from the web package", () => {
  it("runs after callbacks without a Next request scope while preserving real responses", () => {
    const callback = vi.fn();
    expect(() => after(callback)).not.toThrow();
    expect(callback).toHaveBeenCalledExactlyOnceWith();
    expect(NextResponse.json({ ok: true }).status).toBe(200);
  });

  it("bypasses request-scoped cache APIs while preserving callback arguments and results", async () => {
    const callback = vi.fn(async (value: string) => `value:${value}`);
    const cached = unstable_cache(callback, ["contract-runtime"]);
    expect(await cached("first")).toBe("value:first");
    expect(await cached("second")).toBe("value:second");
    expect(callback.mock.calls).toEqual([["first"], ["second"]]);
    expect(vi.isMockFunction(revalidatePath)).toBe(true);
    expect(vi.isMockFunction(revalidateTag)).toBe(true);
    expect(() => revalidatePath("/contract-runtime")).not.toThrow();
    expect(() => revalidateTag("contract-runtime", "max")).not.toThrow();
  });
});
