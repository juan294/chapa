import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    testTimeout: 15000,
    include: [
      "apps/**/*.test.{ts,tsx}",
      "packages/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/node_modules.nosync/**",
      "**/*.contract.test.ts",
    ],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      include: [
        "apps/web/lib/**",
        "apps/web/app/**",
        "apps/web/components/**",
        "packages/shared/**",
      ],
      exclude: [
        "**/*.test.*",
        "**/*.d.ts",
        "**/*.md",
        "**/node_modules.nosync/**",
        "**/__fixtures__/**",
        "**/fonts/**",
        // Type-only modules: no runtime behaviour to measure
        "packages/shared/src/types.ts",
        "packages/shared/src/stats-schema.ts",
        // i18n dictionaries: pure data, no branching logic
        "apps/web/lib/i18n/dictionaries/**",
        // Index re-exports: just re-export other modules
        "packages/shared/src/index.ts",
        "apps/web/lib/*/index.ts",
        // Test helpers and stubs
        "test/**",
        "apps/web/test/**",
        // Package config files: not runtime source, no behaviour to measure
        "packages/shared/{package.json,tsconfig*.json,eslint.config.mjs}",
      ],
      thresholds: {
        statements: 75,
        branches: 70,
        functions: 65,
        lines: 75,
        // Per-path floors for the highest-risk areas (#1028): the global
        // floor above is ~22 points below actual measured coverage, which
        // would let a regression gut the scoring pipeline's tests without
        // failing CI. These are set a few points below currently-measured
        // coverage (impact/**: ~99.6/98.7/100/99.5 stmts/branches/fn/lines;
        // stats-integrity.ts: 100/100/100/100 as of #1028) — tight enough to
        // catch a large regression, loose enough that a legitimate refactor
        // removing a branch doesn't trip the gate.
        //
        // CI SHARDING CAVEAT: ci.yml's per-shard `vitest run --shard=N/2`
        // invocation only ever sees a subset of test files, so no single
        // shard can satisfy a full-suite floor for any path — that's exactly
        // why the per-shard step zeroes the *global* thresholds via
        // `--coverage.thresholds.lines=0` etc. Those CLI flags only override
        // vitest's top-level threshold keys, not glob-keyed nested entries
        // like the two below, so without this guard a sharded run still
        // enforced these floors against its own partial coverage and failed
        // every time (caught in CI, not locally, since local `test:coverage`
        // always runs the full unsharded suite). `VITEST_SHARD_RUN` is set
        // only on the per-shard CI step (ci.yml); the merge/aggregator step
        // that actually owns enforcement (`vitest run --merge-reports
        // --coverage`, no shard flag, no env var) still gets the real floors.
        ...(process.env.VITEST_SHARD_RUN
          ? {}
          : {
              "apps/web/lib/impact/**": {
                statements: 95,
                branches: 90,
                functions: 95,
                lines: 95,
              },
              "apps/web/lib/github/stats-integrity.ts": {
                statements: 90,
                branches: 85,
                functions: 90,
                lines: 90,
              },
            }),
      },
    },
  },
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "apps/web") + "/",
      "@chapa/shared": path.resolve(__dirname, "packages/shared/src"),
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
});
