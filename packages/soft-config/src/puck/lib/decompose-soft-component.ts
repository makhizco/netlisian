import { DefaultComponentProps, ComponentData  } from "@measured/puck";
import { SoftComponents } from "../types/SoftComponent";
import { subComponentDecomposer } from "./builder/sub-component-decomposer";
import { resolveSoftComponentData } from "./builder/resolve-soft-component-data";

/**
 * Decomposes a single soft component one level into its constituent sub-components.
 * This performs a single-level decomposition only - it does not recursively decompose
 * nested soft components.
 * 
 * If `fieldSettings` are provided, mappings from `_map` are applied to the component's
 * props before decomposition, ensuring that dynamically mapped values are baked in.
 * 
 * @param componentData - The component data to decompose (must be a soft component)
 * @param softComponents - The registry of all soft components
 * @param fieldSettings - Optional root-level `_fieldSettings` for resolving mapped values
 * @returns Array of decomposed sub-components
 * @throws Error if component data is invalid or soft component not found
 */
export function decomposeSoftComponent(
  componentData: ComponentData,
  softComponents: SoftComponents,
  fieldSettings?: DefaultComponentProps,
  keepMapField?: boolean
): ComponentData[] {
  if (!componentData?.type || !componentData?.props.id) {
    throw new Error("Component data must have type and id to decompose.");
  }

  const version = (componentData.props as DefaultComponentProps)?.version as string || "1.0.0";
  const softComponent = softComponents[componentData.type]?.versions[version];

  if (!softComponent) {
    throw new Error(
      `Soft component "${componentData.type}" version "${version}" not found.`
    );
  }

  // Apply field mappings before decomposition so sub-components receive resolved
  // values. This is for mapped component props, not array editor rows; slot
  // arrays are handled later by the dissolver via recursive component traversal.
  let resolvedComponentData = componentData;
  if (fieldSettings && componentData.props?._map?.length) {
    const resolvedProps = resolveSoftComponentData(
      componentData.props as DefaultComponentProps & { id: string },
      fieldSettings
    );
    resolvedComponentData = {
      ...componentData,
      props: resolvedProps,
    };
  }

  // Decompose into direct sub-components (one level only)
  const decomposedComponentData: ComponentData[] = softComponent.components.map(
    (softSubComponent) => {
      return subComponentDecomposer(
        resolvedComponentData,
        softSubComponent,
        keepMapField
      );
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
