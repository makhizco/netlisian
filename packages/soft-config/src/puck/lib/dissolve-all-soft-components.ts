import { ComponentData, Config, Data } from "@measured/puck";
import { SoftComponents } from "../types/SoftComponent";
import { decomposeSoftComponent, isSoftComponent } from "./decompose-soft-component";

/**
 * Extracts all component dependencies from a SoftComponent's structure.
 * Same as buildInitialSoftComponents but returns a Set for easier manipulation.
 */
function extractDependencies(
  softComponents: SoftComponents,
  componentName: string,
  version: string
): Set<string> {
  const dependencies = new Set<string>();
  const component = softComponents[componentName]?.versions?.[version];

  if (!component) {
    return dependencies;
  }

  // Recursively extract dependencies from subcomponents
  const processSubComponents = (subComponents: any[]): void => {
    if (!Array.isArray(subComponents)) return;

    for (const subComponent of subComponents) {
      if (subComponent?.type) {
        dependencies.add(subComponent.type);

        // Recursively process nested components in slots
        if (subComponent.components) {
          Object.values(subComponent.components).forEach((nestedComponents) => {
            processSubComponents(nestedComponents as any[]);
          });
        }
      }
    }
  };

  processSubComponents(component.components);

  return dependencies;
}

/**
 * Performs REVERSE topological sort on soft components.
 * Components with the most dependencies come first (Layout, Card, Button order).
 * This is the opposite of the build order - we dissolve composite components first,
 * then their dependencies, ensuring we always decompose to simpler forms.
 * 
 * @param softComponents - All soft components
 * @param hardComponentNames - Set of hard component names
 * @returns Array of component names in reverse dependency order (composite first)
 */
function reverseTopologicalSort(
  softComponents: SoftComponents,
  hardComponentNames: Set<string>
): string[] {
  // Build dependency graph
  const dependencyGraph = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>(); // reverse graph

  for (const [componentName, component] of Object.entries(softComponents)) {
    const defaultVersion =
      component.defaultVersion || Object.keys(component.versions || {}).pop();

    if (!defaultVersion) continue;

    const allDeps = extractDependencies(
      softComponents,
      componentName,
      defaultVersion
    );

    // Filter to only soft component dependencies
    const softDeps = new Set(
      [...allDeps].filter((dep) => !hardComponentNames.has(dep))
    );

    dependencyGraph.set(componentName, softDeps);

    // Build reverse graph (who depends on me?)
    for (const dep of softDeps) {
      if (!dependents.has(dep)) {
        dependents.set(dep, new Set());
      }
      dependents.get(dep)!.add(componentName);
    }
  }

  // Calculate depth (distance from leaf components)
  const depths = new Map<string, number>();
  
  function calculateDepth(componentName: string): number {
    if (depths.has(componentName)) {
      return depths.get(componentName)!;
    }

    const deps = dependencyGraph.get(componentName) || new Set();
    if (deps.size === 0) {
      // Leaf component (no soft dependencies)
      depths.set(componentName, 0);
      return 0;
    }

    // Depth is 1 + max depth of dependencies
    let maxDepth = -1;
    for (const dep of deps) {
      if (softComponents[dep]) {
        maxDepth = Math.max(maxDepth, calculateDepth(dep));
      }
    }

    const depth = maxDepth + 1;
    depths.set(componentName, depth);
    return depth;
  }

  // Calculate depths for all components
  for (const componentName of Object.keys(softComponents)) {
    calculateDepth(componentName);
  }

  // Sort by depth (descending) - deepest (most composite) first
  const sortedByDepth = [...depths.entries()]
    .sort(([, depthA], [, depthB]) => depthB - depthA)
    .map(([name]) => name);

  return sortedByDepth;
}

/**
 * Recursively dissolves a component and all its slot contents until only hard components remain.
 * 
 * @param componentData - The component to dissolve
 * @param softComponents - The registry of soft components
 * @param hardComponentNames - Set of hard component names
 * @param depth - Current recursion depth (for safety)
 * @returns Array of fully dissolved components (all hard)
 */
function dissolveComponentRecursively(
  componentData: ComponentData,
  softComponents: SoftComponents,
  hardComponentNames: Set<string>,
  depth: number = 0,
  fieldSettings?: Record<string, any>
): ComponentData[] {
  const MAX_DEPTH = 50; // Prevent infinite recursion
  
  if (depth > MAX_DEPTH) {
    console.error(
      `Maximum dissolution depth (${MAX_DEPTH}) exceeded for component ${componentData.type}. Possible circular dependency.`
    );
    return [componentData];
  }

  const componentType = componentData.type;

  // If this is a hard component, process its slots and return
  if (!isSoftComponent(componentType, softComponents)) {
    return [dissolveComponentSlots(componentData, softComponents, hardComponentNames, depth, fieldSettings)];
  }

  // This is a soft component - decompose it one level
  let decomposed: ComponentData[];
  try {
    decomposed = decomposeSoftComponent(componentData, softComponents, fieldSettings);
  } catch (error) {
    console.warn(
      `Failed to decompose soft component "${componentType}":`,
      error
    );
    return [componentData];
  }

  // Recursively dissolve each decomposed component
  const fullyDissolved: ComponentData[] = [];
  
  for (const component of decomposed) {
    const dissolved = dissolveComponentRecursively(
      component,
      softComponents,
      hardComponentNames,
      depth + 1,
      fieldSettings
    );
    fullyDissolved.push(...dissolved);
  }

  return fullyDissolved;
}

/**
 * Dissolves all soft components within the slots of a component.
 * 
 * @param componentData - The component whose slots to dissolve
 * @param softComponents - The registry of soft components
 * @param hardComponentNames - Set of hard component names
 * @param depth - Current recursion depth
 * @returns The component with all slot contents fully dissolved to hard components
 */
function dissolveComponentSlots(
  componentData: ComponentData,
  softComponents: SoftComponents,
  hardComponentNames: Set<string>,
  depth: number,
  fieldSettings?: Record<string, any>
): ComponentData {
  const newProps = { ...componentData.props };

  // Process each prop that might be a slot (array of components). This is the
  // correct array-element dissolution path here: slot arrays contain component
  // objects and should recurse, while mapped field arrays stay as field data.
  Object.entries(newProps).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length > 0 && value[0]?.type) {
      // This is a slot - recursively dissolve each component
      newProps[key] = (value as ComponentData[]).flatMap((slotComponent) =>
        dissolveComponentRecursively(
          slotComponent,
          softComponents,
          hardComponentNames,
          depth,
          fieldSettings
        )
      );
    }
  });

  return {
    ...componentData,
    props: newProps,
  };
}

/**
 * Dissolves all soft components in the data to their hard component foundations.
 * 
 * This function uses reverse topological sorting to ensure components are dissolved
 * in the correct order: composite components (Layout) are dissolved first, then their
 * dependencies (Card), then their dependencies (Button), until only hard components remain.
 * 
 * Process:
 * 1. Identify all soft and hard components
 * 2. Sort soft components in reverse dependency order (composite → leaf)
 * 3. Recursively dissolve each component until only hard components remain
 * 4. Process all slots to dissolve nested components
 * 
 * @param data - The Puck data structure to dissolve
 * @param softComponents - The registry of soft components with their versions
 * @param config - The Puck config containing component definitions
 * @returns New data with all soft components fully dissolved to hard components only
 * 
 * @example
 * ```ts
 * // Before: Layout (soft) -> Card (soft) -> Button (soft) -> Div (hard)
 * // After:  Only hard components remain (Div, Span, etc.)
 * const dissolved = dissolveAllSoftComponents(data, softComponents, config);
 * ```
 */
export function dissolveAllSoftComponents(
  data: Data,
  softComponents: SoftComponents,
  config: Config
): Data {
  // Get set of hard component names
  const hardComponentNames = new Set(
    Object.keys(config.components || {}).filter(
      (name) => !isSoftComponent(name, softComponents)
    )
  );

  // Get dissolution order (composite components first)
  reverseTopologicalSort(softComponents, hardComponentNames);

  // Extract root field settings for mapping resolution during dissolution.
  // We prioritize root props (live values) and merge in _fieldSettings (schema/defaults)
  // so that the resolver can find both current values and fallback defaults.
  const rootParams = (data.root as any)?.props || {};
  const fieldSettings = {
    ...((rootParams._fieldSettings as Record<string, any>) || {}),
    ...rootParams,
  };

  // Recursively dissolve all components in content
  const dissolveComponents = (components: ComponentData[]): ComponentData[] => {
    return components.flatMap((componentData) => {
      return dissolveComponentRecursively(
        componentData,
        softComponents,
        hardComponentNames,
        0,
        fieldSettings
      );
    });
  };

  // Process all content
  const newContent = dissolveComponents(data.content || []);

  // Process zones if they exist
  const newZones: Record<string, ComponentData[]> = {};
  if (data.zones) {
    Object.entries(data.zones).forEach(([zoneName, zoneComponents]) => {
      newZones[zoneName] = dissolveComponents(zoneComponents);
    });
  }

  const result: Data = {
    ...data,
    content: newContent,
    ...(data.zones && { zones: newZones }),
  };

  return result;
}

/**
 * Validates that data contains only hard components (no soft components remain).
 * Useful for testing and debugging.
 * 
 * @param data - The data to validate
 * @param softComponents - The soft components registry
 * @returns Object with validation result and any soft components found
 */
export function validateOnlyHardComponents(
  data: Data,
  softComponents: SoftComponents
): {
  isValid: boolean;
  softComponentsFound: string[];
} {
  const softComponentsFound: string[] = [];

  const checkComponents = (components: ComponentData[]): void => {
    for (const component of components) {
      if (isSoftComponent(component.type, softComponents)) {
        softComponentsFound.push(component.type);
      }

      // Check slots
      Object.values(component.props || {}).forEach((value) => {
        if (Array.isArray(value) && value.length > 0 && value[0]?.type) {
          checkComponents(value as ComponentData[]);
        }
      });
    }
  };

  checkComponents(data.content || []);

  if (data.zones) {
    Object.values(data.zones).forEach((zoneComponents) => {
      checkComponents(zoneComponents);
    });
  }

  return {
    isValid: softComponentsFound.length === 0,
    softComponentsFound: [...new Set(softComponentsFound)],
  };
}
