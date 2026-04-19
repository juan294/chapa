/** Result shape returned by processInBatches. */
export interface BatchResult<T, R> {
  /** Values returned by fn for items that succeeded. */
  succeeded: R[];
  /** Items that failed along with the Error that caused the failure. */
  failed: Array<{ item: T; error: Error }>;
}

/**
 * Process items in parallel batches of a fixed size.
 *
 * Uses Promise.allSettled for error isolation — individual failures do not
 * block other items in the batch. Returns a structured result that separates
 * succeeded values from failed items so callers can identify and log
 * which specific items failed instead of silently discarding errors.
 */
export async function processInBatches<T, R = unknown>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<BatchResult<T, R>> {
  const succeeded: R[] = [];
  const failed: Array<{ item: T; error: Error }> = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j]!;
      const item = batch[j]!;
      if (result.status === "fulfilled") {
        succeeded.push((result as PromiseFulfilledResult<R>).value);
      } else {
        const reason = (result as PromiseRejectedResult).reason;
        const error =
          reason instanceof Error ? reason : new Error(String(reason));
        failed.push({ item, error });
      }
    }
  }

  return { succeeded, failed };
}
