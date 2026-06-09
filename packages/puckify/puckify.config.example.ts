import { PuckifyConfig } from "@netlisian/puckify";

export default {
  compiler: {
    // Target library for optimization
    // "shadcn" | "custom" | "auto" (default: "auto")
    targetLibrary: "shadcn",

    // Include CSS/styling information in output
    // (default: true)
    includeStyles: true,

    // Generate field helper utilities
    // (default: true)
    generateFieldHelpers: true,

    // Attempt to resolve imports
    // (default: true)
    resolveImports: true,
  },

  output: {
    // Output format for CLI
    // "typescript" | "javascript" | "json" (default: "json")
    format: "typescript",

    // Indentation spaces
    // (default: 2)
    indent: 2,

    // Include JSDoc comments in output
    // (default: true)
    includeComments: true,
  },

  // Glob patterns to exclude
  exclude: ["**/*.test.tsx", "**/*.spec.tsx", "**/node_modules/**"],

  // Glob patterns to include
  include: ["src/components/**/*.tsx"],
} satisfies PuckifyConfig;
