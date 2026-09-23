import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ scheduleServerEvent: vi.fn() }));
vi.mock("@/lib/analytics/schedule-server-event", () => ({ scheduleServerEvent: mocks.scheduleServerEvent }));

import {
  classifyFetchFailure, createDiagnosticRecorder, emitSourceDiagnostics, isGraphqlRateLimited,
  isRateLimitedResponse, reasonFor, retryAfterSeconds, type SourceDiagnostic,
} from "./evidence-diagnostics";

describe("classifyFetchFailure", () => {
  it("classifies an aborted-by-timeout signal as deadline", () => {
    const controller = new AbortController();
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"));
    expect(classifyFetchFailure(new Error("aborted"), controller.signal)).toBe("deadline");
  });
  it("classifies a network TypeError as network", () => {
    const controller = new AbortController();
    expect(classifyFetchFailure(new TypeError("fetch failed"), controller.signal)).toBe("network");
  });
  it("classifies any other exception as parse", () => {
    const controller = new AbortController();
    expect(classifyFetchFailure(new SyntaxError("Unexpected token"), controller.signal)).toBe("parse");
  });
});

describe("reasonFor", () => {
  it.each([
    ["budget", "pagination_incomplete"],
    ["deadline", "pagination_incomplete"],
    ["rate_limited", "pagination_incomplete"],
    ["not_accessible", "not_accessible"],
    ["http", "source_error"],
    ["graphql", "source_error"],
    ["network", "source_error"],
    ["protocol", "source_error"],
    ["parse", "source_error"],
  ] as const)("maps %s to %s", (stopKind, reason) => {
    expect(reasonFor(stopKind)).toBe(reason);
  });
});

describe("isRateLimitedResponse", () => {
  it("is true for HTTP 429 regardless of headers", () => {
    expect(isRateLimitedResponse(429, new Headers())).toBe(true);
  });
  it("is true for a GitHub-style 403 with an exhausted rate-limit header", () => {
    expect(isRateLimitedResponse(403, new Headers({ "x-ratelimit-remaining": "0" }))).toBe(true);
  });
  it("is false for an ordinary 403 with no rate-limit header", () => {
    expect(isRateLimitedResponse(403, new Headers())).toBe(false);
    expect(isRateLimitedResponse(403, undefined)).toBe(false);
  });
  it("is false for other statuses", () => {
    expect(isRateLimitedResponse(500, new Headers({ "x-ratelimit-remaining": "0" }))).toBe(false);
  });
});

describe("isGraphqlRateLimited", () => {
  it("is true when an errors entry reports RATE_LIMITED", () => {
    expect(isGraphqlRateLimited([{ type: "RATE_LIMITED" }])).toBe(true);
  });
  it("is false for other GraphQL error types or non-arrays", () => {
    expect(isGraphqlRateLimited([{ type: "NOT_FOUND" }])).toBe(false);
    expect(isGraphqlRateLimited(null)).toBe(false);
  });
});

describe("retryAfterSeconds", () => {
  it("reads retry-after in seconds", () => {
    expect(retryAfterSeconds(new Headers({ "retry-after": "30" }))).toBe(30);
  });
  it("derives a remaining duration from x-ratelimit-reset", () => {
    const reset = Math.floor(Date.now() / 1000) + 45;
    const seconds = retryAfterSeconds(new Headers({ "x-ratelimit-reset": String(reset) }));
    expect(seconds).toBeGreaterThanOrEqual(40);
    expect(seconds).toBeLessThanOrEqual(45);
  });
  it("returns null with no relevant header", () => {
    expect(retryAfterSeconds(new Headers())).toBeNull();
    expect(retryAfterSeconds(null)).toBeNull();
  });
});

describe("createDiagnosticRecorder", () => {
  it("records a diagnostic and returns the mapped reason code", () => {
    const recorder = createDiagnosticRecorder("github");
    const reason = recorder.record("files", "deadline");
    expect(reason).toBe("pagination_incomplete");
    expect(recorder.diagnostics).toEqual([
      { provider: "github", operation: "files", stopKind: "deadline", httpStatus: null, retryAfterSeconds: null },
    ]);
  });
  it("carries an HTTP status and retry-after through", () => {
    const recorder = createDiagnosticRecorder("bitbucket");
    recorder.record("pullrequests", "rate_limited", 429, 30);
    expect(recorder.diagnostics).toEqual([
      { provider: "bitbucket", operation: "pullrequests", stopKind: "rate_limited", httpStatus: 429, retryAfterSeconds: 30 },
    ]);
  });
});

describe("emitSourceDiagnostics", () => {
  beforeEach(() => mocks.scheduleServerEvent.mockClear());
  it("emits one evidence_source_stop event per diagnostic", () => {
    const diagnostics: SourceDiagnostic[] = [
      { provider: "github", operation: "files", stopKind: "deadline", httpStatus: null, retryAfterSeconds: null },
      { provider: "github", operation: "merged", stopKind: "graphql", httpStatus: 200, retryAfterSeconds: null },
    ];
    emitSourceDiagnostics("alice", diagnostics);
    expect(mocks.scheduleServerEvent).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleServerEvent).toHaveBeenNthCalledWith(1, "evidence_source_stop", {
      handle: "alice", provider: "github", operation: "files", stopKind: "deadline", httpStatus: null, retryAfterSeconds: null,
    });
  });
  it("emits nothing for a clean run", () => {
    emitSourceDiagnostics("alice", []);
    expect(mocks.scheduleServerEvent).not.toHaveBeenCalled();
  });
  it("never carries a URL, body or token field", () => {
    const diagnostics: SourceDiagnostic[] = [
      { provider: "bitbucket", operation: "commits", stopKind: "http", httpStatus: 500, retryAfterSeconds: null },
    ];
    emitSourceDiagnostics("alice", diagnostics);
    const [, properties] = mocks.scheduleServerEvent.mock.calls[0] as [string, Record<string, unknown>];
    for (const key of Object.keys(properties)) {
      expect(key.toLowerCase()).not.toMatch(/url|body|token|secret|password/);
    }
    expect(JSON.stringify(properties)).not.toMatch(/https?:\/\//);
  });
});
