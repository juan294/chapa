/**
 * Report parsing utilities for agent output files.
 *
 * Pure functions that extract structured data from markdown reports
 * and shared context files.
 */

import type { SharedContextEntry } from "@/app/admin/agents-types";

/**
 * Extract health status from report content.
 * Looks for "Health status: <green|yellow|red>" (case-insensitive).
 */
export function parseHealthStatus(
  content: string,
): "green" | "yellow" | "red" | "unknown" {
  const match = content.match(/health status:\s*(green|yellow|red)/i);
  if (!match) return "unknown";
  return match[1]!.toLowerCase() as "green" | "yellow" | "red";
}

/**
 * Extract the first sentence after "## Executive Summary".
 * Returns "No summary available" if the heading is not found.
 */
export function parseHealthSummary(content: string): string {
  const match = content.match(
    /##\s*Executive Summary\s*\n+\s*(.+)/i,
  );
  if (!match) return "No summary available";

  const line = match[1]!.trim();
  // Extract first sentence (up to first period followed by space or end)
  const sentenceMatch = line.match(/^(.+?\.)\s/);
  if (sentenceMatch) return sentenceMatch[1]!;

  // If no period followed by space, check for period at end
  if (line.endsWith(".")) return line;

  return line;
}

/**
 * Parse shared context entries from the shared-context.md file.
 * Each entry is delimited by ENTRY:START/ENTRY:END HTML comments.
 */
export function parseSharedContext(content: string): SharedContextEntry[] {
  if (!content) return [];

  const entries: SharedContextEntry[] = [];
  const pattern =
    /<!-- ENTRY:START agent=(\S+) timestamp=(\S+) -->\n([\s\S]*?)<!-- ENTRY:END -->/g;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    entries.push({
      agent: match[1]!,
      timestamp: match[2]!,
      content: match[3]!.trim(),
    });
  }

  return entries;
}
