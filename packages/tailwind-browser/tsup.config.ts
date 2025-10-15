import { defineConfig } from "tsup";

export default defineConfig({
  format: ["esm", "cjs"], // ESM and CommonJS formats only
  clean: true,
  minify: true,
  entry: ["src/index.ts"],
  noExternal: [/.*/],
  loader: {
    ".css": "text",
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.FEATURES_ENV": '"stable"',
  },
  splitting: false, // Disable splitting for single file output
  dts: false, // Disable TypeScript declarations to avoid build errors
});
