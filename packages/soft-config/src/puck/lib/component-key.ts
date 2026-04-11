import { Overrides } from "../types/Overrides";
import { BuilderRootConfig } from "../types/BuilderConfig";

const toSlug = (value: string): string => {
  return value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
};

const defaultComponentNameToKey = (
  displayName: string,
  context: Partial<BuilderRootConfig> & {
    existingKeys: string[];
    state: "building" | "remodeling" | "ready" | "inspecting";
    registry?: string;
    registryName?: string;
  }
): string => {
  const registry = context.registryName ?? context.registry ?? "default";
  return `${toSlug(registry)}/${toSlug(displayName)}`;
};

const defaultComponentKeyToName = (key: string): string => {
  const slashIndex = key.indexOf("/");
  const componentPart = slashIndex === -1 ? key : key.slice(slashIndex + 1);

  if (!componentPart) return "";

  return componentPart
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const createComponentKeyFromName = (
  displayName: string,
  overrides: Overrides,
  context: Partial<BuilderRootConfig> & {
    existingKeys: string[];
    state: "building" | "remodeling" | "ready" | "inspecting";
  }
): string => {
  const key = overrides.componentNameToKey
    ? overrides.componentNameToKey(displayName, context)
    : defaultComponentNameToKey(displayName, context);

  return key.trim();
};

export const getComponentNameFromKey = (
  key: string,
  overrides?: Overrides
): string => {
  if (overrides?.componentKeyToName) {
    return overrides.componentKeyToName(key);
  }
  return defaultComponentKeyToName(key);
};
