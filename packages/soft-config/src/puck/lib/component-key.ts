import { Overrides } from "../types/Overrides";

const defaultToCamelCase = (value: string): string => {
  const tokens = value
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, " ")
    .split(/[\s_-]+/)
    .filter(Boolean);

  if (tokens.length === 0) return "";

  const [first, ...rest] = tokens;
  return `${first.toLowerCase()}${rest
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join("")}`;
};

export const createComponentKeyFromName = (
  displayName: string,
  overrides: Overrides,
  context: {
    existingKeys: string[];
    state: "building" | "remodeling" | "ready" | "inspecting";
  }
): string => {
  const key = overrides.componentNameToKey
    ? overrides.componentNameToKey(displayName, context)
    : defaultToCamelCase(displayName);

  return key.trim();
};
