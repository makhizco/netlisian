# Soft Component Lifecycle - Visual Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SOFT COMPONENT LIFECYCLE                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: BUILDING (Forward Topological Sort)                           │
│ ══════════════════════════════════════════════════════════════════════ │
│                                                                          │
│  Hard Components (Foundation)                                           │
│         ⬇⬇⬇                                                            │
│    [buildInitialSoftComponents]                                         │
│         ⬇⬇⬇                                                            │
│  ┌──────────────────────────────────────────────┐                      │
│  │ Topological Sort (Ascending Depth)            │                      │
│  │                                                │                      │
│  │ Depth 0: Button  (only hard deps)             │  Build Order         │
│  │    ⬇                                          │    Step 1            │
│  │ Depth 1: Card    (depends on Button)          │  Build Order         │
│  │    ⬇                                          │    Step 2            │
│  │ Depth 2: Layout  (depends on Card)            │  Build Order         │
│  │                                                │    Step 3            │
│  └──────────────────────────────────────────────┘                      │
│         ⬇⬇⬇                                                            │
│  All Soft Components Available in Config                               │
└─────────────────────────────────────────────────────────────────────────┘

                              ⬇⬇⬇

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: USAGE (Editor Mode)                                            │
│ ══════════════════════════════════════════════════════════════════════ │
│                                                                          │
│  User creates content with soft components                              │
│                                                                          │
│  ┌────────────────────────────┐                                        │
│  │  Data:                      │                                        │
│  │  {                          │                                        │
│  │    content: [               │                                        │
│  │      {                      │                                        │
│  │        type: "Layout",      │ ← Soft Component                       │
│  │        props: {             │                                        │
│  │          menu: [...],       │                                        │
│  │          main: [            │                                        │
│  │            {                │                                        │
│  │              type: "Card"   │ ← Nested Soft Component                │
│  │            }                │                                        │
│  │          ]                  │                                        │
│  │        }                    │                                        │
│  │      }                      │                                        │
│  │    ]                        │                                        │
│  │  }                          │                                        │
│  └────────────────────────────┘                                        │
│                                                                          │
│  Actions Available:                                                     │
│  ┌──────────────────────────────────────────────────────────┐          │
│  │ [decomposeSoftComponent]    - Single-level decomposition │          │
│  │    • Card → [Button, Div]                                │          │
│  │    • Button still soft (not fully dissolved)             │          │
│  │                                                           │          │
│  │ [demolishSoftComponent]     - Complete removal           │          │
│  │    • Replaces all Card instances with sub-components     │          │
│  │    • Removes Card from config & registry                 │          │
│  └──────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘

                              ⬇⬇⬇

┌─────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: RENDERING (Reverse Topological Sort)                          │
│ ══════════════════════════════════════════════════════════════════════ │
│                                                                          │
│  Data with Soft Components                                              │
│         ⬇⬇⬇                                                            │
│    [dissolveAllSoftComponents]                                          │
│         ⬇⬇⬇                                                            │
│  ┌──────────────────────────────────────────────┐                      │
│  │ Reverse Topological Sort (Descending Depth)   │                      │
│  │                                                │                      │
│  │ Round 1: Layout (Depth 2)                     │  Dissolve            │
│  │    Layout → Section (hard)                    │    Step 1            │
│  │    ⬇                                          │                      │
│  │    Slots still contain: Card (soft)           │                      │
│  │                                                │                      │
│  │ Round 2: Card (Depth 1)                       │  Dissolve            │
│  │    Card → Div (hard)                          │    Step 2            │
│  │    ⬇                                          │                      │
│  │    Slots still contain: Button (soft)         │                      │
│  │                                                │                      │
│  │ Round 3: Button (Depth 0)                     │  Dissolve            │
│  │    Button → [Div, Span] (all hard)            │    Step 3            │
│  │    ⬇                                          │                      │
│  │    ✓ Only hard components remain!             │                      │
│  └──────────────────────────────────────────────┘                      │
│         ⬇⬇⬇                                                            │
│  ┌────────────────────────────┐                                        │
│  │ Validation (Development)    │                                        │
│  │ [validateOnlyHardComponents]│                                        │
│  │                             │                                        │
│  │ ✓ isValid: true             │                                        │
│  │ ✓ softComponentsFound: []   │                                        │
│  └────────────────────────────┘                                        │
│         ⬇⬇⬇                                                            │
│  Data with Only Hard Components → Ready to Render! 🎉                  │
└─────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                        DEPENDENCY VISUALIZATION                         │
└─────────────────────────────────────────────────────────────────────────┘

                          Layout (D2)
                        /           \
                      /               \
                    /                   \
              Button (D0)              Card (D1)
                /    \                  /      \
              /        \              /          \
          Div (H)   Span (H)     Div (H)     Button (D0)
                                              /        \
                                          Div (H)   Span (H)

Legend:
  (D0, D1, D2) = Soft component with depth
  (H) = Hard component

BUILD ORDER (↑):    Button → Card → Layout
DISSOLVE ORDER (↓): Layout → Card → Button


┌─────────────────────────────────────────────────────────────────────────┐
│                           FILE STRUCTURE                                │
└─────────────────────────────────────────────────────────────────────────┘

lib/
├── build-initial-soft-components.ts       (Forward Sort)
│   └── buildInitialSoftComponents()        Build: Leaf → Composite
│
├── decompose-soft-component.ts             (Single Level)
│   ├── decomposeSoftComponent()            One level decomposition
│   └── isSoftComponent()                   Type checking
│
├── demolish-soft-component.ts              (Removal)
│   └── demolishSoftComponent()             Complete removal
│
├── dissolve-all-soft-components.ts         (Reverse Sort) ⭐
│   ├── dissolveAllSoftComponents()         Full dissolution
│   ├── validateOnlyHardComponents()        Validation
│   └── reverseTopologicalSort()            Ordering algorithm
│
└── resolve-soft-config.ts                  (Main Entry)
    └── resolveSoftConfig()                 Wrapper with validation


┌─────────────────────────────────────────────────────────────────────────┐
│                        ALGORITHM COMPARISON                             │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┬─────────────────┬─────────────────────┐
│      Aspect          │  Build (Fwd)    │  Dissolve (Rev)     │
├──────────────────────┼─────────────────┼─────────────────────┤
│ Direction            │ Leaf → Composite│ Composite → Leaf    │
│ Sort Order           │ Ascending Depth │ Descending Depth    │
│ Example Order        │ B → C → L       │ L → C → B           │
│ Goal                 │ Create soft     │ Remove soft         │
│ Starting Point       │ Hard components │ Soft components     │
│ Ending Point         │ Soft components │ Hard components     │
│ Dependencies         │ Must be built   │ Must be dissolved   │
│ Use Case             │ Setup/Init      │ Render/Export       │
│ Complexity           │ O(V log V)      │ O(V log V + N×D)    │
└──────────────────────┴─────────────────┴─────────────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW EXAMPLE                               │
└─────────────────────────────────────────────────────────────────────────┘

INPUT (Editor Data):
┌─────────────────────┐
│ Layout (soft)       │
│ ├─ menu             │
│ │  └─ Button (soft) │
│ └─ main             │
│    └─ Card (soft)   │
│       └─ Button     │
└─────────────────────┘

    ⬇ dissolveAllSoftComponents()

ROUND 1 (Dissolve Layout):
┌─────────────────────┐
│ Section (hard) ✓    │
│ ├─ menu             │
│ │  └─ Button (soft) │ ← Still soft
│ └─ main             │
│    └─ Card (soft)   │ ← Still soft
└─────────────────────┘

    ⬇ Continue...

ROUND 2 (Dissolve Card):
┌─────────────────────┐
│ Section (hard) ✓    │
│ ├─ menu             │
│ │  └─ Button (soft) │ ← Still soft
│ └─ main             │
│    └─ Div (hard) ✓  │
│       └─ Button     │ ← Still soft
└─────────────────────┘

    ⬇ Continue...

ROUND 3 (Dissolve Button):
┌─────────────────────┐
│ Section (hard) ✓    │
│ ├─ menu             │
│ │  └─ Div (hard) ✓  │
│ │     └─ Span ✓     │
│ └─ main             │
│    └─ Div (hard) ✓  │
│       └─ Div ✓      │
│          └─ Span ✓  │
└─────────────────────┘

OUTPUT: ✓ All Hard Components!


┌─────────────────────────────────────────────────────────────────────────┐
│                      SAFETY & ERROR HANDLING                            │
└─────────────────────────────────────────────────────────────────────────┘

1. Circular Dependency Detection
   ┌──────────────────────────┐
   │ A → B → C → A            │ ❌ Circular!
   │                          │
   │ Error: "Circular         │
   │  dependency detected"    │
   └──────────────────────────┘

2. Maximum Depth Protection
   ┌──────────────────────────┐
   │ depth > 50               │ ❌ Too deep!
   │                          │
   │ Bail out: return as-is   │
   │ Prevents infinite loop   │
   └──────────────────────────┘

3. Development Validation
   ┌──────────────────────────┐
   │ After dissolution:       │
   │ Check for soft comps     │
   │                          │
   │ ✓ All dissolved          │
   │ or ⚠ Warning logged      │
   └──────────────────────────┘

4. Graceful Error Recovery
   ┌──────────────────────────┐
   │ try {                    │
   │   decompose()            │
   │ } catch {                │
   │   return as-is           │ Don't crash!
   │ }                        │
   └──────────────────────────┘
```
