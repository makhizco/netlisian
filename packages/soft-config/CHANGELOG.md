# @netlisian/soft-config

## 0.2.0

### Minor Changes

- feat: swapped @measured/puck with @puckeditor/core

## 0.1.10

### Patch Changes

- - feat(apply-mapping): improve stability of apply-mapping
  - fix(remodel): resolve readonly permission issue for mapped fields
  - fix(remodel): include map prop in decomposed components
  - refactor(root-action): remove root-config render function in favor of root-action-handler using onAction instead of useEffect
  - perf(state): replace general setData and set calls with precise atomic, insert, remodel, replace, and setUi calls to improve performance

## 0.1.9

### Patch Changes

- Fix: order of calls for build, cancle, remodel to avoid triggering action guard and not isolate action based on status = "ready"

## 0.1.8

### Patch Changes

- feat: simplified the store provied and exposed the softconfig store

## 0.1.7

### Patch Changes

- feat: Matched component naming to puck and improved the builder slice to use requestAnimationFrame for performance.

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
