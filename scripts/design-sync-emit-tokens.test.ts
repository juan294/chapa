import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";
// @ts-expect-error — plain .mjs tooling module, no type declarations.
import { buildTokenCss, TOKEN_BLOCKS } from "../.design-sync/emit-tokens.mjs";

/**
 * #1219 — `.design-sync/emit-tokens.mjs` writes the design-token manifest the
 * external design pipeline consumes. Two things it must keep doing:
 *
 * 1. Exclude Tailwind's `--tw-*` engine variables. They cannot be removed from
 *    `_ds_bundle.css` (utilities dereference them at runtime and their
 *    `@property` blocks set the initial values), so a consumer that scrapes
 *    that file sees ~70 unclassified variables beside the real tokens. This
 *    manifest is the clean list.
 * 2. Read the tokens from `@theme`. Since #1211 that is the only block in
 *    globals.css that declares any, and every themed color there is a single
 *    `light-dark()` value.
 *
 * The transform is pure, so this exercises it directly rather than spawning
 * the script.
 */
const GLOBALS = readFileSync(
  path.resolve(__dirname, "..", "apps/web/styles/globals.css"),
  "utf8",
);

const { css: output, count } = buildTokenCss(GLOBALS) as {
  css: string;
  count: number;
};

describe("design-sync emit-tokens", () => {
  it("emits the tokens under the @theme selector", () => {
    expect(output).toContain("@theme {");
  });

  it("excludes every Tailwind engine variable", () => {
    expect(
      buildTokenCss(
        GLOBALS.replace("@theme {", "@theme {\n  --tw-ring-offset-width: 0px;"),
      ).css,
    ).not.toContain("--tw-");
  });

  it("carries both halves of a themed color", () => {
    expect(output).toContain("--color-bg: light-dark(#f7fbf8, #08170f);");
  });

  it("emits the whole palette, not a stray declaration or two", () => {
    expect(count).toBeGreaterThan(40);
  });

  it("no longer scans the retired per-theme blocks", () => {
    expect(TOKEN_BLOCKS).toEqual(["@theme"]);
  });
});
