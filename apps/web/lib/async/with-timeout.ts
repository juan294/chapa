/** Default timeout for database/external service calls (10 seconds). */
export const DB_TIMEOUT_MS = 10_000;

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
 * milliseconds, a `TimeoutError` is thrown.
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
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => {
        const prefix = label ? `${label} timed out` : "Operation timed out";
        reject(new TimeoutError(`${prefix} after ${ms}ms`));
      }, ms);
    }),
  ]);
}
