import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

import { readFile, stat } from "node:fs/promises";
import { readReportFile, readSharedContext } from "./report-reader";

const mockedStat = vi.mocked(stat);
const mockedReadFile = vi.mocked(readFile);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("readReportFile", () => {
  it("returns content and lastRun when file exists", async () => {
    const mtime = new Date("2026-03-20T10:00:00Z");
    mockedStat.mockResolvedValue({ mtime } as never);
    mockedReadFile.mockResolvedValue("# Report\n> Health status: green");

    const result = await readReportFile("docs/agents/coverage-report.md");

    expect(result.content).toBe("# Report\n> Health status: green");
    expect(result.lastRun).toBe("2026-03-20T10:00:00.000Z");
  });

  it("returns nulls when file does not exist", async () => {
    mockedStat.mockRejectedValue(new Error("ENOENT"));

    const result = await readReportFile("docs/agents/missing-report.md");

    expect(result.content).toBeNull();
    expect(result.lastRun).toBeNull();
  });
});

describe("readSharedContext", () => {
  it("returns content when file exists", async () => {
    mockedReadFile.mockResolvedValue("## Shared Context\n- entry");

    const result = await readSharedContext();

    expect(result).toBe("## Shared Context\n- entry");
  });

  it("returns null when file does not exist", async () => {
    mockedReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await readSharedContext();

    expect(result).toBeNull();
  });
});
