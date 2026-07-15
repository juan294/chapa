import { createRequire } from "module";

const require = createRequire(import.meta.url);

const nextConfig = require("eslint-config-next");
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");
const nextTypescript = require("eslint-config-next/typescript");

const eslintConfig = [
  { ignores: [".next/", "node_modules/", "next-env.d.ts", ".worktrees/"] },
  ...nextConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Enforce typed env-getter usage in application source (lib/ and app/),
    // plus the #1026 (FE-M3) unchecked-t()-cast guard below. Both live under
    // the same "no-restricted-syntax" rule key in one config object
    // deliberately: ESLint flat config does NOT merge rule option arrays
    // across separate config objects that both set the same rule for
    // overlapping files — the later object's array replaces the earlier
    // one's entirely (last one wins), which would silently disable whichever
    // selector set was declared first. Add new selectors to this single
    // array, not a new object, unless the file scope is fully disjoint.
    //
    // process.env selectors: excludes env.ts itself, test files, client
    // components (where Next.js requires direct NEXT_PUBLIC_* access for
    // build-time inlining, hence components/** is deliberately NOT in this
    // files list), config files, and scripts.
    //
    // t()-cast selectors (#1026): excludes typed-accessors.ts (defines the
    // tArray/tObject replacement) and resolve.ts (the resolver's own
    // TranslationLeaf-narrowing internals, not a caller-side cast). All known
    // occurrences live under app/** and lib/i18n/**, both already covered.
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: [
      "lib/env.ts",
      "lib/i18n/typed-accessors.ts",
      "lib/i18n/resolve.ts",
      "**/*.test.*",
      "**/*.spec.*",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']",
          message:
            "Access env vars through @/lib/env getters instead of process.env directly.",
        },
        {
          // Catches bare/whole-object reads (e.g. `{ ...process.env }` or
          // `const e = process.env`) that the 3-level selector above misses,
          // since those are 2-level MemberExpressions with no trailing
          // `.SOME_VAR` property access. Excludes the case where this node is
          // itself the `.object` of a further property access (`process.env.X`),
          // since that 3-level chain is already reported by the selector above.
          selector:
            "MemberExpression[object.name='process'][property.name='env']:not(* > MemberExpression.object)",
          message:
            "Access env vars through @/lib/env getters instead of process.env directly.",
        },
        {
          // #1026 (FE-M3) — forbid unchecked `as string[]` casts directly on a
          // `t(...)` call result. `t()` is loosely typed (it also returns
          // plain objects/strings for non-array keys), so an unchecked cast
          // here can crash a caller's `.map()` on a malformed/missing
          // translation key. Use `tArray<T>(t, key)` from
          // `@/lib/i18n/typed-accessors` instead — it does the runtime shape
          // check and degrades to `[]` with a console.warn rather than
          // throwing. Best-effort static pattern: this only catches the
          // direct-cast shape (`t('key') as string[]`), not a cast on a
          // variable that merely holds a `t()` result assigned a few lines
          // earlier.
          selector:
            "TSAsExpression[expression.type='CallExpression'][expression.callee.name='t'][typeAnnotation.type='TSArrayType']",
          message:
            "Unchecked 'as T[]' cast on a t() result can crash .map() on a malformed translation key. Use tArray<T>(t, key) from @/lib/i18n/typed-accessors instead.",
        },
        {
          // Same as above, for the `as Array<T>` spelling.
          selector:
            "TSAsExpression[expression.type='CallExpression'][expression.callee.name='t'][typeAnnotation.type='TSTypeReference'][typeAnnotation.typeName.name='Array']",
          message:
            "Unchecked 'as Array<T>' cast on a t() result can crash .map() on a malformed translation key. Use tArray<T>(t, key) from @/lib/i18n/typed-accessors instead.",
        },
      ],
    },
  },
  {
    // Enforce @chapa/shared workspace alias — no relative imports to packages/shared.
    // Application code must use `@chapa/shared`, never `../../packages/shared/src/...`.
    // This matches the CLAUDE.md CI gate: "packages/shared import boundary".
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["**/packages/shared/**"],
        },
      ],
    },
  },
];

export default eslintConfig;
