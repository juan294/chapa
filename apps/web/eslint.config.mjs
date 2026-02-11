import { createRequire } from "module";

const require = createRequire(import.meta.url);

const nextConfig = require("eslint-config-next");
const nextCoreWebVitals = require("eslint-config-next/core-web-vitals");
const nextTypescript = require("eslint-config-next/typescript");

const eslintConfig = [
  { ignores: [".next/", "node_modules/", "next-env.d.ts"] },
  ...nextConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
