import { ComponentData } from "@measured/puck";
import { SoftComponents } from "../types/SoftComponent";
import { subComponentDecomposer } from "./builder/sub-component-decomposer";

/**
 * Decomposes a single soft component one level into its constituent sub-components.
 * This performs a single-level decomposition only - it does not recursively decompose
 * nested soft components.
 * 
 * @param componentData - The component data to decompose (must be a soft component)
 * @param softComponents - The registry of all soft components
 * @returns Array of decomposed sub-components
 * @throws Error if component data is invalid or soft component not found
 * 
 * @example
 * ```ts
 * // Card component (soft) -> [Button (soft), Div (hard)]
 * const decomposed = decomposeSoftComponent(cardData, softComponents);
 * // decomposed contains the direct children, Button is still a soft component
 * ```
 */
export function decomposeSoftComponent(
  componentData: ComponentData,
  softComponents: SoftComponents
): ComponentData[] {
  if (!componentData?.type || !componentData?.props.id) {
    throw new Error("Component data must have type and id to decompose.");
  }

  const version = (componentData.props as any)?.version || "1.0.0";
  const softComponent = softComponents[componentData.type]?.versions[version];

  if (!softComponent) {
    throw new Error(
      `Soft component "${componentData.type}" version "${version}" not found.`
    );
  }

  // Decompose into direct sub-components (one level only)
  const decomposedComponentData: ComponentData[] = softComponent.components.map(
    (softSubComponent) => {
      return subComponentDecomposer(componentData, softSubComponent);
    }
  );

  return decomposedComponentData;
}

/**
 * Checks if a component is a soft component (exists in the soft components registry).
 * 
 * @param componentType - The component type to check
 * @param softComponents - The registry of all soft components
 * @returns True if the component is a soft component, false otherwise
 */
export function isSoftComponent(
  componentType: string,
  softComponents: SoftComponents
): boolean {
  return componentType in softComponents;
}
