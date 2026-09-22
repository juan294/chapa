import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Claims the product may not make, checked against the copy that actually
 * ships.
 *
 * Each rule below is a policy sentence, not a style preference. Chapa reports
 * an observed activity and practices index over a declared scope: it does not
 * certify ability, it does not turn issuance into source truth, its caps are
 * published product choices rather than measured percentiles, and tool volume
 * earns nothing. Copy drifts back toward those claims by accident, which is why
 * this is a test and not a guideline.
 */
const repoRoot = resolve(__dirname, "../../../../..");
const SURFACES = [
  "apps/web/lib/i18n/dictionaries/en.ts",
  "apps/web/lib/i18n/dictionaries/es.ts",
  "apps/web/app/llms.txt/route.ts",
  "apps/web/app/llms-full.txt/route.ts",
];

interface ClaimRule {
  readonly why: string;
  readonly pattern: RegExp;
  /** Phrases that contain a banned word but make the opposite claim. */
  readonly allow?: readonly string[];
}

/** Denying a claim is not making it. Copy that says "not proven ability" or
 * "rather than mastery" is doing exactly what this suite is for. */
const NEGATED = /(?:not|never|rather than|no es|nunca|en vez de|instead of|does not|no)\s+(?:[\w-]+\s+){0,2}$/i;

const RULES: ClaimRule[] = [
  {
    why: "a score cannot be presented as a measured percentile — the caps are published product choices",
    pattern: /\bpercentiles?\b|\bpercentiles?\b|top \d+\s?%|better than \d+\s?% of|mejor que el \d+\s?%/gi,
  },
  {
    why: "tool usage cannot be described as mastery or proficiency; volume earns no credit",
    pattern: /\b(tool mastery|mastery of|AI tool mastery|dominio de herramientas|maestría)\b/gi,
  },
  {
    why: "issuance is not source truth: verification proves the badge was not modified, not that the platform data is true",
    pattern: /\bproves? (?:that )?(?:the|your) (?:data|activity|work|contributions?) (?:is|are) (?:accurate|true|real)\b|\bcertifies\b|\bcertifica\b/gi,
  },
  {
    why: "the core index is observed activity and practice, not proven ability",
    pattern: /\bproven ability\b|\bproves? (?:your|their) (?:skill|ability|competence)\b|\bhow good (?:a|an) (?:developer|engineer)\b/gi,
  },
];

const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

describe("claims the shipped copy may not make", () => {
  it.each(SURFACES)("%s makes no prohibited claim", surface => {
    const text = read(surface);
    const violations = RULES.flatMap(rule => {
      const hits = [...text.matchAll(rule.pattern)].map(match => match[0]);
      const real = hits.filter(hit => {
        if ((rule.allow ?? []).some(allowed => hit.includes(allowed))) return false;
        const before = text.slice(Math.max(0, text.indexOf(hit) - 40), text.indexOf(hit));
        return !NEGATED.test(before);
      });
      return real.map(hit => `${surface}: "${hit}" — ${rule.why}`);
    });
    expect(violations).toEqual([]);
  });

  it("describes Craft as separate practice that never lowers the core", () => {
    for (const dictionary of SURFACES.slice(0, 2)) {
      const text = read(dictionary);
      expect(text).toMatch(/never changes (?:the|your) core|nunca cambia (?:el núcleo|tu puntuación base)/i);
    }
  });

  it("says explicitly that not using a tool demonstrates judgment too", () => {
    expect(read(SURFACES[0]!)).toMatch(/Choosing not to use a tool/i);
    expect(read(SURFACES[1]!)).toMatch(/Decidir no usar una herramienta/i);
  });
});
