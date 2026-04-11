# @netlisian/soft-config

## 0.1.6

### Patch Changes

- feat: Added mapComponentConfig override.

## 0.0.1 (2026-04-06)

This initial release introduces the core tools for defining and managing **Soft Components** within the Puck editor.

### Key Changes:

- **Soft Component Builder**: Comprehensive API for versioned component creation.
- **Dynamic Field Strategy**: Robust generation of dot-notation paths for mapping (e.g., `user.address`), supporting both scalars and iterables.
- **Array Field Support**: Integration of nested fields within arrays with `getItemSummary` support.
- **Custom Field Support**: Advanced extensibility for the Puck editor with type-safe return values (`string`, `number`, `boolean`, `object`, `array`).
- **Puck Editor Overrides**: Built-in React components (`ActionBar`, `Header`, `ComponentList`, `Drawer`, `DrawerItem`) tailored for Soft Component management.
- **Recursive Mapping Options**: Intelligent filtering and generation of field paths, including `[]` notation for array-to-prop mapping.
- **Store Slices**: `builder` slice for managing global editor state and component definitions.
