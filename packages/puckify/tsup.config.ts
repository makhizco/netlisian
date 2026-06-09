import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "compiler/index": "src/compiler/index.ts",
    "browser/index": "src/browser/index.tsx",
    "cli/index": "src/cli/index.ts",
  },
  banner: {
    js: "'use client'",
  },
  format: ["cjs", "esm"],
  external: [
    "react",
    "react-dom",
    "@measured/puck",
  ],
  dts: {
    resolve: true,
  },
  shims: true,
});
