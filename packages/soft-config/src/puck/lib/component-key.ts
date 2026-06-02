import { Overrides } from "../types/Overrides";
import { BuilderRootConfig } from "../types/BuilderConfig";
import { Status } from "../store";

const toSlug = (value: string): string => {
  return value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
};

const slugTolabel = (name: string): string => {

  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export const componentNameFromLabel = (
  label: string,
  overrides: Overrides,
  context: Partial<BuilderRootConfig> & {
    existingKeys: string[];
    state: Status;
  },
): string => {
  const key = overrides.componentLabelToName
    ? overrides.componentLabelToName(label, context)
    : toSlug(label);

  return key.trim();
};

export const componentLabelFromName = (
  name: string,
  overrides?: Overrides,
): string => {
  if (overrides?.componentNameToLabel) {
    return overrides.componentNameToLabel(name);
  }
  return slugTolabel(name);
};
