import { NextResponse } from "next/server";

/** Default timeout for database/external service calls (10 seconds). */
export const DB_TIMEOUT_MS = 10_000;

/** Default timeout for outbound email sends via Resend (10 seconds). */
export const EMAIL_SEND_TIMEOUT_MS = 10_000;

/**
 * Custom error thrown when a promise exceeds the specified timeout.
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Wrap a promise with a timeout. If the promise does not settle within `ms`
 * milliseconds, a `TimeoutError` is thrown. The internal timer is cleared
 * as soon as the race settles to avoid dangling timers.
 *
 * @param promise - The promise to wrap.
 * @param ms - Timeout duration in milliseconds.
 * @param label - Optional label for the error message (e.g. the function name).
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const prefix = label ? `${label} timed out` : "Operation timed out";
      reject(new TimeoutError(`${prefix} after ${ms}ms`));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Execute a promise with the standard DB timeout, returning a 504 NextResponse
 * on timeout. Eliminates repeated try/catch blocks in route handlers.
 *
 * @param promise - The DB/service call to wrap.
 * @param label - Label for timeout error messages (e.g. the function name).
 * @returns The resolved value, or a 504 NextResponse on timeout.
 */
export async function dbTimeoutOr504<T>(
  promise: Promise<T>,
  label?: string,
): Promise<T | NextResponse> {
  try {
    return await withTimeout(promise, DB_TIMEOUT_MS, label);
  } catch (err) {
    if (err instanceof TimeoutError) {
      return NextResponse.json(
        { error: "Database request timeout" },
        { status: 504 },
      );
    }
    throw err;
  }
}
