export function isStudioEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STUDIO_ENABLED?.trim() === "true";
}
