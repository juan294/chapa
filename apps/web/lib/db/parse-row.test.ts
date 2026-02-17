import { describe, it, expect } from "vitest";
import { parseRow, parseRows } from "./parse-row";

// ---------------------------------------------------------------------------
// parseRow — single-row runtime validation
// ---------------------------------------------------------------------------

describe("parseRow", () => {
  const requiredKeys = ["name", "age"] as const;

  it("returns the typed object when all required keys are present", () => {
    const input = { name: "Alice", age: 30, extra: true };
    const result = parseRow(input, requiredKeys);
    expect(result).toEqual(input);
  });

  it("returns null when input is null", () => {
    const result = parseRow(null, requiredKeys);
    expect(result).toBeNull();
  });

  it("returns null when input is undefined", () => {
    const result = parseRow(undefined, requiredKeys);
    expect(result).toBeNull();
  });

  it("returns null when input is not an object", () => {
    expect(parseRow("string", requiredKeys)).toBeNull();
    expect(parseRow(42, requiredKeys)).toBeNull();
    expect(parseRow(true, requiredKeys)).toBeNull();
  });

  it("returns null when a required key is missing", () => {
    const input = { name: "Alice" }; // missing "age"
    const result = parseRow(input, requiredKeys);
    expect(result).toBeNull();
  });

  it("returns null when a required key is undefined", () => {
    const input = { name: "Alice", age: undefined };
    const result = parseRow(input, requiredKeys);
    expect(result).toBeNull();
  });

  it("allows null values for required keys (nullable columns)", () => {
    const input = { name: "Alice", age: null };
    const result = parseRow(input, requiredKeys);
    expect(result).toEqual(input);
  });

  it("preserves extra keys not in the required list", () => {
    const input = { name: "Alice", age: 30, email: "a@b.com" };
    const result = parseRow(input, requiredKeys);
    expect(result).toHaveProperty("email", "a@b.com");
  });

  it("works with an empty required keys list", () => {
    const input = { foo: "bar" };
    const result = parseRow(input, []);
    expect(result).toEqual(input);
  });

  it("logs a warning on invalid row when label is provided", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    parseRow(null, requiredKeys, "TestTable");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[db] TestTable"),
    );
    warnSpy.mockRestore();
  });

  it("does not log when no label is provided", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    parseRow(null, requiredKeys);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// parseRows — array validation
// ---------------------------------------------------------------------------

describe("parseRows", () => {
  const requiredKeys = ["id", "value"] as const;

  it("returns typed array when all rows are valid", () => {
    const input = [
      { id: 1, value: "a" },
      { id: 2, value: "b" },
    ];
    const result = parseRows(input, requiredKeys);
    expect(result).toEqual(input);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when input is null", () => {
    expect(parseRows(null, requiredKeys)).toEqual([]);
  });

  it("returns empty array when input is undefined", () => {
    expect(parseRows(undefined, requiredKeys)).toEqual([]);
  });

  it("filters out invalid rows (missing required keys)", () => {
    const input = [
      { id: 1, value: "a" },
      { id: 2 }, // missing "value"
      { id: 3, value: "c" },
    ];
    const result = parseRows(input, requiredKeys);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1, value: "a" });
    expect(result[1]).toEqual({ id: 3, value: "c" });
  });

  it("filters out null entries in the array", () => {
    const input = [{ id: 1, value: "a" }, null, { id: 2, value: "b" }];
    const result = parseRows(input, requiredKeys);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when no rows are valid", () => {
    const input = [{ id: 1 }, { value: "b" }]; // all missing a key
    const result = parseRows(input, requiredKeys);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty input array", () => {
    expect(parseRows([], requiredKeys)).toEqual([]);
  });
});

// Need vi for spyOn
import { vi } from "vitest";
