# Dissolve All Soft Components

## Overview

The `dissolve-all-soft-components.ts` module provides **reverse topological sorting** to dissolve soft components down to their hard component foundations. This is the opposite of the build process - instead of building from simple to complex, we dissolve from complex to simple.

## Problem Solved

When rendering or exporting data, we need to ensure all soft components are fully resolved to hard components only. This prevents runtime errors and ensures the final output contains only components that can actually render.

### Challenge: Correct Dissolution Order

If we have nested soft components:
- **Layout** (soft) contains **Card** (soft)
- **Card** (soft) contains **Button** (soft)  
- **Button** (soft) contains **Div** (hard)

We must dissolve in the **reverse order** of how they were built:
1. **Layout** → dissolve first (most composite)
2. **Card** → dissolve second
3. **Button** → dissolve last (most leaf-like)
4. Only **hard components** remain

## Solution: Reverse Topological Sorting

### Build Order (Forward)
```
Button (depth 0) → Card (depth 1) → Layout (depth 2)
  ↑ leaf               ↑                  ↑ composite
```

### Dissolve Order (Reverse)
```
Layout (depth 2) → Card (depth 1) → Button (depth 0)
  ↑ composite           ↑                ↑ leaf
```

## Architecture

### Three-Tier Decomposition System

#### 1. Single-Level Decomposition
**File:** `decompose-soft-component.ts`

```typescript
decomposeSoftComponent(componentData, softComponents)
```

- Decomposes **one level only**
- Used by builder actions for controlled decomposition
- Does NOT recursively dissolve nested soft components

**Example:**
```typescript
// Card (soft) -> [Button (soft), Div (hard)]
const decomposed = decomposeSoftComponent(cardData, softComponents);
// Button is still a soft component!
```

#### 2. Component Removal (Demolish)
**File:** `demolish-soft-component.ts`

```typescript
demolishSoftComponent(componentName, data, config, softComponents)
```

- Replaces all instances of a specific component
- Removes component from registry and config
- Uses single-level decomposition

**Example:**
```typescript
const result = demolishSoftComponent("Card", data, config, softComponents);
// All Card instances replaced with [Button, Div]
// Card removed from config
```

#### 3. Full Dissolution (Recursive)
**File:** `dissolve-all-soft-components.ts`

```typescript
dissolveAllSoftComponents(data, softComponents, config)
```

- Dissolves **ALL** soft components recursively
- Uses reverse topological sorting
- Continues until **only hard components remain**
- Validates final result in development mode

**Example:**
```typescript
// Before: Layout (soft) -> Card (soft) -> Button (soft) -> Div (hard)
const dissolved = dissolveAllSoftComponents(data, softComponents, config);
// After: Only Div, Span, Section, etc. (all hard components)
```

## How It Works

### Step 1: Calculate Component Depths

```typescript
function calculateDepth(componentName: string): number {
  const deps = getDependencies(componentName);
  
  if (deps.length === 0) {
    return 0; // Leaf component (only hard deps)
  }
  
  return 1 + max(deps.map(dep => calculateDepth(dep)));
}
```

**Example:**
- Button: depth 0 (only depends on hard components)
- Card: depth 1 (depends on Button)
- Layout: depth 2 (depends on Card)

### Step 2: Sort by Depth (Descending)

```typescript
const dissolutionOrder = components
  .sort((a, b) => depth(b) - depth(a))
  .map(c => c.name);

// Result: ["Layout", "Card", "Button"]
```

### Step 3: Recursive Dissolution

```typescript
function dissolveComponentRecursively(
  component: ComponentData,
  softComponents: SoftComponents,
  depth: number = 0
): ComponentData[] {
  // Base case: hard component
  if (isHardComponent(component.type)) {
    return [dissolveSlots(component)]; // Process nested slots
  }
  
  // Decompose one level
  const decomposed = decomposeSoftComponent(component, softComponents);
  
  // Recursively dissolve each decomposed component
  return decomposed.flatMap(c => 
    dissolveComponentRecursively(c, softComponents, depth + 1)
  );
}
```

### Step 4: Process All Slots

```typescript
function dissolveSlots(component: ComponentData): ComponentData {
  const newProps = { ...component.props };
  
  // For each slot (array of components)
  Object.entries(newProps).forEach(([key, value]) => {
    if (isSlot(value)) {
      newProps[key] = value.flatMap(slotComponent =>
        dissolveComponentRecursively(slotComponent)
      );
    }
  });
  
  return { ...component, props: newProps };
}
```

## Complete Flow Example

### Initial Data
```typescript
{
  content: [
    {
      type: "Layout",  // Soft, depth 2
      props: {
        header: [
          { type: "Button", ... }  // Soft, depth 0
        ],
        main: [
          { type: "Card", ... }    // Soft, depth 1
        ]
      }
    }
  ]
}
```

### Dissolution Process

**Round 1: Dissolve Layout (depth 2)**
```typescript
Layout -> [Section (hard)]
  Section.header = [Button (soft)]  // Still soft!
  Section.main = [Card (soft)]      // Still soft!
```

**Round 2: Dissolve Card (depth 1)**
```typescript
Card -> [Div (hard)]
  Div.content = [Button (soft)]  // Still soft!
```

**Round 3: Dissolve Button (depth 0)**
```typescript
Button -> [Div (hard), Span (hard)]
```

### Final Result
```typescript
{
  content: [
    {
      type: "Section",  // Hard
      props: {
        header: [
          { type: "Div", ... },    // Hard
          { type: "Span", ... }    // Hard
        ],
        main: [
          {
            type: "Div",           // Hard
            props: {
              content: [
                { type: "Div", ... },   // Hard
                { type: "Span", ... }   // Hard
              ]
            }
          }
        ]
      }
    }
  ]
}
```

## Safety Features

### 1. Infinite Recursion Prevention

```typescript
const MAX_DEPTH = 50;

if (depth > MAX_DEPTH) {
  console.error("Maximum depth exceeded. Possible circular dependency.");
  return [componentData]; // Bail out
}
```

### 2. Validation (Development Mode)

```typescript
const validation = validateOnlyHardComponents(dissolved, softComponents);

if (!validation.isValid) {
  console.warn("Soft components still present:", validation.softComponentsFound);
}
```

### 3. Error Handling

```typescript
try {
  decomposed = decomposeSoftComponent(componentData, softComponents);
} catch (error) {
  console.warn(`Failed to decompose "${componentType}":`, error);
  return [componentData]; // Return as-is, don't crash
}
```

## Performance

### Time Complexity
- **Depth Calculation:** O(V + E) where V = components, E = dependencies
- **Sorting:** O(V log V)
- **Dissolution:** O(N × D) where N = total components, D = average depth
- **Total:** O(V log V + N × D)

### Space Complexity
- O(V) for depth map and visited sets
- O(N) for dissolved component arrays

For typical use cases (10-100 components, depth 1-5), this is very fast.

## Comparison with Build Process

| Aspect | Build | Dissolve |
|--------|-------|----------|
| **Direction** | Forward (leaf → composite) | Reverse (composite → leaf) |
| **Order** | Button → Card → Layout | Layout → Card → Button |
| **Goal** | Create composite components | Break down to hard only |
| **Depth** | Low to High | High to Low |
| **Use Case** | Creating soft components | Rendering/exporting data |
| **Stops At** | Fully built soft components | Only hard components remain |

## Integration Points

### 1. Render Time (use-demo-data.ts)
```typescript
const decomposedData = resolveSoftConfig(
  resolved as Data,
  softComponents,
  config
);
```

### 2. Export/Publish
```typescript
const exportData = dissolveAllSoftComponents(data, softComponents, config);
// exportData contains only hard components, ready for rendering
```

### 3. Testing/Validation
```typescript
const validation = validateOnlyHardComponents(data, softComponents);
expect(validation.isValid).toBe(true);
```

## Best Practices

### ✅ Do
- Use `dissolveAllSoftComponents` for final rendering
- Validate output in development mode
- Trust the topological sorting - it handles dependencies correctly
- Use `decomposeSoftComponent` for single-level operations

### ❌ Don't
- Try to manually order component dissolution
- Skip validation in development
- Assume soft components can render directly
- Mix dissolution with build operations

## Troubleshooting

### Problem: Soft Components Still Present After Dissolution

**Possible Causes:**
1. Component not registered in `softComponents`
2. Circular dependency preventing full dissolution
3. Component version mismatch

**Solution:**
```typescript
const validation = validateOnlyHardComponents(result, softComponents);
console.log("Soft components found:", validation.softComponentsFound);
```

### Problem: Maximum Depth Exceeded

**Cause:** Circular dependency in component structure

**Solution:** Check your component definitions for cycles:
```typescript
// Bad: A contains B contains A
Layout -> Card -> Layout  // Circular!

// Good: Linear dependency chain
Layout -> Card -> Button -> [hard components]
```

## Future Enhancements

- Parallel dissolution of independent branches
- Caching of dissolution results for identical subtrees
- Progressive dissolution with intermediate checkpoints
- Dissolution performance profiling
