import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ direct: vi.fn(), fallback: vi.fn() }));
vi.mock("./db/feature-flags", () => ({ dbReadScoringFlagDirect: mocks.direct }));
vi.mock("./env", () => ({ getScoringV7RenderingEnabledEnv: mocks.fallback }));
import { readScoringRenderSelection, invalidateScoringRenderSelection, sameScoringRenderSelection, scoringResponseMaxAge } from "./scoring-render-selection";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10000); vi.resetAllMocks(); invalidateScoringRenderSelection(); mocks.direct.mockResolvedValue(true); });
afterEach(() => vi.useRealTimers());
describe("bounded scoring selection", () => {
  it("uses the direct row and refreshes within five seconds", async () => {
    const on = await readScoringRenderSelection();
    expect(on).toMatchObject({ enabled: true, machinePolicy: "v7.2", cacheable: true });
    mocks.direct.mockResolvedValue(false);
    vi.setSystemTime(14999);
    expect((await readScoringRenderSelection()).enabled).toBe(true);
    vi.setSystemTime(15000);
    expect((await readScoringRenderSelection()).machinePolicy).toBe("v6");
    expect(mocks.direct).toHaveBeenCalledTimes(2);
  });
  it("refreshes the current context at UTC midnight and expires prior-day responses", async () => {
    vi.setSystemTime("2026-09-08T23:59:58.500Z");
    const prior = await readScoringRenderSelection();
    expect(scoringResponseMaxAge(prior)).toBe(1);
    vi.setSystemTime("2026-09-09T00:00:00.100Z");
    const current = await readScoringRenderSelection();
    expect(mocks.direct).toHaveBeenCalledTimes(2);
    expect(current.capturedAt).toBe(Date.now());
    expect(scoringResponseMaxAge(prior)).toBe(0);
    expect(scoringResponseMaxAge(current)).toBe(300);
  });
  it("force reread sees a changed policy without waiting for the cache", async () => {
    const first = await readScoringRenderSelection();
    mocks.direct.mockResolvedValue(false);
    const second = await readScoringRenderSelection({ force: true });
    expect(sameScoringRenderSelection(first, second)).toBe(false);
  });
  it("does not cache lookup failure or let it populate a successful namespace", async () => {
    mocks.direct.mockRejectedValueOnce(new Error("database unavailable"));
    mocks.fallback.mockReturnValue("true");
    const failed = await readScoringRenderSelection();
    expect(failed).toMatchObject({ enabled: true, machinePolicy: "v7.2", cacheable: false });
    expect(scoringResponseMaxAge(failed)).toBe(0);
    expect(sameScoringRenderSelection(failed, failed)).toBe(false);
    expect((await readScoringRenderSelection()).cacheable).toBe(true);
  });
  it("bounds a stalled direct read and ignores its late result", async () => {
    let resolve!: (flag: boolean) => void;
    mocks.direct.mockReturnValueOnce(new Promise<boolean>(done => { resolve = done; }));
    const pending = readScoringRenderSelection();
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toMatchObject({ enabled: false, cacheable: false });
    resolve(false);
    await Promise.resolve();
    expect((await readScoringRenderSelection()).enabled).toBe(true);
  });
  it("invalidates an in-flight old read after a flag mutation", async () => {
    let resolve!: (flag: boolean) => void;
    mocks.direct.mockReturnValueOnce(new Promise<boolean>(done => { resolve = done; }));
    const pending = readScoringRenderSelection();
    invalidateScoringRenderSelection();
    resolve(false);
    expect((await pending).cacheable).toBe(false);
    expect((await readScoringRenderSelection()).enabled).toBe(true);
  });
  it("caps response freshness by selection age and never treats timestamps as policy identity", async () => {
    const first = await readScoringRenderSelection();
    expect(scoringResponseMaxAge(first)).toBe(300);
    vi.setSystemTime(12250);
    expect(scoringResponseMaxAge(first)).toBe(297);
    const same = await readScoringRenderSelection({ force: true });
    expect(sameScoringRenderSelection(first, same)).toBe(true);
    vi.setSystemTime(310001);
    expect(scoringResponseMaxAge(first)).toBe(0);
  });
});
