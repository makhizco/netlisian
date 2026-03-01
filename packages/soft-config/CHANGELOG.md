# @netlisian/softconfig

## 0.1.1

### Patch Changes

- feat: Updated the flow to generate camelCase key from name. Provided overrides to use custom componentKeyGenerator. Setup categories.

## 0.1.0

### Minor Changes

- feat: Modified the flow to build and remodel in place rather than replacing the whole data at the root.

  feat: Added a new flag `showVersionFields` to control the visibility of version-related fields in the editor UI.

  feat: Optimized the soft-renderer to use fast-deep-equal for prop comparison, improving performance during remodeling.

## 0.0.11

### Patch Changes

- feat: Added support for hydrating functions after puck has been rendered

## 0.0.9

### Patch Changes

- fix: Added types for Actions

## 0.0.8

### Patch Changes

- fix: Typescript issues

## 0.0.7

### Patch Changes

- feat: Added onActions callback.

## 0.0.6

### Patch Changes

- fix: Strip id from the slots enabled children to avoid linking and added support for soft-components transformation via hydration

## 0.0.5

### Patch Changes

- fix: Updated soft-render function and create-versioned-component to support transfrom in field mapping, when available.

## 0.0.4

### Patch Changes

- fix: export types for Builder and component for modal

## 0.0.3

### Patch Changes

- fix: Added tsup es postcss pluign for css modules.

## 0.0.2

### Patch Changes

- fix: Export the css files for overrides and other funtions.

## 0.0.1

### Patch Changes

- fix: Removed creation of softconfig store at module evaluation time.

## 0.0.0

### Patch Changes

- Fixed the package json export issue.

## 0.0.0-alpha-20251026130436

### Minor Changes

- Initial Release for Soft Config Puck
