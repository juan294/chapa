import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  target: "node18",
  platform: "node",
  outDir: "dist",
  clean: true,
  // Bundle @chapa/shared INTO the output so the published
  // package has zero workspace dependencies at runtime.
  noExternal: ["@chapa/shared"],
  banner: { js: "#!/usr/bin/env node" },
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
  // Exclude test files from the bundle
  esbuildOptions(options) {
    options.external = [...(options.external ?? [])];
  },
});
