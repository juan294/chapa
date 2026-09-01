export const WEBMCP_INVALID_INPUT_PREFIX = "Invalid input for ";

export function invalidInput(tool: string, message: string): string {
  return `${WEBMCP_INVALID_INPUT_PREFIX}${tool}: ${message}.`;
}
