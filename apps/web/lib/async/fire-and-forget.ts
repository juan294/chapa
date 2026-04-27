const DEFAULT_LOG_PREFIX = "[fire-and-forget]";

export function fireAndForget<T>(
  fn: () => Promise<T>,
  onError: (error: unknown) => void = (error) => {
    console.error(DEFAULT_LOG_PREFIX, error);
  },
): void {
  try {
    void fn().catch(onError);
  } catch (error) {
    onError(error);
  }
}
