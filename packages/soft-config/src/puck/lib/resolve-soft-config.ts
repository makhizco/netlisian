"use client";
import { Data, Config } from "@measured/puck";
import { SoftComponents } from "../types/SoftComponent";
import {
  dissolveAllSoftComponents,
  validateOnlyHardComponents,
} from "./dissolve-all-soft-components";

/**
 * Resolves soft components in data by dissolving them to hard components only.
 * 
 * This function uses reverse topological sorting to ensure components are dissolved
 * in the correct order (composite → leaf), guaranteeing that only hard components
 * remain in the final output.
 * 
 * @param data - The Puck data structure to resolve
 * @param softComponents - The registry of soft components with their versions
 * @param config - The Puck config containing component definitions
 * @returns New data with all soft components fully dissolved to hard components
 * 
 * @example
 * ```ts
 * const resolvedData = resolveSoftConfig(appState.data, softComponents, config);
 * ```
 */
export const resolveSoftConfig = (
  data: Data,
  softComponents: SoftComponents,
  config: Config
): Data => {  
  const dissolved = dissolveAllSoftComponents(data, softComponents, config);
  
  // Validate that only hard components remain (development check)
  if (process.env.NODE_ENV === "development") {
    const validation = validateOnlyHardComponents(dissolved, softComponents);
    if (!validation.isValid) {
      alert(
        "Warning: Soft components still present after dissolution:" + " " + String(validation.softComponentsFound
      ));
    }
  }
  
  return dissolved;
};

// Export the main dissolution function for direct use
export { dissolveAllSoftComponents } from "./dissolve-all-soft-components";
