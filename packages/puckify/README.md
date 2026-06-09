# @netlisian/puckify

Convert React components to Puck config. Supports shadcn components and custom React components.

## Features

- 🔄 Convert React components to Puck field configurations
- 💻 Browser-based converter component
- 🖥️ CLI tool for batch conversions
- ⚙️ Configurable compiler options
- 📦 Specifically optimized for shadcn components

## Installation

```bash
pnpm add @netlisian/puckify
```

## Browser Usage

Import the converter component for inline conversion:

```tsx
import { ComponentConverter } from "@netlisian/puckify/browser";

export function ConverterPage() {
  return <ComponentConverter />;
}
```

## CLI Usage

```bash
netlisian convert --input ./components --output ./puck-config.ts
netlisian convert --input ./button.tsx --config ./puckify.config.ts
```

## Configuration

Create a `puckify.config.ts` file in your project root:

```typescript
import { PuckifyConfig } from "@netlisian/puckify";

export default {
  compiler: {
    targetLibrary: "shadcn",
    includeStyles: true,
    generateFieldHelpers: true,
  },
  output: {
    format: "typescript",
    indent: 2,
  },
} satisfies PuckifyConfig;
```

## Compiler API

Use the compiler programmatically:

```typescript
import { PuckifyCompiler } from "@netlisian/puckify/compiler";

const compiler = new PuckifyCompiler();
const config = await compiler.compile("./button.tsx");
console.log(config);
```

## License

MIT
