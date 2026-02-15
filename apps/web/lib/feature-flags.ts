export function isStudioEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STUDIO_ENABLED?.trim() === "true";
}

export function isScoringPageEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SCORING_PAGE_ENABLED?.trim() === "true";
}

export function isExperimentsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED?.trim() === "true";
}
