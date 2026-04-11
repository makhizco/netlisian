# @netlisian/soft-config

The core library for building and managing **Soft Components** within the Netlisian ecosystem. It provides type-safe field definitions, recursive mapping logic, and state management for the Puck editor.

## Installation

```bash
npm install @netlisian/soft-config
```

## Features

- **Soft Component Builder**: Easy-to-use interface for creating versioned components.
- **Dynamic Field Options**: Automatically generates dot-notated mapping paths for nested objects and arrays.
- **Custom Field Support**: Extend the editor with custom UI while maintaining return type safety.
- **Puck Overrides**: Pre-built component overrides (ActionBar, Header, ComponentList) to seamlessly integrate Soft Components into the Puck editor.

## Key Concepts

### Soft Component Definitions

A Soft Component consists of fields, default props, and typed components.

```typescript
import { SoftFieldDefinition } from "@netlisian/soft-config";

const galleryField: SoftFieldDefinition = {
  name: "gallery",
  type: "array",
  subFields: [
    { name: "src", type: "text" },
    { name: "alt", type: "text" }
  ]
};
```

### Custom Field Extensibility

Define custom field types with specified return types (`string`, `number`, `boolean`, `object`, `array`).

```typescript
import { CustomFields } from "@netlisian/soft-config";

export const myCustomFields: CustomFields = {
  "my-color": {
    field: { type: "custom", render: () => <div>Color Picker</div> },
    returnType: "string"
  }
};
```

### Field Mapping

The library handles the logic for mapping configuration data to component props, including recursive array iteration using `[]` syntax (e.g., `features[].title`).

## Documentation

For detailed guides and API references, check the [Netlisian Docs](https://docs.netlisian.com).

## License

MIT
