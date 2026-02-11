import nextConfig from "eslint-config-next";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  { ignores: [".next/", "node_modules/", "next-env.d.ts"] },
  ...nextConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
