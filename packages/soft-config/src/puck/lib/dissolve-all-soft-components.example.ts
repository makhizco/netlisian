/**
 * EXAMPLE: Reverse Topological Dissolution in Action
 * 
 * This file demonstrates the difference between building and dissolving,
 * showing how reverse topological sorting ensures correct dissolution order.
 */

// ============================================================================
// EXAMPLE COMPONENT STRUCTURE
// ============================================================================

const exampleStructure = {
  // Hard Components (Foundation)
  hardComponents: {
    Div: "renders a div element",
    Span: "renders a span element", 
    Section: "renders a section element",
    Button: "renders a button element (native)",
  },

  // Soft Components (Built from hard components)
  softComponents: {
    // Depth 0: Only depends on hard components
    CustomButton: {
      dependencies: ["Div", "Span"],  // All hard
      structure: {
        Div: {
          className: "button-wrapper",
          children: [
            { Span: { text: "Click me" } }
          ]
        }
      }
    },

    // Depth 1: Depends on CustomButton (soft) and hard components
    Card: {
      dependencies: ["Div", "CustomButton"],  // Mixed: 1 soft, 1 hard
      structure: {
        Div: {
          className: "card",
          children: [
            { Div: { className: "card-header" } },
            { CustomButton: { label: "Action" } },  // Soft component!
          ]
        }
      }
    },

    // Depth 2: Depends on Card (soft) and CustomButton (soft)
    Layout: {
      dependencies: ["Section", "Card", "CustomButton"],  // 2 soft, 1 hard
      structure: {
        Section: {
          className: "layout",
          children: [
            { CustomButton: { label: "Menu" } },  // Soft
            { Card: { title: "Content" } },       // Soft
          ]
        }
      }
    }
  }
};

// ============================================================================
// BUILD PROCESS (Forward Topological Sort)
// ============================================================================

/**
 * BUILD ORDER: Leaf components first, composite last
 * 
 * Step 1: Build CustomButton (depth 0)
 * ├─ Dependencies: [Div, Span] ✓ (all hard, available)
 * └─ Result: CustomButton config created
 * 
 * Step 2: Build Card (depth 1)
 * ├─ Dependencies: [Div, CustomButton] ✓ (CustomButton now available)
 * └─ Result: Card config created
 * 
 * Step 3: Build Layout (depth 2)
 * ├─ Dependencies: [Section, Card, CustomButton] ✓ (all available)
 * └─ Result: Layout config created
 */

const buildOrder = ["CustomButton", "Card", "Layout"];

// After build, all components are available:
const builtConfig = {
  components: {
    // Hard components
    Div: { /* ... */ },
    Span: { /* ... */ },
    Section: { /* ... */ },
    // Soft components (built in order)
    CustomButton: { /* composed from Div + Span */ },
    Card: { /* composed from Div + CustomButton */ },
    Layout: { /* composed from Section + Card + CustomButton */ },
  }
};

// ============================================================================
// DISSOLVE PROCESS (Reverse Topological Sort)
// ============================================================================

/**
 * DISSOLVE ORDER: Composite components first, leaf last
 * 
 * This is the OPPOSITE of build order!
 * We dissolve from most complex to simplest.
 */

const dissolveOrder = ["Layout", "Card", "CustomButton"];

/**
 * WHY REVERSE ORDER?
 * 
 * If we dissolved in build order (CustomButton, Card, Layout):
 * 
 * Step 1: Dissolve CustomButton
 * ├─ Layout still contains CustomButton ❌
 * ├─ Card still contains CustomButton ❌
 * └─ Result: Incomplete dissolution!
 * 
 * Step 2: Dissolve Card
 * ├─ Layout still contains Card ❌
 * └─ Result: Still incomplete!
 * 
 * Step 3: Dissolve Layout
 * ├─ Contains Card (soft) - but Card references CustomButton (already dissolved!)
 * └─ Result: Broken references! ❌
 */

/**
 * CORRECT REVERSE ORDER DISSOLUTION:
 */

// Initial Data
const initialData = {
  content: [
    {
      type: "Layout",  // Depth 2 (most composite)
      props: {
        menu: [
          { type: "CustomButton", props: { label: "Menu" } }
        ],
        main: [
          { type: "Card", props: { title: "Content" } }
        ]
      }
    }
  ]
};

// Round 1: Dissolve Layout (depth 2) ───────────────────────────────────
const afterLayoutDissolution = {
  content: [
    {
      type: "Section",  // Hard component
      props: {
        className: "layout",
        menu: [
          { type: "CustomButton", props: { label: "Menu" } }  // Still soft!
        ],
        main: [
          { type: "Card", props: { title: "Content" } }  // Still soft!
        ]
      }
    }
  ]
};

// Round 2: Dissolve Card (depth 1) ─────────────────────────────────────
const afterCardDissolution = {
  content: [
    {
      type: "Section",  // Hard
      props: {
        className: "layout",
        menu: [
          { type: "CustomButton", props: { label: "Menu" } }  // Still soft!
        ],
        main: [
          {
            type: "Div",  // Hard component
            props: {
              className: "card",
              children: [
                { type: "Div", props: { className: "card-header" } },  // Hard
                { type: "CustomButton", props: { label: "Action" } }  // Still soft!
              ]
            }
          }
        ]
      }
    }
  ]
};

// Round 3: Dissolve CustomButton (depth 0) ─────────────────────────────
const finalResult = {
  content: [
    {
      type: "Section",  // Hard
      props: {
        className: "layout",
        menu: [
          {
            type: "Div",  // Hard
            props: {
              className: "button-wrapper",
              children: [
                { type: "Span", props: { text: "Menu" } }  // Hard
              ]
            }
          }
        ],
        main: [
          {
            type: "Div",  // Hard
            props: {
              className: "card",
              children: [
                { type: "Div", props: { className: "card-header" } },  // Hard
                {
                  type: "Div",  // Hard
                  props: {
                    className: "button-wrapper",
                    children: [
                      { type: "Span", props: { text: "Action" } }  // Hard
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    }
  ]
};

// ✓ ALL COMPONENTS ARE NOW HARD! ✓

// ============================================================================
// DEPTH CALCULATION VISUALIZATION
// ============================================================================

/**
 * Visual representation of component depths:
 * 
 *                    Layout (Depth 2)
 *                   /                \
 *                  /                  \
 *          CustomButton (Depth 0)    Card (Depth 1)
 *             /        \                /         \
 *            /          \              /           \
 *         Div (H)    Span (H)      Div (H)    CustomButton (D0)
 *                                                /         \
 *                                               /           \
 *                                           Div (H)      Span (H)
 * 
 * Legend:
 * - (H) = Hard component
 * - (D0, D1, D2) = Soft component depth
 * 
 * Depths:
 * - CustomButton: 0 (only hard dependencies)
 * - Card: 1 (depends on CustomButton at depth 0)
 * - Layout: 2 (depends on Card at depth 1)
 * 
 * Build Order:   [CustomButton(0), Card(1), Layout(2)]  ← Ascending depth
 * Dissolve Order: [Layout(2), Card(1), CustomButton(0)] ← Descending depth
 */

// ============================================================================
// ALGORITHM COMPARISON
// ============================================================================

const algorithmComparison = {
  build: {
    name: "Forward Topological Sort",
    goal: "Create composite components from simple ones",
    order: "Ascending depth (0 → 2)",
    process: "Leaf → Composite",
    example: "Button → Card → Layout",
    ensures: "All dependencies available when building",
  },

  dissolve: {
    name: "Reverse Topological Sort", 
    goal: "Break down to only hard components",
    order: "Descending depth (2 → 0)",
    process: "Composite → Leaf",
    example: "Layout → Card → Button",
    ensures: "No soft components reference dissolved components",
  }
};

// ============================================================================
// PRACTICAL USE CASES
// ============================================================================

/**
 * 1. RENDERING
 * 
 * Before rendering, dissolve all soft components so the renderer
 * only deals with actual HTML elements.
 */
const renderUseCase = `
  const data = { /* contains soft components */ };
  const dissolved = dissolveAllSoftComponents(data, softComponents, config);
  // dissolved now contains only hard components that can render
  return <Render data={dissolved} config={hardConfig} />;
`;

/**
 * 2. EXPORTING
 * 
 * When exporting to static HTML or another format, ensure all
 * components are resolved to their primitive forms.
 */
const exportUseCase = `
  const editorData = { /* contains soft components */ };
  const dissolved = dissolveAllSoftComponents(editorData, softComponents, config);
  const html = generateHTML(dissolved); // Only hard components
  return html;
`;

/**
 * 3. TESTING
 * 
 * Validate that all soft components can be fully dissolved.
 */
const testUseCase = `
  const testData = { /* test data with soft components */ };
  const dissolved = dissolveAllSoftComponents(testData, softComponents, config);
  const validation = validateOnlyHardComponents(dissolved, softComponents);
  expect(validation.isValid).toBe(true);
`;

// ============================================================================
// EDGE CASES & ERROR HANDLING
// ============================================================================

/**
 * CIRCULAR DEPENDENCIES
 * 
 * Bad:
 *   A depends on B
 *   B depends on C
 *   C depends on A  ← Circular!
 * 
 * Detection:
 *   During depth calculation, if we visit a component already being processed,
 *   we detect the cycle and throw an error.
 * 
 * Prevention:
 *   Design components with clear hierarchies, no cycles.
 */

/**
 * MAXIMUM DEPTH
 * 
 * If dissolution exceeds MAX_DEPTH (50), we bail out to prevent
 * infinite recursion from circular dependencies.
 */

/**
 * MISSING COMPONENTS
 * 
 * If a soft component references another soft component that doesn't exist,
 * the component is treated as hard and left as-is.
 */

// ============================================================================
// PERFORMANCE CHARACTERISTICS
// ============================================================================

const performanceProfile = {
  depthCalculation: "O(V + E) - Visit each component and edge once",
  sorting: "O(V log V) - Sort components by depth",
  dissolution: "O(N × D) - N total components, D average depth",
  typical: "For 50 components at depth 3: ~150 operations (very fast!)",
  
  comparison: {
    naive: "Dissolving without order could require multiple passes",
    topological: "Single pass in correct order, guaranteed complete",
  }
};

export {
  exampleStructure,
  buildOrder,
  dissolveOrder,
  initialData,
  finalResult,
  algorithmComparison,
};
