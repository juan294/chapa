import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Helpers for asserting design-token invariants directly against
 * `apps/web/styles/globals.css`. jsdom never loads or applies that stylesheet,
 * so token guards read the source text instead.
 *
 * #1211 moved every themed color to a single `light-dark(<light>, <dark>)`
 * declaration inside `@theme`, replacing the paired `:root` /
 * `[data-theme="dark"]` blocks. These helpers read that shape, and the
 * contrast math (previously copy-pasted twice inside globals.test.ts) lives
 * here once.
 */

export const GLOBALS_CSS = fs.readFileSync(
  path.resolve(__dirname, "../../styles/globals.css"),
  "utf-8",
);

export function themeBlock(source: string = GLOBALS_CSS): string {
  return source.match(/@theme\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
}

/** Raw declared value of a custom property, as written. */
export function rawTokenValue(
  token: string,
  source: string = themeBlock(),
): string {
  const match = source.match(new RegExp(`${token}:\\s*([^;]+);`));
  if (!match) {
    throw new Error(`${token} not found`);
  }
  return match[1]!.trim();
}

/**
 * Both halves of a `light-dark()` token. A token declared as a plain color
 * (one value for both themes, e.g. the archetype hues) reports that value on
 * both sides, which is what a caller comparing themes should see.
 */
export function themedTokenValue(
  token: string,
  source: string = themeBlock(),
): { light: string; dark: string } {
  const value = rawTokenValue(token, source);
  const lightDark = value.match(/^light-dark\(\s*([\s\S]+)\s*\)$/);
  if (!lightDark) {
    return { light: value, dark: value };
  }
  const [light, dark] = splitTopLevel(lightDark[1]!);
  if (light === undefined || dark === undefined) {
    throw new Error(`${token} light-dark() needs two arguments, got: ${value}`);
  }
  return { light, dark };
}

/** Split on commas that are not inside parentheses. */
function splitTopLevel(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of args) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current.trim());
  return parts;
}

export const LIGHT_SURFACES = ["#f7fbf8", "#edf6f0"] as const;
export const DARK_SURFACES = ["#08170f", "#0f2419"] as const;

function oklchToRgb(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const bb = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((x) => {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
  }) as [number, number, number];
}

/**
 * Parse a hex or oklch() color. Alpha is ignored: every token measured here is
 * opaque text, and a translucent one would need its backdrop composited first.
 */
export function parseColor(value: string): [number, number, number] {
  const oklch = value
    .trim()
    .match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (oklch) {
    return oklchToRgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
  }
  const clean = value.trim().replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const lumA = relativeLuminance(parseColor(a));
  const lumB = relativeLuminance(parseColor(b));
  return (
    (Math.max(lumA, lumB) + 0.05) / (Math.min(lumA, lumB) + 0.05)
  );
}
