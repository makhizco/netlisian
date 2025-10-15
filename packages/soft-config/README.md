# Puck Soft Config

Enhanced configuration and UI components for Puck with soft component support and CSS modules.

## Installation

```bash
pnpm add @netlisian/pucksoftconfig
```

## Usage

### Basic Setup

```tsx
import { SoftConfigProvider } from '@netlisian/pucksoftconfig';
import '@netlisian/pucksoftconfig/styles.css'; // Import the styles

function App() {
  return (
    <SoftConfigProvider>
      {/* Your app content */}
    </SoftConfigProvider>
  );
}
```

### Importing Styles

The package includes compiled CSS that follows SUIT CSS naming convention. You can import it in two ways:

```tsx
// Using the named export
import '@netlisian/pucksoftconfig/styles.css';

// Or using the full path
import '@netlisian/pucksoftconfig/dist/index.css';
```

### Custom Overrides

You can use the provided custom components:

```tsx
import {
  CustomActionBar,
  CustomComponentItem,
  CustomHeader,
} from '@netlisian/pucksoftconfig';

const config = {
  // ... your config
  overrides: {
    actionBar: CustomActionBar,
    componentItem: CustomComponentItem,
    header: CustomHeader,
  },
};
```

## Features

- ✅ Type-safe CSS modules with SUIT CSS naming
- ✅ Soft component management (build, remodel, decompose, demolish)
- ✅ Version management for soft components
- ✅ Error boundaries for component rendering
- ✅ Custom action bars and component items
- ✅ Zustand-based state management

## Architecture

This package follows the CSS modules pattern from `@measured/puck`:

- **SUIT CSS naming convention**: `.ComponentName-descendant`
- **Type-safe class names**: Full TypeScript support
- **Scoped styles**: Prevents CSS conflicts
- **Optimized builds**: All CSS bundled into a single file

See [CSS_MODULES_MIGRATION.md](./CSS_MODULES_MIGRATION.md) for detailed implementation notes.

## License

MIT
