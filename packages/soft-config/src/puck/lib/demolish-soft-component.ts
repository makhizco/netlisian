"use client";
import { ComponentData, Config, Data, walkTree } from "@puckeditor/core";
import { SoftComponents } from "../types/SoftComponent";
import { decomposeSoftComponent } from "./decompose-soft-component";

/**
 * Demolishes a soft component by replacing all instances of it with its decomposed parts.
 * This removes the soft component from both the data and the configuration.
 * 
 * Process:
 * 1. Walk through all data and decompose instances of the specified component
 * 2. Remove the component from the soft components registry
 * 3. Remove the component from the config
 * 
 * @param componentName - The name of the soft component to demolish
 * @param data - The current Puck data structure
 * @param config - The current Puck config
 * @param softComponents - The registry of all soft components
 * @returns Object containing updated data, config, and softComponents
 * 
 * @example
 * ```ts
 * const result = demolishSoftComponent("Card", data, config, softComponents);
 * // All Card components in data are replaced with their sub-components
 * // Card is removed from config and softComponents
 * ```
 */
export function demolishSoftComponent(
  componentName: string,
  data: Data,
  config: Config,
  softComponents: SoftComponents
): {
  data: Data;
  config: Config;
  softComponents: SoftComponents;
} {
  // Decompose all instances of the component in the data
  const resolvedData = walkTree(data, config, (components) => {
    components.forEach((componentData, index) => {
      if (componentData.type === componentName) {
        const decomposed = decomposeSoftComponent(componentData, softComponents);
        if (decomposed.length) {
          components.splice(index, 1, ...decomposed);
        }
      }
    });
    return components;
  });

  // Remove the soft component from the registry
  const newSoftComponents = { ...softComponents };
  delete newSoftComponents[componentName];

  // Remove the component from the config
  const newConfig: Config = {
    ...config,
    components: Object.entries(config.components).reduce(
      (acc, [name, component]) => {
        if (name !== componentName) {
          acc[name] = component;
        }
        return acc;
      },
      {} as Config["components"]
    ),
  };

  return {
    data: resolvedData,
    config: newConfig,
    softComponents: newSoftComponents,
  };
}
