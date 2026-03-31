// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock getResend — returns a mock Resend client
// ---------------------------------------------------------------------------

const mockSegmentsList = vi.fn();
const mockSegmentsCreate = vi.fn();
const mockContactsCreate = vi.fn();
const mockContactsUpdate = vi.fn();
const mockContactsRemove = vi.fn();

const mockResend = {
  segments: { list: mockSegmentsList, create: mockSegmentsCreate },
  contacts: {
    create: mockContactsCreate,
    update: mockContactsUpdate,
    remove: mockContactsRemove,
  },
};

vi.mock("./resend", () => ({
  getResend: vi.fn(() => mockResend),
}));

// ---------------------------------------------------------------------------
// Mock withTimeout — pass-through by default, track calls
// ---------------------------------------------------------------------------

const mockWithTimeout = vi.fn(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  <T>(promise: Promise<T>, ...rest: unknown[]) => promise,
);

vi.mock("@/lib/async/with-timeout", () => ({
  withTimeout: (...args: [Promise<unknown>, number?, string?]) =>
    mockWithTimeout(args[0], args[1], args[2]),
  EMAIL_SEND_TIMEOUT_MS: 10_000,
}));

import { getResend } from "./resend";
import {
  ensureSegment,
  addContact,
  updateContact,
  removeContact,
  markUnsubscribed,
  _resetSegmentCache,
} from "./audience";

beforeEach(() => {
  vi.clearAllMocks();
  _resetSegmentCache();
  // Restore pass-through behavior after clearAllMocks wipes it
  mockWithTimeout.mockImplementation(<T>(promise: Promise<T>) => promise);
});

// ---------------------------------------------------------------------------
// ensureSegment
// ---------------------------------------------------------------------------

describe("ensureSegment", () => {
  it("returns existing segment ID when found by name", async () => {
    mockSegmentsList.mockResolvedValue({
      data: {
        data: [
          { id: "seg-123", name: "Chapa Users" },
          { id: "seg-456", name: "Other" },
        ],
        has_more: false,
      },
      error: null,
    });

    const id = await ensureSegment();

    expect(id).toBe("seg-123");
    expect(mockSegmentsCreate).not.toHaveBeenCalled();
  });

  it("creates new segment when none exists", async () => {
    mockSegmentsList.mockResolvedValue({
      data: { data: [], has_more: false },
      error: null,
    });
    mockSegmentsCreate.mockResolvedValue({
      data: { id: "seg-new", object: "segment", name: "Chapa Users" },
      error: null,
    });

    const id = await ensureSegment();

    expect(id).toBe("seg-new");
    expect(mockSegmentsCreate).toHaveBeenCalledWith({ name: "Chapa Users" });
  });

  it("returns null when Resend is unavailable", async () => {
    vi.mocked(getResend).mockReturnValueOnce(null);

    const id = await ensureSegment();
    expect(id).toBeNull();
  });

  it("returns null when list fails", async () => {
    mockSegmentsList.mockResolvedValue({
      data: null,
      error: { message: "API error", statusCode: 500, name: "server_error" },
    });

    const id = await ensureSegment();
    expect(id).toBeNull();
  });

  it("returns null when create fails", async () => {
    mockSegmentsList.mockResolvedValue({
      data: { data: [], has_more: false },
      error: null,
    });
    mockSegmentsCreate.mockResolvedValue({
      data: null,
      error: { message: "Create failed", statusCode: 500, name: "server_error" },
    });

    const id = await ensureSegment();
    expect(id).toBeNull();
  });

  it("caches segment ID across calls", async () => {
    mockSegmentsList.mockResolvedValue({
      data: {
        data: [{ id: "seg-cached", name: "Chapa Users" }],
        has_more: false,
      },
      error: null,
    });

    await ensureSegment();
    await ensureSegment();

    expect(mockSegmentsList).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// addContact
// ---------------------------------------------------------------------------

describe("addContact", () => {
  beforeEach(() => {
    // Ensure segment returns a valid ID for addContact tests
    mockSegmentsList.mockResolvedValue({
      data: {
        data: [{ id: "seg-123", name: "Chapa Users" }],
        has_more: false,
      },
      error: null,
    });
  });

  it("creates contact with segment association", async () => {
    mockContactsCreate.mockResolvedValue({
      data: { object: "contact", id: "contact-1" },
      error: null,
    });

    const id = await addContact("dev@example.com");

    expect(id).toBe("contact-1");
    expect(mockContactsCreate).toHaveBeenCalledWith({
      email: "dev@example.com",
      firstName: undefined,
      unsubscribed: false,
      segments: [{ id: "seg-123" }],
    });
  });

  it("passes firstName from opts", async () => {
    mockContactsCreate.mockResolvedValue({
      data: { object: "contact", id: "contact-2" },
      error: null,
    });

    await addContact("dev@example.com", { firstName: "Alice" });

    expect(mockContactsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "Alice" }),
    );
  });

  it("falls back to handle when no firstName", async () => {
    mockContactsCreate.mockResolvedValue({
      data: { object: "contact", id: "contact-3" },
      error: null,
    });

    await addContact("dev@example.com", { handle: "alice" });

    expect(mockContactsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: "alice" }),
    );
  });

  it("handles 409 conflict by updating instead", async () => {
    mockContactsCreate.mockResolvedValue({
      data: null,
      error: { message: "Conflict", statusCode: 409, name: "conflict" },
    });
    mockContactsUpdate.mockResolvedValue({
      data: { object: "contact", id: "contact-existing" },
      error: null,
    });

    const id = await addContact("dev@example.com");

    expect(id).toBe("contact-existing");
    expect(mockContactsUpdate).toHaveBeenCalledWith({
      email: "dev@example.com",
      unsubscribed: false,
    });
  });

  it("returns null when Resend is unavailable", async () => {
    vi.mocked(getResend).mockReturnValueOnce(null);

    const id = await addContact("dev@example.com");
    expect(id).toBeNull();
  });

  it("returns null when segment creation fails", async () => {
    _resetSegmentCache();
    mockSegmentsList.mockResolvedValue({
      data: null,
      error: { message: "fail", statusCode: 500, name: "error" },
    });

    const id = await addContact("dev@example.com");
    expect(id).toBeNull();
  });

  it("returns null when 409 conflict and subsequent updateContact also fails", async () => {
    mockContactsCreate.mockResolvedValue({
      data: null,
      error: { message: "Conflict", statusCode: 409, name: "conflict" },
    });
    mockContactsUpdate.mockResolvedValue({
      data: null,
      error: { message: "Update failed", statusCode: 500, name: "server_error" },
    });

    const id = await addContact("dev@example.com");

    // updateContact returns null on error, so addContact returns null too
    expect(id).toBeNull();
    expect(mockContactsUpdate).toHaveBeenCalledWith({
      email: "dev@example.com",
      unsubscribed: false,
    });
  });

  it("returns null on non-409 error", async () => {
    mockContactsCreate.mockResolvedValue({
      data: null,
      error: { message: "Bad request", statusCode: 400, name: "bad_request" },
    });

    const id = await addContact("dev@example.com");
    expect(id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateContact
// ---------------------------------------------------------------------------

describe("updateContact", () => {
  it("updates contact by email", async () => {
    mockContactsUpdate.mockResolvedValue({
      data: { object: "contact", id: "contact-1" },
      error: null,
    });

    const id = await updateContact("dev@example.com", { unsubscribed: true });

    expect(id).toBe("contact-1");
    expect(mockContactsUpdate).toHaveBeenCalledWith({
      email: "dev@example.com",
      unsubscribed: true,
    });
  });

  it("updates firstName", async () => {
    mockContactsUpdate.mockResolvedValue({
      data: { object: "contact", id: "contact-1" },
      error: null,
    });

    await updateContact("dev@example.com", { firstName: "Bob" });

    expect(mockContactsUpdate).toHaveBeenCalledWith({
      email: "dev@example.com",
      firstName: "Bob",
    });
  });

  it("returns null on error", async () => {
    mockContactsUpdate.mockResolvedValue({
      data: null,
      error: { message: "Not found", statusCode: 404, name: "not_found" },
    });

    const id = await updateContact("dev@example.com", { unsubscribed: false });
    expect(id).toBeNull();
  });

  it("returns null when Resend is unavailable", async () => {
    vi.mocked(getResend).mockReturnValueOnce(null);

    const id = await updateContact("dev@example.com", {});
    expect(id).toBeNull();
  });

  it("returns null when contacts.update throws an exception", async () => {
    mockContactsUpdate.mockRejectedValue(new Error("Connection reset"));

    const id = await updateContact("dev@example.com", { unsubscribed: true });
    expect(id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// removeContact
// ---------------------------------------------------------------------------

describe("removeContact", () => {
  it("removes contact and returns true", async () => {
    mockContactsRemove.mockResolvedValue({
      data: { object: "contact", id: "contact-1", deleted: true },
      error: null,
    });

    const result = await removeContact("dev@example.com");

    expect(result).toBe(true);
    expect(mockContactsRemove).toHaveBeenCalledWith({ email: "dev@example.com" });
  });

  it("returns false on error", async () => {
    mockContactsRemove.mockResolvedValue({
      data: null,
      error: { message: "Not found", statusCode: 404, name: "not_found" },
    });

    const result = await removeContact("dev@example.com");
    expect(result).toBe(false);
  });

  it("returns false when Resend is unavailable", async () => {
    vi.mocked(getResend).mockReturnValueOnce(null);

    const result = await removeContact("dev@example.com");
    expect(result).toBe(false);
  });

  it("returns false when contacts.remove throws an exception", async () => {
    mockContactsRemove.mockRejectedValue(new Error("Network failure"));

    const result = await removeContact("dev@example.com");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// markUnsubscribed
// ---------------------------------------------------------------------------

describe("markUnsubscribed", () => {
  it("sets unsubscribed to true via updateContact", async () => {
    mockContactsUpdate.mockResolvedValue({
      data: { object: "contact", id: "contact-1" },
      error: null,
    });

    const id = await markUnsubscribed("dev@example.com");

    expect(id).toBe("contact-1");
    expect(mockContactsUpdate).toHaveBeenCalledWith({
      email: "dev@example.com",
      unsubscribed: true,
    });
  });
});

// ---------------------------------------------------------------------------
// withTimeout wrapping
// ---------------------------------------------------------------------------

describe("withTimeout wrapping", () => {
  it("wraps segments.list with withTimeout", async () => {
    mockSegmentsList.mockResolvedValue({
      data: { data: [{ id: "seg-1", name: "Chapa Users" }], has_more: false },
      error: null,
    });

    await ensureSegment();

    expect(mockWithTimeout).toHaveBeenCalledWith(
      expect.any(Promise),
      10_000,
      "ensureSegment:list",
    );
  });

  it("wraps segments.create with withTimeout", async () => {
    mockSegmentsList.mockResolvedValue({
      data: { data: [], has_more: false },
      error: null,
    });
    mockSegmentsCreate.mockResolvedValue({
      data: { id: "seg-new", object: "segment", name: "Chapa Users" },
      error: null,
    });

    await ensureSegment();

    expect(mockWithTimeout).toHaveBeenCalledWith(
      expect.any(Promise),
      10_000,
      "ensureSegment:create",
    );
  });

  it("wraps contacts.create with withTimeout", async () => {
    mockSegmentsList.mockResolvedValue({
      data: { data: [{ id: "seg-1", name: "Chapa Users" }], has_more: false },
      error: null,
    });
    mockContactsCreate.mockResolvedValue({
      data: { object: "contact", id: "c-1" },
      error: null,
    });

    _resetSegmentCache();
    await addContact("dev@example.com");

    expect(mockWithTimeout).toHaveBeenCalledWith(
      expect.any(Promise),
      10_000,
      "addContact",
    );
  });

  it("wraps contacts.update with withTimeout", async () => {
    mockContactsUpdate.mockResolvedValue({
      data: { object: "contact", id: "c-1" },
      error: null,
    });

    await updateContact("dev@example.com", { unsubscribed: true });

    expect(mockWithTimeout).toHaveBeenCalledWith(
      expect.any(Promise),
      10_000,
      "updateContact",
    );
  });

  it("wraps contacts.remove with withTimeout", async () => {
    mockContactsRemove.mockResolvedValue({
      data: { object: "contact", id: "c-1", deleted: true },
      error: null,
    });

    await removeContact("dev@example.com");

    expect(mockWithTimeout).toHaveBeenCalledWith(
      expect.any(Promise),
      10_000,
      "removeContact",
    );
  });

  it("returns null when a timeout occurs in addContact", async () => {
    mockSegmentsList.mockResolvedValue({
      data: { data: [{ id: "seg-1", name: "Chapa Users" }], has_more: false },
      error: null,
    });
    // Make withTimeout reject for the contacts.create call
    mockWithTimeout
      .mockImplementationOnce(<T>(p: Promise<T>) => p) // segments.list pass-through
      .mockRejectedValueOnce(new Error("addContact timed out after 10000ms"));

    _resetSegmentCache();
    const id = await addContact("dev@example.com");
    expect(id).toBeNull();
  });

  it("returns false when a timeout occurs in removeContact", async () => {
    mockWithTimeout.mockRejectedValueOnce(
      new Error("removeContact timed out after 10000ms"),
    );

    const result = await removeContact("dev@example.com");
    expect(result).toBe(false);
  });
});
