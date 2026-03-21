/**
 * Validate a Claude Code insights HTML report upload payload.
 *
 * Performs deep structural validation on 12 top-level fields: tool (must be
 * "claude-code"), reportPeriod (ISO date range), volume (6 numeric metrics),
 * toolUsage, sessionTypes, outcomes (3 categories), friction (3 categories),
 * satisfaction (3 tiers), multiClauding (overlap stats), responseTime (median
 * + average), toolErrors, totalSessions (>=1), and totalToolCalls (>=0).
 *
 * Returns `{ valid: true }` or `{ valid: false, reason: string }` with a
 * human-readable description of the first validation failure.
 *
 * Used by POST /api/insights.
 */
export function isValidInsightsUpload(
  data: unknown,
): { valid: true } | { valid: false; reason: string } {
  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, reason: "Expected an object" };
  }

  const obj = data as Record<string, unknown>;

  // tool
  if (obj.tool !== "claude-code") {
    return { valid: false, reason: 'tool must be "claude-code"' };
  }

  // reportPeriod
  const rp = obj.reportPeriod;
  if (rp == null || typeof rp !== "object" || Array.isArray(rp)) {
    return { valid: false, reason: "reportPeriod must be an object" };
  }
  const rpObj = rp as Record<string, unknown>;
  if (typeof rpObj.start !== "string" || !isIsoDate(rpObj.start)) {
    return { valid: false, reason: "reportPeriod.start must be a valid ISO date" };
  }
  if (typeof rpObj.end !== "string" || !isIsoDate(rpObj.end)) {
    return { valid: false, reason: "reportPeriod.end must be a valid ISO date" };
  }
  if (rpObj.end < rpObj.start) {
    return { valid: false, reason: "reportPeriod.end must be >= reportPeriod.start" };
  }

  // volume
  const vol = obj.volume;
  if (vol == null || typeof vol !== "object" || Array.isArray(vol)) {
    return { valid: false, reason: "volume must be an object" };
  }
  const volObj = vol as Record<string, unknown>;
  for (const key of ["messages", "linesAdded", "linesDeleted", "files", "days", "msgsPerDay"]) {
    if (typeof volObj[key] !== "number" || volObj[key] < 0) {
      return { valid: false, reason: `volume.${key} must be a non-negative number` };
    }
  }

  // toolUsage — Record<string, number> with non-negative values
  const check = checkRecord(obj.toolUsage, "toolUsage");
  if (!check.valid) return check;

  // sessionTypes — same pattern
  const stCheck = checkRecord(obj.sessionTypes, "sessionTypes");
  if (!stCheck.valid) return stCheck;

  // outcomes
  const out = obj.outcomes;
  if (out == null || typeof out !== "object" || Array.isArray(out)) {
    return { valid: false, reason: "outcomes must be an object" };
  }
  const outObj = out as Record<string, unknown>;
  for (const key of ["fullyAchieved", "mostlyAchieved", "partiallyAchieved"]) {
    if (!isNonNegativeInt(outObj[key])) {
      return { valid: false, reason: `outcomes.${key} must be a non-negative integer` };
    }
  }

  // friction
  const fr = obj.friction;
  if (fr == null || typeof fr !== "object" || Array.isArray(fr)) {
    return { valid: false, reason: "friction must be an object" };
  }
  const frObj = fr as Record<string, unknown>;
  for (const key of ["buggyCode", "wrongApproach", "misunderstoodRequest"]) {
    if (!isNonNegativeInt(frObj[key])) {
      return { valid: false, reason: `friction.${key} must be a non-negative integer` };
    }
  }

  // satisfaction
  const sat = obj.satisfaction;
  if (sat == null || typeof sat !== "object" || Array.isArray(sat)) {
    return { valid: false, reason: "satisfaction must be an object" };
  }
  const satObj = sat as Record<string, unknown>;
  for (const key of ["dissatisfied", "likelySatisfied", "satisfied"]) {
    if (!isNonNegativeInt(satObj[key])) {
      return { valid: false, reason: `satisfaction.${key} must be a non-negative integer` };
    }
  }

  // multiClauding
  const mc = obj.multiClauding;
  if (mc == null || typeof mc !== "object" || Array.isArray(mc)) {
    return { valid: false, reason: "multiClauding must be an object" };
  }
  const mcObj = mc as Record<string, unknown>;
  if (typeof mcObj.overlapEvents !== "number" || mcObj.overlapEvents < 0) {
    return { valid: false, reason: "multiClauding.overlapEvents must be a non-negative number" };
  }
  if (typeof mcObj.sessionsInvolved !== "number" || mcObj.sessionsInvolved < 0) {
    return { valid: false, reason: "multiClauding.sessionsInvolved must be a non-negative number" };
  }
  if (typeof mcObj.messagePercent !== "number" || mcObj.messagePercent < 0 || mcObj.messagePercent > 100) {
    return { valid: false, reason: "multiClauding.messagePercent must be between 0 and 100" };
  }

  // responseTime
  const rt = obj.responseTime;
  if (rt == null || typeof rt !== "object" || Array.isArray(rt)) {
    return { valid: false, reason: "responseTime must be an object" };
  }
  const rtObj = rt as Record<string, unknown>;
  if (typeof rtObj.medianSeconds !== "number" || rtObj.medianSeconds < 0) {
    return { valid: false, reason: "responseTime.medianSeconds must be a non-negative number" };
  }
  if (typeof rtObj.averageSeconds !== "number" || rtObj.averageSeconds < 0) {
    return { valid: false, reason: "responseTime.averageSeconds must be a non-negative number" };
  }

  // toolErrors — Record<string, number>
  const teCheck = checkRecord(obj.toolErrors, "toolErrors");
  if (!teCheck.valid) return teCheck;

  // totalSessions — must be >= 1
  if (!isPositiveInt(obj.totalSessions)) {
    return { valid: false, reason: "totalSessions must be a positive integer (>= 1)" };
  }

  // totalToolCalls — non-negative integer
  if (!isNonNegativeInt(obj.totalToolCalls)) {
    return { valid: false, reason: "totalToolCalls must be a non-negative integer" };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !isNaN(d.getTime());
}

function isNonNegativeInt(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInt(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function checkRecord(
  value: unknown,
  fieldName: string,
): { valid: true } | { valid: false; reason: string } {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, reason: `${fieldName} must be an object` };
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== "number" || v < 0) {
      return { valid: false, reason: `${fieldName}.${k} must be a non-negative number` };
    }
  }
  return { valid: true };
}
