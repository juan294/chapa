// ESLint config for packages/shared.
// This package is a pure, dependency-free leaf — it must NEVER import from
// apps/web (@/ alias) or reference anything outside its own src/ directory.
const eslintConfig = [
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*"],
              message:
                "packages/shared must not import from apps/web (@/* alias). It is a pure leaf package.",
            },
            {
              group: ["apps/web/*", "../apps/web/*", "../../apps/web/*"],
              message:
                "packages/shared must not import from apps/web. It is a pure leaf package.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
