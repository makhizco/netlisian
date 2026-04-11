import { Config, ComponentConfig } from "@measured/puck";
import { SoftComponents, SoftSubComponent, VersionedSoftComponent } from "../types/SoftComponent";
import { Overrides } from "../types/Overrides";
import type { CustomFields } from "../types/SoftFields";
import { createVersionedComponentConfig } from "./create-versioned-component-config";

type Hydrator = NonNullable<Overrides["hydrateMapTransform"]>;

function hydrateSubComponentsTransforms(
  subComponents: SoftSubComponent,
  hydrator: Hydrator,
  context: {
    componentName: string;
    version: string;
    subComponentPath: string[];
    softComponent: VersionedSoftComponent["versions"][string];
  }
): SoftSubComponent {
  return subComponents.map((subComponent, idx) => {
    const path = [...context.subComponentPath, `${subComponent.type}:${idx}`];

    const mapped = subComponent.map?.map((mapItem) => {
      if (mapItem?.transform) return mapItem;
      const transform = hydrator(mapItem as any, {
        ...context,
        subComponentPath: path,
      });
      return transform ? { ...mapItem, transform } : mapItem;
    });

    const nestedComponents = Object.fromEntries(
      Object.entries(subComponent.components || {}).map(([slotKey, children]) => [
        slotKey,
        hydrateSubComponentsTransforms(children, hydrator, {
          ...context,
          subComponentPath: [...path, slotKey],
        }),
      ])
    );

    return {
      ...subComponent,
      map: mapped,
      components: nestedComponents,
    };
  });
}

export function hydrateSoftComponentsTransforms(
  softComponents: SoftComponents,
  hydrator: Hydrator
): SoftComponents {
  const hydrated: SoftComponents = {};

  Object.entries(softComponents || {}).forEach(([name, comp]) => {
    const versions: VersionedSoftComponent["versions"] = {};
    Object.entries(comp.versions || {}).forEach(([version, softComponent]) => {
      versions[version] = {
        ...softComponent,
        components: hydrateSubComponentsTransforms(softComponent.components, hydrator, {
          componentName: name,
          version,
          subComponentPath: [],
          softComponent,
        }),
      };
    });

    hydrated[name] = {
      ...comp,
      name: comp.name || name,
      defaultVersion: comp.defaultVersion,
      versions,
    };
  });

  return hydrated;
}

/**
 * Extracts all component dependencies from a SoftComponent's structure
 * @param softComponents - All soft components
 * @param componentName - The component to analyze
 * @param version - The version to analyze
 * @returns Set of component names that this component depends on
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
        // Add this type as a dependency
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
 * Builds a reverse dependency graph showing which components depend on each component
 * Also enriches softComponents with stored dependencies for backward compatibility
 *
 * @param softComponents - All soft components
 * @returns Map of componentName -> Set of components that depend on it
 */
export function buildReverseDependencyGraph(
  softComponents: SoftComponents
): Map<string, Set<string>> {
  const reverseDeps = new Map<string, Set<string>>();

  for (const [componentName, component] of Object.entries(softComponents)) {
    const defaultVersion =
      component.defaultVersion || Object.keys(component.versions || {}).pop();

    if (!defaultVersion) continue;

    // Get all versions for this component
    Object.entries(component.versions || {}).forEach(([version, versionedComp]) => {
      const dependencies = extractDependencies(softComponents, componentName, version);

      // Store dependencies in the component for persistence
      if (!component.dependencies) {
        component.dependencies = {};
      }
      component.dependencies[version] = dependencies;

      // Build reverse graph: for each dependency, add this component as dependent
      for (const dep of dependencies) {
        if (!reverseDeps.has(dep)) {
          reverseDeps.set(dep, new Set());
        }
        reverseDeps.get(dep)!.add(componentName);
      }
    });
  }

  return reverseDeps;
}

/**
 * Performs topological sort on soft components based on their dependencies
 * Components that only depend on hard components come first, then their dependents, etc.
 * 
 * @param softComponents - All soft components
 * @param hardComponentNames - Set of hard component names (from hardConfig)
 * @returns Array of component names in dependency order, or throws if circular dependency detected
 */
function topologicalSort(
  softComponents: SoftComponents,
  hardComponentNames: Set<string>
): string[] {
  const sorted: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  // Build dependency graph for all soft components
  const dependencyGraph = new Map<string, Set<string>>();

  for (const [componentName, component] of Object.entries(softComponents)) {
    const defaultVersion =
      component.defaultVersion || Object.keys(component.versions || {}).pop();

    if (!defaultVersion) continue;

    const allDeps = extractDependencies(
      softComponents,
      componentName,
      defaultVersion
    );

    // Filter to only soft component dependencies (ignore hard components)
    const softDeps = new Set(
      [...allDeps].filter((dep) => !hardComponentNames.has(dep))
    );

    dependencyGraph.set(componentName, softDeps);
  }

  // DFS-based topological sort
  function visit(componentName: string): void {
    if (visited.has(componentName)) return;

    if (visiting.has(componentName)) {
      throw new Error(
        `Circular dependency detected involving component: ${componentName}`
      );
    }

    visiting.add(componentName);

    const dependencies = dependencyGraph.get(componentName) || new Set();

    for (const dep of dependencies) {
      // Only visit if it's a soft component
      if (softComponents[dep]) {
        visit(dep);
      }
    }

    visiting.delete(componentName);
    visited.add(componentName);
    sorted.push(componentName);
  }

  // Visit all soft components
  for (const componentName of Object.keys(softComponents)) {
    if (!visited.has(componentName)) {
      visit(componentName);
    }
  }

  return sorted;
}

/**
 * Builds initial soft component configurations in dependency order
 * Components that depend only on hard components are built first,
 * then components that depend on those, and so on.
 * 
 * Example: Button (depends on hard) → Card (depends on Button) → Layout (depends on Card)
 * 
 * @param hardConfig - The hard-coded configuration
 * @param softComponents - The soft components to build
 * @returns Record of component configurations ready to merge into the config
 */
export function buildInitialSoftComponents(
  hardConfig: Config,
  softComponents: SoftComponents,
  overrides?: Overrides,
  showVersioning = false,
  customFields?: CustomFields
): Record<string, ComponentConfig> {
  if (!softComponents || Object.keys(softComponents).length === 0) {
    return {};
  }

  const hydratedSoftComponents = overrides?.hydrateMapTransform
    ? hydrateSoftComponentsTransforms(softComponents, overrides.hydrateMapTransform)
    : softComponents;

  // Get set of hard component names
  const hardComponentNames = new Set(Object.keys(hardConfig.components || {}));

  try {
    // Sort components by dependencies
    const sortedComponentNames = topologicalSort(
      hydratedSoftComponents,
      hardComponentNames
    );

    // Build a temporary config that accumulates as we go
    const buildingConfig: Config = {
      ...hardConfig,
      components: { ...hardConfig.components },
    };

    const componentConfigs: Record<string, ComponentConfig> = {};

    // Build components in dependency order
    for (const name of sortedComponentNames) {
      const comp = hydratedSoftComponents[name];
      const defaultVersion =
        comp.defaultVersion || Object.keys(comp.versions || {}).pop();
      const versionedComponent = comp.versions?.[defaultVersion || ""];
      const allVersions = Object.keys(comp.versions || {});

      if (!versionedComponent) {
        console.warn(
          `Soft component "${name}" does not have a valid default version. Skipping.`
        );
        continue;
      }

      // Create the component config with access to all previously built components
      const newSoftComponentConfig = createVersionedComponentConfig(
        name,
        comp.name || name,
        defaultVersion || "1.0.0",
        allVersions,
        buildingConfig, // Pass the accumulating config
        hydratedSoftComponents,
        versionedComponent.defaultProps,
        showVersioning,
        customFields,
        overrides,
      );

      componentConfigs[name] = newSoftComponentConfig;

      // Add to building config so subsequent components can reference it
      buildingConfig.components[name] = newSoftComponentConfig;
    }

    return componentConfigs;
  } catch (error) {
    console.error("Error building soft components:", error);
    
    // Fallback to simple build without dependency ordering
    console.warn("Falling back to unordered component building");
    
    const componentConfigs: Record<string, ComponentConfig> = {};
    
    for (const [name, comp] of Object.entries(hydratedSoftComponents)) {
      const defaultVersion =
        comp.defaultVersion || Object.keys(comp.versions || {}).pop();
      const versionedComponent = comp.versions?.[defaultVersion || ""];
      const allVersions = Object.keys(comp.versions || {});

      if (!versionedComponent) {
        console.warn(
          `Soft component "${name}" does not have a valid default version. Skipping.`
        );
        continue;
      }

      const newSoftComponentConfig = createVersionedComponentConfig(
        name,
        comp.name || name,
        defaultVersion || "1.0.0",
        allVersions,
        hardConfig,
        hydratedSoftComponents,
        versionedComponent.defaultProps,
        showVersioning,
        customFields,        overrides,      );

      componentConfigs[name] = newSoftComponentConfig;
    }

    return componentConfigs;
  }
}
